-- =============================================================================
-- 0004 — Plans, subscriptions and payments (tables only)
-- Source: updated Development Document, Part D5 and F3 (its migrations 0002
-- "payments" and 0004 "pricing", written here as one file).
--
-- Only the tables, the Pro checks and the seed plans are created now, so
-- nothing has to change later. Checkout and webhooks come with Phase 2.
--
-- Rules:
--   * Pro is worked out with is_pro() from the owner's subscription, never
--     from a value sent by the browser. `businesses.plan` (0001) is no longer used.
--   * subscriptions, payments and webhook_events are written only by server
--     code with the secret key (verified webhooks). Users can read their own rows.
--   * Founding spots are shared by all founding plans and close automatically.
--   * One free trial per user, ever.
-- =============================================================================


-- ===== PLANS ==================================================================
create table plans (
  code             text primary key,                 -- e.g. 'pro_monthly'
  name             text not null,
  tier             text not null default 'pro' check (tier in ('free', 'pro', 'business')),
  billing_interval text check (billing_interval in ('month', 'year')),
  payment_mode     text not null default 'recurring' check (payment_mode in ('recurring', 'one_time')),
  period_months    int not null default 1 check (period_months > 0),
  is_founding      boolean not null default false,
  max_subscribers  int,                              -- e.g. 300 founding spots
  available_until  timestamptz,                      -- offer end date (admin sets)
  public           boolean not null default true,    -- false = hidden plan
  features         jsonb not null default '{}',
  prices           jsonb not null default '{}',      -- cents per currency
  trial_days       int not null default 0,
  active           boolean not null default true,
  sort             int not null default 0
);
comment on table plans is 'Pricing plans (admin-editable). Prices are cents per currency.';

create table subscriptions (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid not null references auth.users (id) on delete cascade,
  plan_code               text not null references plans (code),
  gateway                 text not null check (gateway in ('payhere', 'paddle', 'manual')),
  gateway_subscription_id text,
  status                  text not null
                          check (status in ('trialing', 'active', 'past_due', 'cancelled', 'expired')),
  currency                char(3) not null,
  amount_cents            bigint not null default 0,
  current_period_end      timestamptz,
  cancel_at_period_end    boolean not null default false,
  price_locked_until      timestamptz,               -- price can't change before this
  is_founding             boolean not null default false,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  unique (gateway, gateway_subscription_id)
);
create index subscriptions_user on subscriptions (user_id, status);
-- One free trial per user, ever.
create unique index one_trial_per_user on subscriptions (user_id)
  where gateway = 'manual' and status = 'trialing';

create table payments (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid references auth.users (id) on delete set null,
  subscription_id    uuid references subscriptions (id) on delete set null,
  gateway            text not null,
  gateway_payment_id text not null,
  amount_cents       bigint not null,
  currency           char(3) not null,
  status             text not null check (status in ('paid', 'failed', 'refunded', 'partially_refunded')),
  invoice_url        text,
  created_at         timestamptz not null default now(),
  unique (gateway, gateway_payment_id)
);
create index payments_user on payments (user_id, created_at desc);

create table coupons (
  code             text primary key,
  percent_off      int check (percent_off between 1 and 100),
  amount_off_cents bigint,
  currency         char(3),
  valid_until      timestamptz,
  max_uses         int,
  used             int not null default 0,
  active           boolean not null default true
);

create table webhook_events (
  id           bigint generated always as identity primary key,
  gateway      text not null,
  event_id     text not null,
  event_type   text,
  payload      jsonb not null,
  processed_at timestamptz,
  error        text,
  received_at  timestamptz not null default now(),
  unique (gateway, event_id)                         -- the same event is saved only once
);


-- ===== WHICH PLAN IS THIS USER ON? ============================================
-- 'free', 'pro' or 'business' right now. A trial, an active or a past-due
-- subscription counts until its paid period ends; an expired pass returns the
-- user to Free.
create function user_tier(uid uuid default auth.uid()) returns text
language sql stable security definer set search_path = public as $$
  select coalesce((
    select p.tier
    from subscriptions s
    join plans p on p.code = s.plan_code
    where s.user_id = uid
      and s.status in ('trialing', 'active', 'past_due')
      and (s.current_period_end is null or s.current_period_end > now())
    order by case p.tier when 'business' then 2 when 'pro' then 1 else 0 end desc
    limit 1
  ), 'free');
$$;

-- Pro features are also included in Business.
create function is_pro(uid uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = public as $$
  select user_tier(uid) in ('pro', 'business');
$$;

-- Founding spots left (shared by all founding plans); null = no limit.
create function plan_spots_left(p_code text) returns int
language sql stable security definer set search_path = public as $$
  select case when p.max_subscribers is null then null
    else greatest(p.max_subscribers - (
      select count(distinct s.user_id)::int
      from subscriptions s
      join plans q on q.code = s.plan_code
      where q.is_founding = p.is_founding and q.is_founding
        and s.gateway <> 'manual'
    ), 0) end
  from plans p
  where p.code = p_code;
$$;

-- Can this plan be bought right now? (checked again before every checkout)
create function plan_available(p_code text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from plans p
    where p.code = p_code and p.active and p.public and p.tier <> 'free'
      and (p.available_until is null or p.available_until > now())
      and coalesce(plan_spots_left(p.code), 1) > 0
  );
$$;


-- ===== ROW LEVEL SECURITY =====================================================
alter table plans          enable row level security;
alter table subscriptions  enable row level security;
alter table payments       enable row level security;
alter table coupons        enable row level security;
alter table webhook_events enable row level security;

-- Everyone (also visitors) may read the public, active plans; the admin reads all.
create policy plans_read on plans for select
  using ((active and public) or is_admin());
create policy plans_write on plans for all
  using (is_admin()) with check (is_admin());
create policy subs_read on subscriptions for select
  using (user_id = (select auth.uid()) or is_admin());
create policy payments_read on payments for select
  using (user_id = (select auth.uid()) or is_admin());
create policy coupons_admin on coupons for all
  using (is_admin()) with check (is_admin());
create policy webhooks_admin on webhook_events for select
  using (is_admin());
-- No insert/update/delete policies on subscriptions, payments and webhook_events:
-- only the server (secret key) writes them.


-- ===== SEED: plans (prices in cents; the admin can edit them) =================
insert into plans (code, name, tier, billing_interval, payment_mode, period_months,
                   is_founding, max_subscribers, prices, trial_days, sort, public) values
  ('free',                  'Free',                        'free',     null,    'recurring', 1,  false, null, '{}',                                0,  0, true),
  ('pro_founding_monthly',  'Pro - Founding member',       'pro',      'month', 'recurring', 1,  true,  300,  '{"LKR": 49000, "USD": 299}',       0,  1, true),
  ('pro_founding_yearly',   'Pro - Founding member',       'pro',      'year',  'recurring', 12, true,  300,  '{"LKR": 490000, "USD": 2900}',     0,  2, true),
  ('pro_founding_pass_12m', 'Pro - Founding 12-month pass','pro',      null,    'one_time',  12, true,  300,  '{"LKR": 490000}',                  0,  2, true),
  ('pro_monthly',           'Pro',                         'pro',      'month', 'recurring', 1,  false, null, '{"LKR": 99000, "USD": 499}',       14, 3, true),
  ('pro_yearly',            'Pro',                         'pro',      'year',  'recurring', 12, false, null, '{"LKR": 990000, "USD": 4900}',     0,  4, true),
  ('pro_pass_1m',           'Pro 1-month pass',            'pro',      null,    'one_time',  1,  false, null, '{"LKR": 99000}',                   0,  5, true),
  ('pro_pass_12m',          'Pro 12-month pass',           'pro',      null,    'one_time',  12, false, null, '{"LKR": 990000}',                  0,  6, true),
  -- Business plans stay hidden (public = false) until Phase 4 is built.
  ('business_monthly',      'Business',                    'business', 'month', 'recurring', 1,  false, null, '{"LKR": 249000, "USD": 1299}',     0,  7, false),
  ('business_yearly',       'Business',                    'business', 'year',  'recurring', 12, false, null, '{"LKR": 2490000, "USD": 12900}',   0,  8, false);

insert into app_settings (key, value) values
  ('languages', '{"enabled": ["en", "si", "ta"]}'),
  ('payments',  '{"lkr_gateway": "payhere", "other_gateway": "paddle"}'),
  ('pricing',   '{"founding_open": true, "standard_price_lock_months": 12, "price_change_notice_days": 30, "trial_days": 14}');
