const PUBLIC_PATHS = ["/login", "/api/auth/callback", "/marcar", "/api/marcar"];

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}
