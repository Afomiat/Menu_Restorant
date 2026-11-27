/** Shown for a dish without a photo: a plain plate, neutral for any cuisine. */
export const DISH_PLACEHOLDER = '/images/dish-placeholder.svg';

// Older versions filled empty photos with a burger picture, and some dishes may have saved it
const LEGACY_PLACEHOLDERS = ['/images/default_food.png'];

/** True when a dish has no real photo of its own. */
export function isPlaceholderImage(url?: string | null): boolean {
  const value = String(url ?? '').trim();
  return value === '' || value === DISH_PLACEHOLDER || LEGACY_PLACEHOLDERS.includes(value);
}

/** The photo to show for a dish: its own, or the neutral placeholder. */
export function dishImage(url?: string | null): string {
  return isPlaceholderImage(url) ? DISH_PLACEHOLDER : String(url).trim();
}

/** The photo to save for a dish: never a placeholder, so an empty photo stays empty. */
export function savedDishImage(url?: string | null): string {
  return isPlaceholderImage(url) ? '' : String(url).trim();
}
