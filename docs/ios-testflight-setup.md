# Glitch iOS TestFlight Setup

## Current Capacitor Setup

- App name: `Glitch`
- Bundle id placeholder: `com.glitch.collectibles`
- Capacitor web output folder: `www`
- Native iOS project: `ios/App/App.xcodeproj`
- Static web files are copied from the project root into `www` by `scripts/prepare-capacitor-web.js`.

The existing web MVP is not rewritten. Capacitor packages the current static app into an iOS shell.

## Important Backend Note

`server.js` does not run inside the iPhone app.

Before TestFlight, host `server.js` separately and set `apiBaseUrl` in `config.js` to the hosted backend URL. The hosted backend needs:

- `NODE_ENV=production`
- `GLITCH_ALLOW_MOCK_AI=false`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `OPENAI_VISION_MODEL`

## Local Windows Commands

Install dependencies:

```bash
npm install
```

If npm cannot write to the default cache on Windows, use the local project cache:

```bash
npm install --cache ./.npm-cache
```

Prepare Capacitor web assets:

```bash
npm run build:cap
```

Sync iOS after any web app change:

```bash
npm run cap:sync:ios
```

## Mac/Xcode Commands

On a Mac with Xcode installed, open the iOS project:

```bash
npx cap open ios
```

Or open directly:

```bash
open ios/App/App.xcodeproj
```

In Xcode:

1. Select the `App` target.
2. Confirm Display Name is `Glitch`.
3. Confirm Bundle Identifier is `com.glitch.collectibles`.
4. Select your Apple Developer Team.
5. Set Version to `1.0.0`.
6. Set Build to `1`.
7. Add production app icon and launch assets.
8. Build and run on a real iPhone.
9. Archive the app.
10. Upload to App Store Connect.
11. Add internal TestFlight testers.

## Production Config Before TestFlight

Update `config.js` before syncing/building the TestFlight build:

```js
appEnvironment: "production",
apiBaseUrl: "https://your-hosted-glitch-api.example.com",
devAuthBypass: {
  enabled: false
}
```

Then run:

```bash
npm run cap:sync:ios
```

## Manual QA On Real iPhone

- Sign in with a real Supabase account.
- Refresh/relaunch and confirm session restore.
- Run Bulk Scan Collection.
- Confirm batch progress appears.
- Open Review Queue.
- Edit one item.
- Approve All.
- Confirm Inventory summary appears.
- Open an item detail.
- Sign out.
- Confirm protected app screens require sign in again.

## What Still Requires Mac/Xcode

- Running the iOS app in Simulator.
- Running the app on a physical iPhone.
- Configuring signing/team/provisioning.
- Adding final app icon and launch screen assets.
- Creating an archive.
- Uploading to App Store Connect.
- Submitting to TestFlight.
