-- =============================================================================
-- 0010 — Small fix to 0009's entry/category trigger
--
-- An UPDATE that sends the same category_id together with an EMPTY key (some
-- clients clear the key column when they send an id) looked like "the key was
-- changed on its own" and was refused as a missing category. Only a key that
-- is actually filled in and different counts as the old way of changing the
-- category.
-- =============================================================================

create or replace function sync_entry_category() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- A new, filled-in key typed into an UPDATE on its own (the old way) means "use this category".
  if tg_op = 'UPDATE'
     and new.category is not null
     and new.category is distinct from old.category
     and new.category_id is not distinct from old.category_id then
    new.category_id := null;
  end if;

  if new.category_id is null then
    if new.category is null then
      raise exception 'category_required' using errcode = '23514';
    end if;

    select c.id into new.category_id
      from categories c
     where c.business_id = new.business_id
       and c.type = new.type::text
       and c.key = new.category;

    if new.category_id is null then
      -- The shop does not have this default category yet: copy it.
      insert into categories (business_id, type, key, icon, color, counts_as, sort)
      select new.business_id, t.type, t.key, t.icon, t.color, t.counts_as, t.sort
        from categories t
       where t.business_id is null and t.type = new.type::text and t.key = new.category
         and not t.archived
      on conflict do nothing
      returning id into new.category_id;

      -- Another request may have copied it a moment ago.
      if new.category_id is null then
        select c.id into new.category_id
          from categories c
         where c.business_id = new.business_id and c.type = new.type::text and c.key = new.category;
      end if;
    end if;

    if new.category_id is null then
      raise exception 'unknown_category' using errcode = '23514';
    end if;
  end if;

  -- Keep the key column in step with the category (empty for custom categories).
  select c.key into new.category from categories c where c.id = new.category_id;
  return new;
end $$;
