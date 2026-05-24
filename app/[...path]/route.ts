import { NextRequest } from 'next/server';

import { blobUrlFor } from '@lib/blob-url';
import { validatePath } from '@lib/path-validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function notFound(): Response {
  return new Response('Not Found', { status: 404 });
}

function cacheControlFor(pathname: string): string {
  if (pathname.startsWith('manifests/')) {
    return 'public, max-age=300, stale-while-revalidate=3600';
  }
  return 'public, max-age=31536000, immutable';
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  try {
    const { path } = await params;
    const pathname = (path ?? []).join('/');

    const validation = validatePath(pathname);
    if (!validation.ok) return notFound();

    const upstreamUrl = blobUrlFor(validation.path);
    const upstream = await fetch(upstreamUrl);
    if (!upstream.ok || !upstream.body) return notFound();

    const headers = new Headers();
    const contentType = upstream.headers.get('content-type');
    if (contentType) headers.set('content-type', contentType);
    const contentLength = upstream.headers.get('content-length');
    if (contentLength) headers.set('content-length', contentLength);
    headers.set('cache-control', cacheControlFor(validation.path));

    return new Response(upstream.body, { status: 200, headers });
  } catch (err) {
    console.error('serve route error', err);
    return notFound();
  }
}
