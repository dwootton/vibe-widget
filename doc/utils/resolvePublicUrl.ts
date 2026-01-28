export function resolvePublicUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;

  const base = import.meta.env.BASE_URL || "/";
  const trimmedBase = base.endsWith("/") ? base.slice(0, -1) : base;

  if (path.startsWith("/")) {
    return `${trimmedBase}${path}`;
  }

  return `${trimmedBase}/${path}`;
}
