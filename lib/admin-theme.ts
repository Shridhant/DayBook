/**
 * Admin/staff dark mode, shared by the root layout's inline script and the client toggle.
 * Plain module (not "use client") so the server layout gets real strings, not client references.
 */

export const THEME_KEY = "daybook-admin-theme";
export const THEME_EVENT = "daybook-theme-change";
/** Desktop admin sidebar collapsed to an icon rail ("1"). Mirrored as <html data-sidebar-collapsed>. */
export const SIDEBAR_KEY = "daybook-admin-sidebar";
export const SIDEBAR_EVENT = "daybook-sidebar-change";

/**
 * Runs before first paint from the root layout's <head>, so a saved dark theme doesn't flash
 * light and a collapsed sidebar doesn't flash open. Only the app areas go dark; the public site always stays light. Client-side navigation
 * afterwards is handled by <AdminThemeSync />.
 */
export const THEME_SCRIPT = `try{if(/^\\/(admin|staff)(\\/|$)/.test(location.pathname)){var h=document.documentElement;h.classList.toggle('dark',localStorage.getItem('${THEME_KEY}')==='dark');h.toggleAttribute('data-sidebar-collapsed',localStorage.getItem('${SIDEBAR_KEY}')==='1')}}catch(e){}`;
