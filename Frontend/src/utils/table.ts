/**
 * How a table is named on screen: "Table 5" for a table called "5", but a table the restaurant
 * already called "Table 5" (any letter case) is shown as it is, never "Table Table 5".
 */
export function tableLabel(name: string | number | null | undefined): string {
  const value = String(name ?? '').trim();
  if (!value) return 'Table';
  return /^table\b/i.test(value) ? value : `Table ${value}`;
}

/**
 * The older kitchen screens group orders under keys like "Table 5" or "Direct Orders" and read the table
 * back from the key; this only changes how such a key is shown.
 */
export function groupLabel(key: string): string {
  return key.startsWith('Table ') ? tableLabel(key.slice('Table '.length)) : key;
}
