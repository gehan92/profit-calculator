-- 0012_history_restore_and_cleanup.sql
-- Undo and history screen (spec E5 "Never lose work", D7 feature switches).
--
--   [new] restore_entry_from_history (migration 0007 already restores the category id, product
--         and quantity) now also never points at a product that has been removed in the
--         meantime: the amount comes back, the product link is dropped instead of failing.
--   [new] a restored change is used up: its history row is removed, so the same row cannot
--         be restored twice (restoring a deleted entry twice would also fail on the id).
--   [new] the daily cleanup of old history is scheduled (Supabase cron, when available).
--   [new] the old `features` setting is removed: the feature_flags table replaces it.

-- ===== UNDO: put back EVERYTHING that was changed ==============================
create or replace function restore_entry_from_history(p_history_id bigint) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  h entry_history;
  r entries;
begin
  select * into h from entry_history where id = p_history_id;
  if not found or my_role(h.business_id) is distinct from 'owner' then
    raise exception 'not_allowed';
  end if;

  r := jsonb_populate_record(null::entries, h.old_row);

  -- A product that no longer exists cannot be pointed at again; the amount stays.
  if r.product_id is not null and not exists (select 1 from products p where p.id = r.product_id) then
    r.product_id := null;
    r.quantity := null;
  end if;

  if h.action = 'delete' then
    insert into entries select (r).*;
  else
    update entries e
       set type         = r.type,
           category     = r.category,
           category_id  = r.category_id,
           amount_cents = r.amount_cents,
           entry_date   = r.entry_date,
           note         = r.note,
           product_id   = r.product_id,
           quantity     = r.quantity
     where e.id = h.entry_id and e.business_id = h.business_id;
    if not found then
      raise exception 'entry_not_found';
    end if;
  end if;

  -- Used up. (Restoring an earlier version is itself a change, so the values from just
  -- before the undo are kept as a new history row: an undo can be undone.)
  delete from entry_history where id = p_history_id;
  return h.entry_id;
end $$;


-- ===== DAILY CLEANUP of old history ============================================
-- 30 days for Free shops, 1 year for Pro (purge_old_entry_history, migration 0006).
-- Scheduled with Supabase cron (the pg_cron extension) at 20:15 UTC = 01:45 in Sri Lanka.
-- If the extension is not available (for example in a plain Postgres used for tests) or
-- cannot be created, the migration still succeeds and only says so.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.unschedule(jobid) from cron.job where jobname = 'purge-old-entry-history';
    perform cron.schedule('purge-old-entry-history', '15 20 * * *', 'select public.purge_old_entry_history()');
  else
    raise notice 'pg_cron is not available: schedule purge_old_entry_history() yourself (daily)';
  end if;
exception when others then
  raise notice 'could not schedule the history cleanup (%): enable pg_cron in the dashboard and run migration 0012 again by hand', sqlerrm;
end $$;


-- ===== the old "features" setting is replaced by the feature_flags table =======
delete from app_settings where key = 'features';
