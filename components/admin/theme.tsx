"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { THEME_EVENT, THEME_KEY } from "@/lib/admin-theme";

/**
 * Admin-only dark mode. The class lives on <html> (AGENTS.md §10) so portalled overlays inherit it,
 * and it's removed when leaving the admin so the public site stays light.
 */

const KEY = THEME_KEY;
const EVENT = THEME_EVENT;

function read(): boolean {
  try {
    return localStorage.getItem(KEY) === "dark";
  } catch {
    return false;
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function useDark() {
  return useSyncExternalStore(subscribe, read, () => false);
}

/** Keeps <html class="dark"> in sync while inside /admin; cleans up on the way out. */
export function AdminThemeSync() {
  const dark = useDark();
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);
  useEffect(() => () => document.documentElement.classList.remove("dark"), []);
  return null;
}

export function ThemeToggle() {
  const dark = useDark();
  function toggle() {
    try {
      localStorage.setItem(KEY, dark ? "light" : "dark");
    } catch {
      // Storage blocked: the toggle still works for this page view.
      document.documentElement.classList.toggle("dark", !dark);
    }
    window.dispatchEvent(new Event(EVENT));
  }
  return (
    <Tooltip content={dark ? "Light mode" : "Dark mode"}>
      <Button variant="ghost" size="icon" onClick={toggle} aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}>
        {dark ? <Sun /> : <Moon />}
      </Button>
    </Tooltip>
  );
}
