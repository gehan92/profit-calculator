-- =============================================================================
-- 0009 — Entries and categories work together
--
-- Entries can name their category two ways: the old key ('stock', used by
-- guest records, the offline queue and older app versions) or the new
-- category_id (the shop's own list, which can have custom categories).
-- This migration keeps the two in step inside the database, so every entry
-- ends up with a proper category_id whichever way it was written.
--
--   * entries_0_sync_category: a key alone is turned into the shop's category
--     with that key (copied from the default list if the shop does not have it
--     yet, e.g. 'stock' in a transport shop); a category_id alone fills in the
--     key (empty for the owner's own categories).
--   * categories are protected: type, shop and key never change (rename uses
--     `name`), so old entries can never end up in the wrong kind of category.
--   * a product brought back from the archive counts against the Free limit
--     of 20 active products, like a new one.
--   * (shop, product name) is unique among active products of a shop.
-- =============================================================================


-- ===== ENTRIES: key <-> category_id =========================================
create function sync_entry_category() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- A key typed into an UPDATE on its own (the old way) means "use this category".
  if tg_op = 'UPDATE'
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

-- Runs before entries_check_links (triggers fire in name order), which then
-- verifies that the category belongs to this shop and fits the entry's type.
create trigger entries_0_sync_category before insert or update on entries
  for each row execute function sync_entry_category();


-- ===== CATEGORIES: what may never change =====================================
create function keep_category_identity() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.type is distinct from old.type
     or new.business_id is distinct from old.business_id
     or new.key is distinct from old.key then
    raise exception 'category_identity_locked' using errcode = '23514';
  end if;
  return new;
end $$;

create trigger categories_keep_identity before update on categories
  for each row execute function keep_category_identity();


-- ===== PRODUCTS: the Free limit also applies when bringing one back ==========
create trigger products_limit_unarchive before update of archived on products
  for each row when (old.archived and not new.archived)
  execute function check_product_limit();

-- No two active products with the same name in one shop (ignoring letter case).
create unique index products_active_name_unique
  on products (business_id, lower(name)) where not archived;
