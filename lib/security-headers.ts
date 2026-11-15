/**
 * HTTP security headers for every response (AGENTS.md §9). Plain module with no imports so
 * next.config.ts can load it.
 *
 * CSP choice: Next's "without nonces" setup. A nonce-based CSP would force every page to render
 * on each request and is incompatible with the partial prerendering our public and admin pages
 * use, so inline scripts are allowed while every *external* origin is allow-listed explicitly.
 * Only the services the site actually uses are listed: Razorpay Checkout, Instagram embeds
 * (loaded only after a tap) and the Google Maps embed.
 */

type Options = { dev: boolean };

const RAZORPAY = "https://*.razorpay.com";

export function contentSecurityPolicy({ dev }: Options): string {
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    // 'unsafe-eval' only in development (React dev tooling / Turbopack HMR).
    "script-src": ["'self'", "'unsafe-inline'", "https://checkout.razorpay.com", ...(dev ? ["'unsafe-eval'"] : [])],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:", RAZORPAY],
    "font-src": ["'self'", "data:"],
    "connect-src": ["'self'", RAZORPAY, ...(dev ? ["ws:", "wss:"] : [])],
    "frame-src": [RAZORPAY, "https://www.instagram.com", "https://www.google.com", "https://maps.google.com"],
    "worker-src": ["'self'", "blob:"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
  };
  const policy = Object.entries(directives).map(([name, values]) => `${name} ${values.join(" ")}`);
  if (!dev) policy.push("upgrade-insecure-requests");
  return policy.join("; ");
}

export function securityHeaders({ dev }: Options): { key: string; value: string }[] {
  return [
    { key: "Content-Security-Policy", value: contentSecurityPolicy({ dev }) },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    // Razorpay opens bank/3-D Secure pages in pop-ups that must be able to report back.
    { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
    { key: "Permissions-Policy", value: 'camera=(), microphone=(), geolocation=(), payment=(self "https://api.razorpay.com")' },
    // Browsers only honour HSTS over HTTPS; Caddy serves the site over HTTPS in production.
    ...(dev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]),
  ];
}
