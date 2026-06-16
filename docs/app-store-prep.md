# Glitch App Store Preparation

Placeholders for v1.0 submission readiness.

## Required URLs

- Privacy Policy: `https://example.com/glitch/privacy`
- Support URL: `https://example.com/glitch/support`
- Terms of Use: `https://example.com/glitch/terms`

## Review Notes

Glitch v1.0 is a collectibles inventory app. Users can create an account, upload collectible photos, review AI-assisted identification results, and organize approved items in inventory.

The v1.0 app does not include marketplace selling, payments, crypto, social feeds, auto-haggling, or gambling mechanics.

## Data Collection Placeholder

- Account email for authentication
- Profile fields entered by the user
- Uploaded collectible photos
- Inventory and review queue records

## Age/Content Placeholder

No mature content is intentionally included. User-generated collectible photos are stored for inventory organization.

## Production Safety Checklist

- Confirm first-run onboarding appears once and routes to Scan.
- Confirm demo flow works end to end: Scan sample item -> Review result -> Approve -> Inventory -> Detail.
- Confirm bulk demo flow works end to end: Bulk Scan Collection -> Batch progress -> Review filters -> Approve All -> Inventory summary.
- Set `devAuthBypass.enabled` to `false` in `config.js` before TestFlight or App Store submission.
- Set `appEnvironment` to `production` in `config.js` before TestFlight or App Store submission.
- Set `NODE_ENV=production` on the server.
- Set `GLITCH_ALLOW_MOCK_AI=false` on the server.
- Provide server-only environment variables:
  - `OPENAI_API_KEY`
  - `OPENAI_VISION_MODEL`
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY` for server-side bucket verification only
- Keep OpenAI/API marketplace secrets out of frontend files.
- Verify required Supabase Storage buckets exist:
  - `card-images`
  - `uploads`
  - `profile-images`
- Confirm the frontend uses `/api/identify` for production AI identification.
- Confirm server startup logs show no missing production environment variables.
- Confirm v1.0 still excludes marketplace selling, payments, social feeds, crypto, and auto-listing.
