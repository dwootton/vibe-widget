export function resolvePublicUrl(path: string): string {
  // Pass through absolute URLs (http, https, blob) unchanged
  if (/^https?:\/\//i.test(path) || path.startsWith("blob:")) return path;

  const base = import.meta.env.BASE_URL || "/";
  const trimmedBase = base.endsWith("/") ? base.slice(0, -1) : base;

  if (path.startsWith("/")) {
    return `${trimmedBase}${path}`;
  }

  return `${trimmedBase}/${path}`;
}
