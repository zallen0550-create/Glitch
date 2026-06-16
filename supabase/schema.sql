-- Glitch v1.0 complete Supabase schema
-- Run in Supabase SQL Editor.

begin;

create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text not null default 'collector',
  onboarding_complete boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  display_name text,
  avatar_url text,
  avatar_path text,
  bio text,
  collection_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.scans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'uploaded',
  source_bucket text,
  source_path text,
  source_url text,
  ai_provider text,
  ai_model text,
  raw_result jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.inventory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scan_id uuid references public.scans(id) on delete set null,
  name text not null,
  category text,
  series text,
  item_number text,
  year text,
  estimated_value numeric(10, 2),
  low_value numeric(10, 2),
  high_value numeric(10, 2),
  confidence integer,
  condition_estimate text,
  recommended_action text,
  marketplace_source text,
  ai_explanation text,
  photo_bucket text,
  photo_path text,
  photo_url text,
  marketplace_ids jsonb not null default '{}'::jsonb,
  marketplace_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.review_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scan_id uuid references public.scans(id) on delete set null,
  name text not null,
  category text,
  series text,
  estimated_value numeric(10, 2),
  low_value numeric(10, 2),
  high_value numeric(10, 2),
  confidence integer,
  condition_estimate text,
  recommended_action text,
  marketplace_source text,
  ai_explanation text,
  photo_bucket text,
  photo_url text,
  photo_path text,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  inventory_id uuid references public.inventory(id) on delete cascade,
  marketplace text not null,
  external_listing_id text,
  status text not null default 'draft',
  title text,
  price numeric(10, 2),
  currency text not null default 'USD',
  marketplace_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.watchlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  category text,
  series text,
  target_price numeric(10, 2),
  marketplace text,
  external_reference text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  thread_id uuid not null default gen_random_uuid(),
  sender_type text not null default 'system',
  subject text,
  body text not null,
  read_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.item_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  inventory_id uuid references public.inventory(id) on delete cascade,
  review_item_id uuid references public.review_items(id) on delete cascade,
  scan_id uuid references public.scans(id) on delete set null,
  bucket text not null,
  storage_path text not null,
  public_url text,
  created_at timestamptz not null default now()
);

-- Backward-compatible view for the current frontend adapter name.
create or replace view public.inventory_items as
select
  id,
  user_id,
  scan_id,
  name,
  category,
  series,
  estimated_value,
  low_value,
  high_value,
  confidence,
  condition_estimate,
  recommended_action,
  marketplace_source,
  ai_explanation,
  photo_url,
  photo_path,
  created_at,
  updated_at
from public.inventory;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email)
  values (new.id, new.email)
  on conflict (id) do update set email = excluded.email, updated_at = now();

  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    lower(regexp_replace(coalesce(split_part(new.email, '@', 1), 'collector'), '[^a-zA-Z0-9_]', '_', 'g')),
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1), 'Collector')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

drop trigger if exists users_set_updated_at on public.users;
drop trigger if exists profiles_set_updated_at on public.profiles;
drop trigger if exists scans_set_updated_at on public.scans;
drop trigger if exists inventory_set_updated_at on public.inventory;
drop trigger if exists review_items_set_updated_at on public.review_items;
drop trigger if exists listings_set_updated_at on public.listings;
drop trigger if exists watchlists_set_updated_at on public.watchlists;

create trigger users_set_updated_at before update on public.users for each row execute function public.set_updated_at();
create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger scans_set_updated_at before update on public.scans for each row execute function public.set_updated_at();
create trigger inventory_set_updated_at before update on public.inventory for each row execute function public.set_updated_at();
create trigger review_items_set_updated_at before update on public.review_items for each row execute function public.set_updated_at();
create trigger listings_set_updated_at before update on public.listings for each row execute function public.set_updated_at();
create trigger watchlists_set_updated_at before update on public.watchlists for each row execute function public.set_updated_at();

alter table public.users enable row level security;
alter table public.profiles enable row level security;
alter table public.scans enable row level security;
alter table public.inventory enable row level security;
alter table public.review_items enable row level security;
alter table public.listings enable row level security;
alter table public.watchlists enable row level security;
alter table public.messages enable row level security;
alter table public.item_photos enable row level security;

drop policy if exists "users_select_own" on public.users;
drop policy if exists "users_update_own" on public.users;
drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "scans_all_own" on public.scans;
drop policy if exists "inventory_all_own" on public.inventory;
drop policy if exists "review_items_all_own" on public.review_items;
drop policy if exists "listings_all_own" on public.listings;
drop policy if exists "watchlists_all_own" on public.watchlists;
drop policy if exists "messages_all_own" on public.messages;
drop policy if exists "item_photos_all_own" on public.item_photos;

create policy "users_select_own" on public.users for select using (auth.uid() = id);
create policy "users_update_own" on public.users for update using (auth.uid() = id);

create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);

create policy "scans_all_own" on public.scans for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "inventory_all_own" on public.inventory for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "review_items_all_own" on public.review_items for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "listings_all_own" on public.listings for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "watchlists_all_own" on public.watchlists for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "messages_all_own" on public.messages for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "item_photos_all_own" on public.item_photos for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values
  ('card-images', 'card-images', true),
  ('profile-images', 'profile-images', true),
  ('uploads', 'uploads', false)
on conflict (id) do nothing;

drop policy if exists "card_images_select_own_folder" on storage.objects;
drop policy if exists "card_images_insert_own_folder" on storage.objects;
drop policy if exists "card_images_update_own_folder" on storage.objects;
drop policy if exists "card_images_delete_own_folder" on storage.objects;
drop policy if exists "profile_images_select_own_folder" on storage.objects;
drop policy if exists "profile_images_insert_own_folder" on storage.objects;
drop policy if exists "profile_images_update_own_folder" on storage.objects;
drop policy if exists "profile_images_delete_own_folder" on storage.objects;
drop policy if exists "uploads_select_own_folder" on storage.objects;
drop policy if exists "uploads_insert_own_folder" on storage.objects;
drop policy if exists "uploads_update_own_folder" on storage.objects;
drop policy if exists "uploads_delete_own_folder" on storage.objects;

create policy "card_images_select_own_folder" on storage.objects for select using (bucket_id = 'card-images' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "card_images_insert_own_folder" on storage.objects for insert with check (bucket_id = 'card-images' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "card_images_update_own_folder" on storage.objects for update using (bucket_id = 'card-images' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "card_images_delete_own_folder" on storage.objects for delete using (bucket_id = 'card-images' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "profile_images_select_own_folder" on storage.objects for select using (bucket_id = 'profile-images' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "profile_images_insert_own_folder" on storage.objects for insert with check (bucket_id = 'profile-images' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "profile_images_update_own_folder" on storage.objects for update using (bucket_id = 'profile-images' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "profile_images_delete_own_folder" on storage.objects for delete using (bucket_id = 'profile-images' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "uploads_select_own_folder" on storage.objects for select using (bucket_id = 'uploads' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "uploads_insert_own_folder" on storage.objects for insert with check (bucket_id = 'uploads' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "uploads_update_own_folder" on storage.objects for update using (bucket_id = 'uploads' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "uploads_delete_own_folder" on storage.objects for delete using (bucket_id = 'uploads' and auth.uid()::text = (storage.foldername(name))[1]);

commit;
