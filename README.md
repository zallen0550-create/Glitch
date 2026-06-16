# Glitch Core MVP Prototype

A mobile-first static prototype for the Glitch collectible workflow:

Photo Dump -> AI Identification -> Review Queue -> Auto Inventory -> Value Engine -> Action Recommendations.

## Run

Open `index.html` directly in a browser.

Optional local server:

```bash
node server.js
```

Then open `http://127.0.0.1:4176`.

## Integration Notes

The current build uses mock data only. Future integrations are intentionally isolated in `app.js` under `GlitchAdapters`:

- `recognition.identifyPhotos` for AI image recognition
- `valueEngine.enrichItems` for marketplace pricing/comps
- `inventoryRepository.saveApprovedItems` for Supabase persistence

## Supabase Setup

1. Create or open the Supabase project at `https://sijzigpchtkjegrrjrox.supabase.co`.
2. Run `supabase/schema.sql` in the Supabase SQL editor.
3. Confirm storage buckets exist: `card-images`, `profile-images`, `uploads`.
4. Confirm `config.js` values match your project URL and publishable key.
5. Open `index.html` or run `node server.js`.

Authentication, profile loading, storage upload hooks, and inventory persistence are wired through `supabase-adapter.js`.

See `docs/supabase-setup-report.md` for the complete setup report.
