-- =============================================================================
-- 0007 — Products and categories
-- Source: updated Development Document, Part D8 (products), D9 (categories)
-- and F3 (its migration 0005).
--
--   * Every shop starts with ready-made categories (by business type) and can
--     add, rename, hide and reorder its own. A shop's categories are visible
--     only to its members; the admin edits only the default list.
--   * An expense category can be marked a "hidden cost": it feeds the real
--     profit check (defaults: Transport, Family use, Owner salary, Wastage).
--   * Entries point to a category (and optionally a product + quantity).
--   * Products are "made by my shop" or "bought from a company"; the Free
--     plan allows 20 active products, Pro unlimited.
--
-- Changes from the document's SQL (same behaviour):
--   [+] A shop with no business type yet gets the "shop" categories, so the
--       first login (before the shop setup page) never has an empty picker.
--   [+] Existing shops and entries are filled in (backfill) without writing
--       history rows.
--   [+] entries must still have a category: `category` (old key) or `category_id`.
--   [+] restore_entry_from_history() also restores the new columns.
--   [+] The `products` feature switch is turned On (the page exists).
-- =============================================================================


-- ===== CATEGORIES: defaults for everyone + each shop's own ===================
create table categories (
  id             uuid primary key default gen_random_uuid(),
  business_id    uuid references businesses (id) on delete cascade,   -- null = default template
  type           text not null check (type in ('income', 'expense', 'product')),
  key            text,                                -- defaults: 'stock' (label comes from translations)
  name           text check (char_length(name) between 1 and 40),     -- the owner's own name or a rename
  icon           text not null default 'tag',
  color          text not null default 'gray',
  counts_as      text not null default 'normal' check (counts_as in ('normal', 'hidden_cost')),
  business_types text[],                              -- templates only: null = all business types
  sort           int not null default 100,
  archived       boolean not null default false,
  created_at     timestamptz not null default now(),
  check (key is not null or name is not null),
  check (counts_as = 'normal' or type = 'expense')
);
comment on table categories is 'Default category templates (business_id null) and each shop''s own categories.';

create unique index categories_key_unique on categories
  (coalesce(business_id, '00000000-0000-0000-0000-000000000000'::uuid), type, key) where key is not null;
create unique index categories_name_unique on categories
  (coalesce(business_id, '00000000-0000-0000-0000-000000000000'::uuid), type, lower(name)) where name is not null;
create index categories_business on categories (business_id, type, sort);

alter table categories enable row level security;

-- Templates are readable by all; a shop's own categories only by its members.
create policy categories_read on categories for select
  using (business_id is null or my_role(business_id) is not null);
create policy categories_owner_write on categories for all
  using (business_id is not null and my_role(business_id) = 'owner')
  with check (business_id is not null and my_role(business_id) = 'owner');
create policy categories_admin_templates on categories for all
  using (business_id is null and is_admin())
  with check (business_id is null and is_admin());


-- ===== PRODUCTS: made by the shop, or bought from a company ==================
alter table products
  add column kind         text not null default 'own' check (kind in ('own', 'company')),
  add column company_name text check (char_length(company_name) <= 80),
  add column category_id  uuid references categories (id) on delete set null,
  add column unit         text not null default 'piece'
    check (unit in ('piece', 'kg', 'g', 'litre', 'ml', 'pack', 'box', 'bottle', 'dozen', 'metre', 'service')),
  add column barcode      text,
  add column notes        text check (char_length(notes) <= 200),
  add column archived     boolean not null default false;
create index products_business on products (business_id, archived, name);

-- Staff can now see products (to pick them when adding a sale).
drop policy products_read on products;
create policy products_read on products for select
  using (my_role(business_id) in ('owner', 'viewer', 'staff'));


-- ===== ENTRIES now point to a category (and optionally a product) ============
alter table entries alter column category drop not null;
alter table entries
  add column category_id uuid references categories (id) on delete restrict,
  add column product_id  uuid,
  add column quantity    numeric(12, 3) check (quantity is null or quantity > 0),
  add constraint entries_has_category check (category is not null or category_id is not null);
alter table entries add constraint entries_product_fk
  foreign key (product_id) references products (id) on delete set null;
create index entries_category on entries (category_id);


-- ===== DEFAULT CATEGORY TEMPLATES (the admin can edit them) ==================
insert into categories (business_id, type, key, icon, color, counts_as, business_types, sort) values
  (null, 'income',  'sales',          'shopping-cart', 'green',  'normal',      null,                 1),
  (null, 'income',  'service_income', 'tool',          'green',  'normal',      '{service,transport}', 2),
  (null, 'income',  'other_income',   'plus',          'green',  'normal',      null,                 9),
  (null, 'expense', 'stock',          'package',       'orange', 'normal',      '{shop,home}',        1),
  (null, 'expense', 'ingredients',    'chef-hat',      'orange', 'normal',      '{home}',             2),
  (null, 'expense', 'fuel',           'gas-station',   'orange', 'normal',      '{transport}',        2),
  (null, 'expense', 'rent',           'home',          'blue',   'normal',      null,                 3),
  (null, 'expense', 'salary',         'users',         'blue',   'normal',      null,                 4),
  (null, 'expense', 'electricity',    'bolt',          'yellow', 'normal',      null,                 5),
  (null, 'expense', 'water',          'droplet',       'blue',   'normal',      null,                 6),
  (null, 'expense', 'phone_internet', 'wifi',          'purple', 'normal',      null,                 7),
  (null, 'expense', 'repairs',        'tool',          'gray',   'normal',      null,                 8),
  (null, 'expense', 'transport',      'truck',         'gray',   'hidden_cost', null,                 9),
  (null, 'expense', 'family_use',     'heart',         'red',    'hidden_cost', null,                 10),
  (null, 'expense', 'owner_salary',   'user',          'red',    'hidden_cost', null,                 11),
  (null, 'expense', 'wastage',        'trash',         'red',    'hidden_cost', null,                 12),
  (null, 'expense', 'other',          'dots',          'gray',   'normal',      null,                 99),
  (null, 'product', 'general',        'box',           'gray',   'normal',      null,                 1);


-- ===== COPY THE DEFAULTS INTO A SHOP =========================================
create function seed_business_categories(b uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  bt text;
begin
  -- A shop that has not chosen a business type yet is treated as a "shop".
  select coalesce(business_type, 'shop') into bt from businesses where id = b;

  insert into categories (business_id, type, key, icon, color, counts_as, sort)
  select b, t.type, t.key, t.icon, t.color, t.counts_as, t.sort
  from categories t
  where t.business_id is null and not t.archived
    and (t.business_types is null or bt = any (t.business_types))
  on conflict do nothing;
end $$;

create function on_business_seed_categories() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform seed_business_categories(new.id);
  return new;
end $$;

create trigger businesses_seed_categories
  after insert or update of business_type on businesses
  for each row execute function on_business_seed_categories();

-- Existing shops get their categories, and existing entries point to them.
-- History rows are not written for this one-time fill.
select seed_business_categories(id) from businesses;

alter table entries disable trigger entries_history;
update entries e
   set category_id = c.id
  from categories c
 where c.business_id = e.business_id
   and c.type = e.type::text
   and c.key = e.category
   and e.category_id is null;
alter table entries enable trigger entries_history;


-- ===== SAFETY CHECKS =========================================================
-- An entry's category and product must belong to the same shop, and the
-- category type must match the entry (income / expense).
create function check_entry_links() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.category_id is not null and not exists (
       select 1 from categories c
       where c.id = new.category_id
         and c.business_id = new.business_id
         and c.type = new.type::text) then
    raise exception 'category_not_in_shop';
  end if;
  if new.product_id is not null and not exists (
       select 1 from products p
       where p.id = new.product_id and p.business_id = new.business_id) then
    raise exception 'product_not_in_shop';
  end if;
  return new;
end $$;

create trigger entries_check_links before insert or update on entries
  for each row execute function check_entry_links();

-- A product's category must be a product category of the same shop; company
-- products need a company name.
create function check_product() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.category_id is not null and not exists (
       select 1 from categories c
       where c.id = new.category_id
         and c.business_id = new.business_id
         and c.type = 'product') then
    raise exception 'category_not_in_shop';
  end if;
  if new.kind = 'company' and coalesce(btrim(new.company_name), '') = '' then
    raise exception 'company_name_required';
  end if;
  return new;
end $$;

create trigger products_check before insert or update on products
  for each row execute function check_product();

-- Free plan: up to 20 active products (Pro: unlimited). The limit can only go up.
create function check_product_limit() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  shop_owner uuid;
  active_count int;
begin
  select owner_id into shop_owner from businesses where id = new.business_id;
  if is_pro(shop_owner) then
    return new;
  end if;

  select count(*) into active_count from products
   where business_id = new.business_id and not archived;
  if not new.archived and active_count >= 20 then
    raise exception 'free_limit_products';
  end if;
  return new;
end $$;

create trigger products_limit before insert on products
  for each row execute function check_product_limit();

-- Company names already used in this shop (type-ahead suggestions).
create function my_company_names(b uuid) returns text[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(distinct company_name order by company_name), '{}')
  from products
  where business_id = b and company_name is not null and my_role(b) is not null;
$$;
revoke all on function my_company_names(uuid) from public, anon;
grant execute on function my_company_names(uuid) to authenticated;


-- ===== HISTORY RESTORE now knows the new columns =============================
create or replace function restore_entry_from_history(p_history_id bigint) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  h entry_history;
begin
  select * into h from entry_history where id = p_history_id;
  if not found or my_role(h.business_id) is distinct from 'owner' then
    raise exception 'not_allowed';
  end if;

  if h.action = 'delete' then
    insert into entries
    select * from jsonb_populate_record(null::entries, h.old_row);
  else
    update entries e
       set type = r.type, category = r.category, category_id = r.category_id,
           product_id = r.product_id, quantity = r.quantity,
           amount_cents = r.amount_cents, entry_date = r.entry_date, note = r.note
      from jsonb_populate_record(null::entries, h.old_row) r
     where e.id = h.entry_id and e.business_id = h.business_id;
    if not found then
      raise exception 'entry_not_found';
    end if;
  end if;

  return h.entry_id;
end $$;


-- ===== FEATURE SWITCHES =======================================================
-- Own categories are free for everyone, with no limit, forever.
insert into feature_flags (key, name, category, status, min_plan, locked_free, always_on)
values ('custom_categories', 'Own categories', 'core', 'on', 'free', true, true);

-- The products page exists now.
update feature_flags set status = 'on' where key = 'products';
