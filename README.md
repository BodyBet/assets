# bodybet-assets

Public asset delivery for BodyBet. Serves files from Vercel Blob behind `https://assets.bodybet.eu/...`, plus a merged manifest at `https://assets.bodybet.eu/manifest.json`.

## Why Next.js, not NestJS

This service does two things: stream files from Vercel Blob behind a custom domain, and merge a few JSON files into one. Next.js App Router gives us route handlers, zero-config deployment on Vercel (same-region access to Blob), and edge CDN caching driven by `Cache-Control` headers — without the DI container, decorators, or separate server process that NestJS would add.

## What lives where

| Use case | Stored in |
|---|---|
| Public web / brand / email / static visuals (email images, landing images, blog images, portal static visuals, logos, Open Graph images, brand/shared media) | **Vercel Blob** (this project) |
| Avatars, challenge videos, proof images, signed / private media, anything tied to auth / DB rows / game state | **Supabase Storage** |

Rule of thumb: if it's user-generated, gated, or part of game state → Supabase. If it's shipped by the team and the same for every visitor → Vercel Blob via `assets.bodybet.eu`.

## Architecture

- Blob layout:
  ```
  email/...
  brand/...
  shared/...
  landing/...
  blog/...
  portal/...
  og/...
  manifests/email.json
  manifests/brand.json
  manifests/shared.json
  manifests/landing.json
  manifests/blog.json
  manifests/portal.json
  manifests/og.json
  ```
- Each repo owns its own scope. `landingpage` writes only to `landing/*` and `manifests/landing.json`; `blog` writes only to `blog/*` and `manifests/blog.json`. No write collisions.
- The merged manifest at `/manifest.json` is built **at read time** by fetching every `manifests/<scope>.json` in parallel and merging them.

## Versioning: content-hashed pathnames, clean sources

Source repos keep clean filenames (`hero.webp`). The upload script computes the first 10 hex chars of the file's SHA-256 and uploads as `<scope>/<rel>/<stem>.<hash>.<ext>`.

- Unchanged content → same hash → same URL → no re-upload, no cache bust.
- Changed content → new hash → new URL → CDN serves the new bytes; the old URL still works until pruned.
- Source filenames **must** be kebab-case with no `.` in the stem (the script rejects `my.dotted.name.webp`).

## How to add a central asset (email / brand / shared / og)

1. Drop the file under `assets/<scope>/<path>/<name>.<ext>` in **this** repo (e.g. `assets/email/welcome/newsletter-welcome.webp`).
2. Commit and push to `main`.
3. The `Upload central assets` workflow hashes the file, uploads it to Blob, and regenerates `manifests/<scope>.json`.

## How another repo uploads its own assets

`landingpage`, `blog`, and `app` (portal) keep their assets in their own repos and call the reusable composite action. Example workflow in the calling repo:

```yaml
name: Upload public assets
on:
  push:
    branches: [main]
    paths:
      - 'public-assets/**'
      - '.github/workflows/upload-public-assets.yml'

jobs:
  upload:
    runs-on: ubuntu-latest
    env:
      BLOB_READ_WRITE_TOKEN: ${{ secrets.BLOB_READ_WRITE_TOKEN }}
    steps:
      - uses: actions/checkout@v4
      - uses: bodybet/bodybet-assets/.github/actions/upload-assets@main
        with:
          source: public-assets
          prefix: landing          # or: blog, portal
          manifest-scope: landing  # or: blog, portal
```

The caller only needs:
- A folder of clean-named assets at `inputs.source`.
- `BLOB_READ_WRITE_TOKEN` exposed as an env var on the job (so the composite action picks it up).

## Consuming the manifest

```ts
const res = await fetch('https://assets.bodybet.eu/manifest.json', { next: { revalidate: 300 } });
const manifest = await res.json() as Record<string, string>;

const heroUrl = manifest['landing.home.hero'];
// → https://assets.bodybet.eu/landing/home/hero.b1d2c3e4f5.webp
```

**Key convention (kebab-path):** take the blob pathname → strip extension → strip trailing `.<hash>` → split on `/` → join with `.`.

| Blob pathname | Manifest key |
|---|---|
| `email/welcome/newsletter-welcome.<hash>.webp` | `email.welcome.newsletter-welcome` |
| `landing/home/hero.<hash>.webp` | `landing.home.hero` |
| `blog/posts/example-post/header.<hash>.webp` | `blog.posts.example-post.header` |
| `portal/icons/trophy.<hash>.svg` | `portal.icons.trophy` |

Cache: the manifest itself is served with `Cache-Control: public, max-age=300, stale-while-revalidate=3600`. Refetch every few minutes (or per request in dev). Always go via the manifest — direct URLs change when content changes.

## Direct URLs

Pattern: `https://assets.bodybet.eu/<scope>/<path>/<name>.<hash>.<ext>`. Use these only if you've resolved them from the manifest at build time. Hard-coding a hashed URL in source is fine if you accept that you'll need to bump it whenever the asset changes.

Approved extensions: `.webp .png .jpg .jpeg .svg .gif .ico .json`. Anything else returns 404.

## Routing details

- `GET /manifest.json` — merges every `manifests/<scope>.json` in parallel. Missing scopes are skipped silently; invalid JSON is logged and skipped.
- `GET /:path*` — validates the path (no `..`, no hidden segments, extension allowlisted), proxies the file from Vercel Blob, and returns it with `Cache-Control: public, max-age=31536000, immutable`. Returns plain 404 on any error — no stack traces, no upstream details leaked.

## Environment variables

| Var | Where | Purpose |
|---|---|---|
| `BLOB_READ_WRITE_TOKEN` | Secret. Only in CI (upload workflows) | Authorises uploads to Vercel Blob |
| `BLOB_PUBLIC_BASE_URL` | Public env var. Set on the Vercel project | Base of the Blob store, e.g. `https://abc123.public.blob.vercel-storage.com` |
| `ASSETS_BASE_URL` | Optional. Default `https://assets.bodybet.eu` | Used by the manifest generator to build manifest values |

## Local development

```bash
npm install
npm run dev   # localhost:3010
# requires BLOB_PUBLIC_BASE_URL set in .env.local to a real Blob store
```

To dry-run an upload locally:

```bash
BLOB_READ_WRITE_TOKEN=... node scripts/upload-assets-to-blob.mjs \
  --source assets/email --prefix email --manifest-scope email
```
