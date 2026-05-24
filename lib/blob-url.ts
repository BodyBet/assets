export function getBlobPublicBaseUrl(): string {
  const base = process.env.BLOB_PUBLIC_BASE_URL;
  if (!base) {
    throw new Error('BLOB_PUBLIC_BASE_URL env var is required');
  }
  return base.replace(/\/+$/, '');
}

export function blobUrlFor(pathname: string): string {
  return `${getBlobPublicBaseUrl()}/${pathname}`;
}
