/**
 * Demo mode (NEXT_PUBLIC_DEMO_MODE=1): for the sales demo only. Shows a slim "demo" strip on every
 * page and test-payment hints at checkout. Never set it for a real salon. Public by design: it's
 * read in the browser and contains no secret.
 */
export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "1";
