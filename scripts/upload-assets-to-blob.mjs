#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFile, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, relative, sep } from 'node:path';

import { head, put, BlobNotFoundError } from '@vercel/blob';

import { generateScopedManifest } from './generate-scoped-manifest.mjs';

const ALLOWED_EXTENSIONS = new Set([
  '.webp',
  '.png',
  '.jpg',
  '.jpeg',
  '.svg',
  '.gif',
  '.ico',
  '.json',
]);

const CONTENT_TYPES = {
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
};

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--source') args.source = argv[++i];
    else if (a === '--prefix') args.prefix = argv[++i];
    else if (a === '--manifest-scope') args.manifestScope = argv[++i];
  }
  return args;
}

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(full)));
    } else if (entry.isFile()) {
      files.push(full);
    }
  }
  return files;
}

function hashBytes(bytes) {
  return createHash('sha256').update(bytes).digest('hex').slice(0, 10);
}

function buildBlobPathname({ prefix, sourceRoot, filePath, hash }) {
  const rel = relative(sourceRoot, filePath).split(sep).join('/');
  const lastSlash = rel.lastIndexOf('/');
  const dir = lastSlash === -1 ? '' : rel.slice(0, lastSlash);
  const leaf = lastSlash === -1 ? rel : rel.slice(lastSlash + 1);
  const dot = leaf.lastIndexOf('.');
  const stem = leaf.slice(0, dot);
  const ext = leaf.slice(dot);
  const hashedLeaf = `${stem}.${hash}${ext}`;
  return dir ? `${prefix}/${dir}/${hashedLeaf}` : `${prefix}/${hashedLeaf}`;
}

async function main() {
  const { source, prefix, manifestScope } = parseArgs(process.argv.slice(2));

  if (!source || !prefix || !manifestScope) {
    console.error(
      'usage: upload-assets-to-blob.mjs --source <folder> --prefix <blob-prefix> --manifest-scope <scope>',
    );
    process.exit(2);
  }

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    console.error('BLOB_READ_WRITE_TOKEN env var is required');
    process.exit(2);
  }

  if (!existsSync(source)) {
    console.log(`[upload] source folder missing, skipping: ${source}`);
    return;
  }
  const st = await stat(source);
  if (!st.isDirectory()) {
    console.error(`[upload] source is not a directory: ${source}`);
    process.exit(2);
  }

  const files = await walk(source);

  let uploaded = 0;
  let skipped = 0;
  let rejected = 0;

  for (const filePath of files) {
    const ext = extname(filePath).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      console.warn(`[upload] rejected (extension): ${filePath}`);
      rejected += 1;
      continue;
    }

    const leaf = filePath.split(sep).pop();
    const stem = leaf.slice(0, leaf.lastIndexOf('.'));
    if (stem.includes('.')) {
      console.error(`[upload] rejected (dotted stem): ${filePath}`);
      rejected += 1;
      continue;
    }

    const bytes = await readFile(filePath);
    const hash = hashBytes(bytes);
    const blobPathname = buildBlobPathname({
      prefix,
      sourceRoot: source,
      filePath,
      hash,
    });

    let exists = false;
    try {
      await head(blobPathname, { token });
      exists = true;
    } catch (err) {
      if (!(err instanceof BlobNotFoundError)) throw err;
    }

    if (exists) {
      skipped += 1;
      continue;
    }

    await put(blobPathname, bytes, {
      access: 'public',
      addRandomSuffix: false,
      contentType: CONTENT_TYPES[ext],
      token,
    });
    console.log(`[upload] uploaded: ${blobPathname}`);
    uploaded += 1;
  }

  const manifestUrl = await generateScopedManifest({
    prefix,
    manifestScope,
    token,
  });

  console.log(
    `[upload] done — uploaded=${uploaded} skipped=${skipped} rejected=${rejected} manifest=${manifestUrl}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
