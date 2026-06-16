# Glitch Supabase Setup Report

## Project

- Supabase URL: `https://sijzigpchtkjegrrjrox.supabase.co`
- Frontend config file: `config.js`
- Publishable key: configured in `config.js`

## Environment Variables

For a future bundled/mobile build, use:

```text
SUPABASE_URL=https://sijzigpchtkjegrrjrox.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_OfprXwmmoHupkt-3rf6EMQ_VEtlcxTe
SUPABASE_CARD_IMAGES_BUCKET=card-images
SUPABASE_PROFILE_IMAGES_BUCKET=profile-images
SUPABASE_UPLOADS_BUCKET=uploads
```

Do not expose a Supabase service role key in the frontend.

## Authentication

Email/password authentication is wired in the frontend through `supabase-adapter.js`.

In Supabase Dashboard:

1. Go to Authentication -> Providers.
2. Enable Email.
3. Configure Confirm email according to launch preference.
4. Set Site URL to the production app URL when available.
5. Add redirect URLs for local testing and production.

## Database

Run `supabase/schema.sql` in the Supabase SQL editor.

Created tables:

- `users`
- `profiles`
- `inventory`
- `review_items`
- `scans`
- `listings`
- `watchlists`
- `messages`
- `item_photos`

Compatibility view:

- `inventory_items`

## Storage

Created buckets:

- `card-images`
- `profile-images`
- `uploads`

Storage policies scope files to folders named by `auth.uid()`.

## RLS

RLS is enabled on all app tables. Policies restrict users to their own rows.

## Marketplace Readiness

Marketplace-ready fields are included for future integrations:

- `marketplace_source`
- `marketplace_ids`
- `marketplace_payload`
- `external_listing_id`
- `external_reference`
- listing `marketplace`

Prepared targets:

- eBay
- Whatnot
- TCGplayer
- Shopify
- BrickLink

## Current Limitations

- SQL must be run from Supabase Dashboard or CLI with privileged credentials.
- The frontend only has a publishable key and cannot create tables or policies by itself.
- Real AI identification and marketplace APIs remain intentionally out of scope for this phase.
