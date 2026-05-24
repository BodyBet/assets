import { blobUrlFor } from '@lib/blob-url';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SCOPES = ['email', 'brand', 'shared', 'landing', 'blog', 'portal', 'og'] as const;

async function loadScope(scope: string): Promise<Record<string, string> | null> {
  try {
    const url = blobUrlFor(`manifests/${scope}.json`);
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    const text = await res.text();
    try {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, string>;
      }
      console.error(`manifest scope ${scope}: not a plain object`);
      return null;
    } catch (parseErr) {
      console.error(`manifest scope ${scope}: invalid JSON`, parseErr);
      return null;
    }
  } catch (err) {
    console.error(`manifest scope ${scope}: fetch failed`, err);
    return null;
  }
}

export async function GET(): Promise<Response> {
  const results = await Promise.all(SCOPES.map((scope) => loadScope(scope)));

  const merged: Record<string, string> = {};
  for (const scopeManifest of results) {
    if (scopeManifest) Object.assign(merged, scopeManifest);
  }

  const sorted: Record<string, string> = {};
  for (const key of Object.keys(merged).sort()) {
    sorted[key] = merged[key];
  }

  return new Response(JSON.stringify(sorted), {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'public, max-age=300, stale-while-revalidate=3600',
    },
  });
}
