# Glitch Backend Deployment

## What `server.js` Does

`server.js` is the lightweight backend for the Glitch MVP.

It serves two roles:

- Serves the local static prototype during development.
- Provides server-side API routes needed by the mobile app.

Current API routes:

- `POST /api/identify`
  - Requires a Supabase user bearer token.
  - Looks up the authenticated Supabase user.
  - Creates a scan record in `scans`.
  - Runs AI identification through OpenAI when configured.
  - Creates review queue rows in `review_items`.
  - Returns the completed scan and review items.

- `GET /api/storage-health`
  - Checks required Supabase Storage buckets.
  - Requires `SUPABASE_SERVICE_ROLE_KEY` on the server to verify bucket metadata.
  - Returns status for:
    - `card-images`
    - `uploads`
    - `profile-images`

The iPhone app does not run `server.js`. TestFlight builds must call a hosted backend URL.

## Required Environment Variables

Production backend:

```bash
NODE_ENV=production
GLITCH_ALLOW_MOCK_AI=false
SUPABASE_URL=https://sijzigpchtkjegrrjrox.supabase.co
SUPABASE_ANON_KEY=your_supabase_publishable_or_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
OPENAI_API_KEY=your_openai_api_key
OPENAI_VISION_MODEL=gpt-4.1-mini
POKEMON_TCG_API_KEY=optional_pokemon_tcg_api_key
TCGPLAYER_API_KEY=optional_tcgplayer_api_key
EBAY_BEARER_TOKEN=optional_ebay_bearer_token
PORT=4176
```

Notes:

- `OPENAI_VISION_MODEL` can be changed later.
- `POKEMON_TCG_API_KEY` improves Pokemon TCG database reliability but the public API may still work without it.
- `TCGPLAYER_API_KEY` and `EBAY_BEARER_TOKEN` are reserved for direct marketplace pricing once those partner/API credentials are approved.
- `PORT` may be assigned automatically by the host.
- Never expose `SUPABASE_SERVICE_ROLE_KEY` to frontend code, iOS code, or public repos.

## Recommended Hosting Options

Best simple options:

- Render Web Service
- Replit Deployments
- Railway
- Fly.io

Recommended for Zach right now:

- Use Render first.
- It is straightforward for a Node backend, supports environment variables, gives a public HTTPS URL, and is easy to connect to a GitHub repo later.

## Deploy To Render

1. Create a Render account.
2. Create a new Web Service.
3. Connect the Glitch repo or upload the project.
4. Runtime: Node.
5. Build command:

```bash
npm install
```

6. Start command:

```bash
node server.js
```

7. Add environment variables:

```bash
NODE_ENV=production
GLITCH_ALLOW_MOCK_AI=false
SUPABASE_URL=https://sijzigpchtkjegrrjrox.supabase.co
SUPABASE_ANON_KEY=your_supabase_publishable_or_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
OPENAI_API_KEY=your_openai_api_key
OPENAI_VISION_MODEL=gpt-4.1-mini
POKEMON_TCG_API_KEY=optional_pokemon_tcg_api_key
TCGPLAYER_API_KEY=optional_tcgplayer_api_key
EBAY_BEARER_TOKEN=optional_ebay_bearer_token
```

8. Deploy.
9. Copy the Render HTTPS URL.

Example:

```text
https://glitch-backend.onrender.com
```

## Deploy To Replit

1. Create a new Replit project.
2. Choose Node.js.
3. Upload or import the Glitch project.
4. Add Secrets in Replit:

```bash
NODE_ENV=production
GLITCH_ALLOW_MOCK_AI=false
SUPABASE_URL=https://sijzigpchtkjegrrjrox.supabase.co
SUPABASE_ANON_KEY=your_supabase_publishable_or_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
OPENAI_API_KEY=your_openai_api_key
OPENAI_VISION_MODEL=gpt-4.1-mini
POKEMON_TCG_API_KEY=optional_pokemon_tcg_api_key
TCGPLAYER_API_KEY=optional_tcgplayer_api_key
EBAY_BEARER_TOKEN=optional_ebay_bearer_token
```

5. Set the run command:

```bash
node server.js
```

6. Start the app.
7. Use the public Replit HTTPS URL as the backend URL.

## Set `apiBaseUrl` After Deployment

After the backend is hosted, update `config.js` before building the iOS app:

```js
apiBaseUrl: "https://your-hosted-backend.example.com",
appEnvironment: "production",
devAuthBypass: {
  enabled: false
}
```

Then rebuild/sync Capacitor:

```bash
npm run build:cap
npx cap sync ios
```

## Test `/api/storage-health`

Open this URL in a browser:

```text
https://your-hosted-backend.example.com/api/storage-health
```

Expected successful response:

```json
{
  "ok": true,
  "buckets": [
    { "bucket": "card-images", "exists": true },
    { "bucket": "uploads", "exists": true },
    { "bucket": "profile-images", "exists": true }
  ]
}
```

If `SUPABASE_SERVICE_ROLE_KEY` is missing, the response will say server key verification is required.

## Test `/api/identify`

This endpoint requires a real Supabase user access token.

Basic test shape:

```bash
curl -X POST "https://your-hosted-backend.example.com/api/identify" \
  -H "Authorization: Bearer YOUR_SUPABASE_USER_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "photos": [
      {
        "bucket": "card-images",
        "path": "USER_ID/example.jpg",
        "url": "https://sijzigpchtkjegrrjrox.supabase.co/storage/v1/object/public/card-images/USER_ID/example.jpg"
      }
    ]
  }'
```

Expected result:

- A scan row is created in `scans`.
- One or more review rows are created in `review_items`.
- JSON response includes `scan` and `reviewItems`.

## Security Notes

- `OPENAI_API_KEY` must stay server-only.
- `SUPABASE_SERVICE_ROLE_KEY` must stay server-only.
- Never put `SUPABASE_SERVICE_ROLE_KEY` in:
  - `config.js`
  - frontend JavaScript
  - Capacitor/iOS app files
  - App Store builds
  - screenshots
  - public repos
- The frontend/iOS app should only use the Supabase publishable/anon key.
- The iOS app should call `/api/identify`; it should never call OpenAI directly.
- The service role key can bypass Row Level Security, so treat it like a master key.
