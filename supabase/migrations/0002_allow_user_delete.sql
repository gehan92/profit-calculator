-- =============================================================================
-- 0002 — Let users be deleted (Part F5 "full delete for users", Delete account
-- in Part D2, Delete user in Part D4).
--
-- Problem: five "who did it" columns pointed at auth.users with no delete rule,
-- so Postgres refused to delete anyone who had written an entry, invited a
-- person, created an invite, changed a setting or done an admin action.
--
-- Rule now:
--   * The person's own shop is still deleted with them (businesses.owner_id
--     cascade, unchanged), and everything in it.
--   * Rows they wrote in someone else's shop stay: they are that owner's
--     records. Only the "written by" link becomes empty (null).
--   * Audit log rows stay as history, without the link.
--
-- RLS is unchanged: inserts still need created_by = auth.uid(), so new rows
-- always have an author; only a deleted person's old rows lose it.
-- =============================================================================

alter table entries
  alter column created_by drop not null,
  drop constraint entries_created_by_fkey,
  add constraint entries_created_by_fkey
    foreign key (created_by) references auth.users (id) on delete set null;

alter table invites
  alter column created_by drop not null,
  drop constraint invites_created_by_fkey,
  add constraint invites_created_by_fkey
    foreign key (created_by) references auth.users (id) on delete set null;

alter table business_members
  drop constraint business_members_invited_by_fkey,
  add constraint business_members_invited_by_fkey
    foreign key (invited_by) references auth.users (id) on delete set null;

alter table audit_log
  drop constraint audit_log_actor_id_fkey,
  add constraint audit_log_actor_id_fkey
    foreign key (actor_id) references auth.users (id) on delete set null;

alter table app_settings
  drop constraint app_settings_updated_by_fkey,
  add constraint app_settings_updated_by_fkey
    foreign key (updated_by) references auth.users (id) on delete set null;

comment on column entries.created_by is
  'Who added it. Empty (null) only after that person deleted their account.';
