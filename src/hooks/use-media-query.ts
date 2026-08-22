"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Whether a media query currently matches, read through `useSyncExternalStore`
 * so there is no post-mount state update and no extra render. Returns `false`
 * on the server and during hydration, then settles to the real value.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    [query],
  );

  const getSnapshot = useCallback(() => window.matchMedia(query).matches, [query]);

  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

/** True once the viewport is at least Tailwind's `md` breakpoint. */
export function useIsDesktop() {
  return useMediaQuery("(min-width: 768px)");
}
