"use client";

import { useSyncExternalStore } from "react";

const noop = () => () => {};

/**
 * `false` during server render and the hydrating render, `true` afterwards.
 * Used to defer client-only values (resolved theme, matched media) until the
 * markup React produced on both sides has already agreed.
 */
export function useMounted(): boolean {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}
