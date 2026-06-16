# Glitch TestFlight Readiness

## Current MVP Features

- Account sign in, sign up, password reset, sign out, and session restore through Supabase Auth.
- First-run onboarding with a Start Scanning CTA.
- Bulk Scan Collection demo flow.
- Multi-image upload with selected count, thumbnails, upload states, and batch processing status.
- Server-side `/api/identify` endpoint for AI identification.
- Supabase Storage upload path for collectible photos.
- Scan record creation in `scans`.
- Review item creation in `review_items`.
- Review Queue with category filters, edit before approval, approve all, reject all, and individual approve/reject.
- Inventory creation in `inventory_items`.
- Inventory search, category filters, item cards, empty states, and item detail view.
- Profile screen and Settings screen with storage health, profile summary, version/build, and dev mode warning.

## Required Server Env Vars

- `NODE_ENV=production`
- `GLITCH_ALLOW_MOCK_AI=false`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `OPENAI_VISION_MODEL`

## Dev Settings To Disable

- Set `appEnvironment` to `production` in `config.js`.
- Set `devAuthBypass.enabled` to `false` in `config.js`.
- Confirm no existing local `dev-local-session` can restore after production config is enabled.
- Confirm mock AI is blocked when `NODE_ENV=production`.

## Manual QA Checklist

- Sign in with a real Supabase account.
- Refresh the app and confirm the session restores.
- Open Dashboard and tap Bulk Scan Collection.
- Confirm batch processing shows upload progress, AI progress, identified count, unknown count, and estimated total value.
- Open Review Queue.
- Filter by category.
- Edit one item before approval.
- Approve All.
- Confirm Inventory is created.
- Confirm inventory summary shows item count, category breakdown, and total estimated value.
- Open an item detail screen.
- Sign out.
- Confirm protected screens require sign in again.

## Production Guard Audit

- `devAuthBypass` is disabled when `appEnvironment` is `production`.
- Existing DEV sessions are cleared when production config is active.
- Mock AI is blocked in production by `NODE_ENV=production` and `GLITCH_ALLOW_MOCK_AI=false`.
- `OPENAI_API_KEY` is read only by `server.js`.
- `SUPABASE_SERVICE_ROLE_KEY` is read only by `server.js`.
- Frontend code uses only the Supabase publishable key and calls `/api/identify` for AI work.
- Server startup logs missing env vars without exposing secret values.

## Known Limitations

- The app is still a web prototype, not a native iOS project yet.
- Real OpenAI image identification needs production prompt tuning and real-world photo QA.
- Marketplace selling, payments, social, crypto, and auto-listing are intentionally excluded.
- Storage bucket metadata verification requires `SUPABASE_SERVICE_ROLE_KEY` on the server.
- App Store metadata URLs are placeholders until final privacy/support/terms pages are published.
- No push notifications, background sync, or offline mode yet.

## Exact Next Technical Path To iPhone/TestFlight

1. Convert the current web app into an iOS wrapper using Capacitor.
2. Create a production-hosted backend for `server.js` with the required env vars.
3. Update `config.js` for production:
   - `appEnvironment: "production"`
   - `devAuthBypass.enabled: false`
   - `apiBaseUrl` pointing to the hosted backend
4. Run the full manual QA checklist against the hosted backend.
5. Add iOS app assets: icon, launch screen, display name, bundle id, and permissions text.
6. Build the iOS app in Xcode.
7. Archive the app and upload to App Store Connect.
8. Add TestFlight internal testers.
9. Run TestFlight QA on a real iPhone.
10. Fix only MVP-blocking bugs before App Store submission.
