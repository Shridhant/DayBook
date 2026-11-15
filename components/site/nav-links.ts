/** Shared by the (client) header and the (server) footer, so it lives outside both. */
export const NAV_LINKS = [
  { href: "/#services", label: "Services" },
  { href: "/#work", label: "Our work" },
  { href: "/#team", label: "Team" },
  { href: "/#reviews", label: "Reviews" },
  { href: "/#visit", label: "Visit" },
] as const;
