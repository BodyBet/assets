const HASH_SUFFIX = /\.[a-f0-9]{10}$/;

export function pathToManifestKey(pathname: string): string {
  const lastDot = pathname.lastIndexOf('.');
  const withoutExt = lastDot === -1 ? pathname : pathname.slice(0, lastDot);
  const withoutHash = withoutExt.replace(HASH_SUFFIX, '');
  return withoutHash.split('/').filter(Boolean).join('.');
}
