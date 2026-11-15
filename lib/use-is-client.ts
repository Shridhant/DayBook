"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * False during server rendering and hydration, true afterwards. Use it to render values that
 * depend on the current time or browser APIs without hydration mismatches (AGENTS.md §5).
 */
export function useIsClient(): boolean {
  return useSyncExternalStore(subscribe, () => true, () => false);
}
