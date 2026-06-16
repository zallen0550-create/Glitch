# Phase 1: Auth, Database, Storage

Status: Implemented as frontend infrastructure.

## Completed

- Supabase config placeholder in `config.js`
- Supabase REST/Auth/Storage adapter in `supabase-adapter.js`
- Database schema in `supabase/schema.sql`
- Auth UI for sign up, sign in, password reset
- Session persistence via localStorage
- Protected app shell
- Profile screen and settings screen
- Profile table fields supported:
  - username
  - display name
  - avatar
  - bio
  - collection count
  - created date
- Storage upload hook for staged photos
- Inventory insert hook for approved review items

## Not Started

- Real AI collectible identification
- Marketplace integrations
- Payments
- Social features

## Test Notes

Static syntax validation passes locally. Live Supabase behavior requires replacing placeholder values in `config.js` and running `supabase/schema.sql`.
