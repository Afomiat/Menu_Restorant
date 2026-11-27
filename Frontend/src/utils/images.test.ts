import { describe, expect, it } from 'vitest';
import { DISH_PLACEHOLDER, dishImage, isPlaceholderImage, savedDishImage } from './images';

describe('dish photos', () => {
  it('shows the neutral plate for a dish without a photo, including the old burger default', () => {
    expect(dishImage('')).toBe(DISH_PLACEHOLDER);
    expect(dishImage(null)).toBe(DISH_PLACEHOLDER);
    expect(dishImage('/images/default_food.png')).toBe(DISH_PLACEHOLDER);
    expect(dishImage('https://res.cloudinary.com/x/tibs.jpg')).toBe('https://res.cloudinary.com/x/tibs.jpg');
  });

  it('never saves a placeholder as a dish photo', () => {
    expect(savedDishImage(DISH_PLACEHOLDER)).toBe('');
    expect(savedDishImage('/images/default_food.png')).toBe('');
    expect(savedDishImage(' https://res.cloudinary.com/x/tibs.jpg ')).toBe('https://res.cloudinary.com/x/tibs.jpg');
  });

  it('knows a real photo from a placeholder', () => {
    expect(isPlaceholderImage('/images/burger_classic.jpg')).toBe(false);
    expect(isPlaceholderImage(DISH_PLACEHOLDER)).toBe(true);
  });
});
