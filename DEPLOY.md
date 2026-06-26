# Deploying the Apex Phase-1 hosted app

The app is a **persistent Node server** (not serverless), so it runs unchanged on any
container host. Zach then just opens the resulting URL — no install on his end.

## Option A — Render (recommended, free, one-click)

1. Click: **https://render.com/deploy?repo=https://github.com/MABAIStrategies/apex-abstracts-v2**
2. Sign in with GitHub and authorize access to the `apex-abstracts-v2` repo.
3. Render reads `render.yaml`, builds the `Dockerfile`, and deploys.
4. You get a public URL like `https://apex-abstracts.onrender.com` — that's Zach's link.

Notes: Render's free tier spins the service down after ~15 min idle, so the first request
after a quiet period takes ~50s to wake. Fine for a demo; upgrade to the paid tier (or keep
it warm) for production.

## Option B — Railway

1. New Project → Deploy from GitHub repo → pick `apex-abstracts-v2`.
2. Railway auto-detects the `Dockerfile` and deploys. Generate a domain in Settings.

## Option C — Fly.io (CLI)

```bash
fly launch --dockerfile Dockerfile   # accept defaults; it detects the image
fly deploy
```

## Environment variables (all optional)

| Var | Effect |
|-----|--------|
| `ATTOM_API_KEY` | When set, pulls deeper mortgage detail from ATTOM. Works fine without it. |
| `GDOC_ENDPOINT` | Apps Script `/exec` URL — enables the one-click "Generate Google Doc" button. |
| `PORT` | Injected automatically by the host. Defaults to 8787 locally. |

## If the county site throttles the host IP

The live assessor lookup is cached + paced per instance. If a hosted IP gets rate-limited,
the fastest mitigation is to pre-seed a few known-good demo addresses as an instant fallback
(ask and we'll wire it in) — the demo link then never falls flat.
