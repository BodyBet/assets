#!/usr/bin/env node
import { list, put } from '@vercel/blob';

const HASH_SUFFIX = /\.[a-f0-9]{10}$/;

function pathToManifestKey(pathname) {
  const lastDot = pathname.lastIndexOf('.');
  const withoutExt = lastDot === -1 ? pathname : pathname.slice(0, lastDot);
  const withoutHash = withoutExt.replace(HASH_SUFFIX, '');
  return withoutHash.split('/').filter(Boolean).join('.');
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--prefix') args.prefix = argv[++i];
    else if (a === '--manifest-scope') args.manifestScope = argv[++i];
  }
  return args;
}

export async function generateScopedManifest({ prefix, manifestScope, token }) {
  const assetsBaseUrl = (process.env.ASSETS_BASE_URL ?? 'https://assets.bodybet.eu').replace(
    /\/+$/,
    '',
  );

  const blobs = [];
  let cursor;
  do {
    const page = await list({ prefix: `${prefix}/`, cursor, limit: 1000, token });
    blobs.push(...page.blobs);
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);

  const latestByKey = new Map();
  for (const blob of blobs) {
    if (blob.pathname.startsWith('manifests/')) continue;
    const key = pathToManifestKey(blob.pathname);
    if (!key) continue;
    const current = latestByKey.get(key);
    const uploadedAt = new Date(blob.uploadedAt).getTime();
    if (!current || uploadedAt > current.uploadedAt) {
      latestByKey.set(key, { pathname: blob.pathname, uploadedAt });
    }
  }

  const manifest = {};
  for (const key of [...latestByKey.keys()].sort()) {
    manifest[key] = `${assetsBaseUrl}/${latestByKey.get(key).pathname}`;
  }

  const manifestPathname = `manifests/${manifestScope}.json`;
  const result = await put(manifestPathname, JSON.stringify(manifest, null, 2), {
    access: 'public',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/json',
    token,
  });

  console.log(
    `[manifest] wrote ${manifestPathname} with ${Object.keys(manifest).length} entries`,
  );
  return result.url;
}

async function main() {
  const { prefix, manifestScope } = parseArgs(process.argv.slice(2));
  if (!prefix || !manifestScope) {
    console.error(
      'usage: generate-scoped-manifest.mjs --prefix <blob-prefix> --manifest-scope <scope>',
    );
    process.exit(2);
  }
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    console.error('BLOB_READ_WRITE_TOKEN env var is required');
    process.exit(2);
  }
  await generateScopedManifest({ prefix, manifestScope, token });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
