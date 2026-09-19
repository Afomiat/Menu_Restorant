/**
 * Standardized currency and price formatting utility across all menu templates.
 */

export function formatPrice(amount: number, currency: string = 'ETB'): string {
  if (typeof amount !== 'number' || isNaN(amount)) {
    const isSymbol = /^[^\w\s]$/.test(currency.trim());
    return isSymbol ? `${currency}0` : `0 ${currency}`;
  }

  // Format with thousands separator if needed, with decimals only if not whole
  const formatted = amount % 1 === 0 
    ? amount.toLocaleString('en-US') 
    : amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const trimmed = currency.trim();
  const isSymbol = /^[^\w\s]$/.test(trimmed);
  return isSymbol ? `${trimmed}${formatted}` : `${formatted} ${trimmed}`;
}

export function formatNumber(amount: number): string {
  if (typeof amount !== 'number' || isNaN(amount)) {
    return '0';
  }
  return amount % 1 === 0
    ? amount.toLocaleString('en-US')
    : amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export const formatCurrency = formatPrice;
