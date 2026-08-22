/**
 * Number formatting pinned to a single locale.
 *
 * These counts render inside components that Next prerenders on the server.
 * `toLocaleString()` with no locale would format with Node's ICU default on the
 * server and with the visitor's locale in the browser, so a reader in a
 * comma-less locale would hit a hydration mismatch on the very first paint.
 */
const FORMATTER = new Intl.NumberFormat("en-US");

export function formatCount(value: number): string {
  return FORMATTER.format(value);
}
