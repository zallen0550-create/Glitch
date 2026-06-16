-- Glitch Phase 1 verification helper
-- Run this in Supabase SQL Editor after running schema.sql.

notify pgrst, 'reload schema';

select
  table_schema,
  table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'users',
    'profiles',
    'inventory',
    'inventory_items',
    'scans',
    'listings',
    'watchlists',
    'messages',
    'review_items',
    'item_photos'
  )
order by table_name;

select
  id,
  name,
  public
from storage.buckets
where id in ('card-images', 'profile-images', 'uploads')
order by id;
