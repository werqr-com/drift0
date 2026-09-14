# Drift0 - Ballistics Calculator

A precision ballistics calculator built with Astro and React, with optional accounts and a synced DOPE logbook.

## Technology Stack

- **Astro** - SSR on Cloudflare Workers
- **React** - Interactive UI components
- **TypeScript** - Type-safe development
- **Supabase** - Auth (email/password) + Postgres for rifles, locations, and DOPE entries

## Project Structure

```
drift0/
├── src/
│   ├── components/      # React components (App, Calculator, DopeLog, AccountPanel, …)
│   ├── lib/
│   │   ├── ballistics.ts
│   │   ├── truing.ts          # MV truing from DOPE
│   │   ├── dopeAggregate.ts
│   │   ├── offlineQueue.ts    # Offline DOPE queue
│   │   └── supabase/          # Server client + types
│   ├── pages/
│   │   ├── api/               # calculate, auth, rifles, locations, dope, true, profile
│   │   ├── login.astro / register.astro / forgot-password.astro
│   │   └── index.astro
│   └── styles/global.css
├── supabase/migrations/       # Schema + RLS
├── astro.config.mjs
└── package.json
```

## Development

```bash
# Install dependencies
npm install

# Copy env (see below) then:
npm run dev

# Unit tests (truing + DOPE aggregation)
npm test

# Build for production
npm run build
```

### Environment variables

Create `.env` (and optionally `.dev.vars` for Wrangler):

```bash
PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Apply migrations from `supabase/migrations/` to your Supabase project. In the Auth dashboard set:

- Site URL: `https://drift0.werqr.com` (and `http://localhost:8080` for local)
- Redirect URLs: `http://localhost:8080/**`, `https://drift0.werqr.com/**`

Set the same `PUBLIC_*` vars in Cloudflare Pages/Workers build settings for production.

Calculator and Scope Adjustment work without signing in. DOPE sync, account panel, and velocity truing require an account.

## Features

- **Ballistics Calculations** — trajectory with MV, BC, atmosphere, wind, zero, sight height
- **Accounts** — email/password signup/login, account panel for profile, rifles, and locations
- **DOPE logbook** — Card / Entries / Chart views; filter by rifle and location; on-range quick-add with offline queue
- **DOPE → calculator** — overlay recorded corrections next to predictions; **True to DOPE** solves muzzle velocity
- **Unit Systems** — Imperial / Metric
- **Scope Adjustment** — MOA/MIL clicks; **Save as DOPE** when signed in
- **Cartridge Presets** — common factory loads

## Deployment

### Cloudflare Workers/Pages

See [CLOUDFLARE_DEPLOYMENT.md](./CLOUDFLARE_DEPLOYMENT.md).

```bash
npm run cf:build-deploy
```

## API

### POST `/api/calculate`

Calculate ballistics trajectory (metric input/output). Rate-limited.

Authenticated JSON APIs (cookie session):

- `POST /api/auth/{signup,login,logout,forgot,reset}`
- `GET|PUT /api/profile`
- `GET|POST /api/rifles`, `PUT|DELETE /api/rifles/:id`
- `GET|POST /api/locations`, `PUT|DELETE /api/locations/:id`
- `GET|POST /api/dope`, `PUT|DELETE /api/dope/:id` (upsert on `client_id` for offline sync)
- `POST /api/true` — muzzle-velocity truing from a rifle’s DOPE

## License

Copyright © 2024
