export const ALLOWED_EXTENSIONS = new Set([
  '.webp',
  '.png',
  '.jpg',
  '.jpeg',
  '.svg',
  '.gif',
  '.ico',
  '.json',
]);

export type ValidatedPath = { ok: true; path: string } | { ok: false };

export function validatePath(rawPath: string): ValidatedPath {
  if (!rawPath) return { ok: false };
  if (rawPath.startsWith('/')) return { ok: false };

  const segments = rawPath.split('/');
  for (const segment of segments) {
    if (segment === '') return { ok: false };
    if (segment.startsWith('.')) return { ok: false };
  }

  const lastDot = rawPath.lastIndexOf('.');
  if (lastDot === -1) return { ok: false };
  const ext = rawPath.slice(lastDot).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) return { ok: false };

  return { ok: true, path: rawPath };
}
