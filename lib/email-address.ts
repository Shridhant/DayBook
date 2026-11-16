/**
 * Domains reserved for examples and testing (RFC 2606 / 6761): nothing can receive mail there, so
 * sending would only bounce and hurt the sender's reputation. Demo customers use `@example.com`.
 */
const RESERVED_DOMAINS = ["example.com", "example.net", "example.org"];
const RESERVED_TLDS = ["test", "example", "invalid", "localhost"];

export function isTestOnlyAddress(email: string): boolean {
  const domain = email.trim().toLowerCase().split("@").pop()?.replace(/\.$/, "") ?? "";
  if (RESERVED_DOMAINS.some((d) => domain === d || domain.endsWith(`.${d}`))) return true;
  return RESERVED_TLDS.includes(domain.split(".").pop() ?? "");
}
