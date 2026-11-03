/** Paths whose last segment is a bearer token. Logs keep the route but never the token. */
const TOKEN_ROUTES = [/^(\/api\/public\/receipts\/)[^/?#]+/i];

export function redactPath(path: string) {
  for (const pattern of TOKEN_ROUTES) {
    if (pattern.test(path)) return path.replace(pattern, "$1[redacted]");
  }
  return path;
}
