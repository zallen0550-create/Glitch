# Zach Next Steps

## Backend Hosting On Render

- [ ] Create a Render account.
- [ ] Create a new Web Service.
- [ ] Connect the GitHub repo or upload the Glitch project.
- [ ] Set the build command:

```bash
npm install
```

- [ ] Set the start command:

```bash
node server.js
```

- [ ] Add environment variables in Render.

## Values Needed From Supabase

Get these from the Supabase project dashboard:

- [ ] Supabase Project URL
  - Example format: `https://your-project-ref.supabase.co`
- [ ] Supabase publishable/anon key
  - Used as `SUPABASE_ANON_KEY`
- [ ] Supabase service role key
  - Used as `SUPABASE_SERVICE_ROLE_KEY`
  - Keep this server-only.
  - Never put this in `config.js`, frontend code, iOS files, screenshots, or public repos.

## Values Needed From OpenAI

Get this from the OpenAI platform dashboard:

- [ ] OpenAI API key
  - Used as `OPENAI_API_KEY`
  - Keep this server-only.
  - Never put this in `config.js`, frontend code, iOS files, screenshots, or public repos.

Optional:

- [ ] OpenAI vision model name
  - Used as `OPENAI_VISION_MODEL`
  - Current recommended placeholder: `gpt-4.1-mini`

## Render Environment Variables

Add these in Render:

```bash
NODE_ENV=production
GLITCH_ALLOW_MOCK_AI=false
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_publishable_or_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
OPENAI_API_KEY=your_openai_api_key
OPENAI_VISION_MODEL=gpt-4.1-mini
```

## Deploy Backend

- [ ] Deploy the Render Web Service.
- [ ] Wait for Render to show the service as live.
- [ ] Copy the Render backend URL.
  - Example format: `https://glitch-backend.onrender.com`

## Connect The App To The Backend

- [ ] Open `config.js`.
- [ ] Set `apiBaseUrl` to the Render URL:

```js
apiBaseUrl: "https://your-render-url.onrender.com"
```

- [ ] Confirm production settings:

```js
appEnvironment: "production",
devAuthBypass: {
  enabled: false
}
```

## Build Capacitor Web Assets

Run:

```bash
npm run build:cap
```

Then run:

```bash
npx cap sync ios
```

## Move To Mac / Xcode

- [ ] Move the project to a Mac with Xcode installed.
- [ ] Open the iOS project:

```bash
npx cap open ios
```

- [ ] Select the Apple Developer Team.
- [ ] Confirm app name: `Glitch`.
- [ ] Confirm bundle id: `com.glitch.collectibles`.
- [ ] Set version: `1.0.0`.
- [ ] Set build: `1`.
- [ ] Add final app icon and launch screen assets.
- [ ] Run on a real iPhone.
- [ ] Archive in Xcode.
- [ ] Upload to App Store Connect.
- [ ] Add internal TestFlight testers.
- [ ] Run the MVP QA checklist from `docs/testflight-readiness.md`.
