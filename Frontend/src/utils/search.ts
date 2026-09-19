import type { MenuItem } from '../types';

/**
 * Robust search query matcher for menu items.
 * Matches multi-word search tokens against item name, subtitle, description,
 * tags, allergens, badge, weight label, variants, and category name.
 */
export function matchesSearchQuery(
  item: MenuItem,
  query: string,
  categoryName?: string
): boolean {
  if (!query || !query.trim()) return true;

  // Split query into tokens to support multi-word search (e.g., "spicy chicken" or "gluten free")
  const tokens = query
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (tokens.length === 0) return true;

  // Collect all searchable fields into a unified lowercase search string
  const name = item.name || '';
  const subtitle = item.subtitle || '';
  const desc = item.description || '';
  const fullDesc = item.fullDescription || '';
  const tags = Array.isArray(item.tags) ? item.tags.join(' ') : '';
  const allergens = Array.isArray(item.allergens) ? item.allergens.join(' ') : '';
  const weight = item.weightLabel || '';
  const badge = item.badge || '';
  const cat = categoryName || '';
  const variants = Array.isArray(item.variants)
    ? item.variants.map((v) => v?.name || '').join(' ')
    : '';

  const haystack = `${name} ${subtitle} ${desc} ${fullDesc} ${tags} ${allergens} ${weight} ${badge} ${cat} ${variants}`.toLowerCase();

  // Every search token must match somewhere in the item's haystack
  return tokens.every((token) => haystack.includes(token));
}
