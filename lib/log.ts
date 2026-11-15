/**
 * Minimal server logger (AGENTS.md §11: no stray console.log). One line per event with a scope,
 * so `journalctl`/PM2 logs stay greppable. Never pass customer PII or payment payloads here.
 */
export const log = {
  info: (scope: string, message: string, extra?: Record<string, unknown>) =>
    console.info(`[${scope}] ${message}`, ...(extra ? [extra] : [])),
  error: (scope: string, message: string, error?: unknown) =>
    console.error(`[${scope}] ${message}`, error instanceof Error ? error.message : (error ?? "")),
};
