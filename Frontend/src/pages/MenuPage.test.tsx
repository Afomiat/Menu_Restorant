import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { RestaurantMeta } from '../types';

let currentMeta: RestaurantMeta;

vi.mock('../hooks/useRestaurantMenu', () => ({
  default: () => ({ meta: currentMeta, categories: [], items: [], loading: false, error: null, plan: 'standard' }),
}));
vi.mock('../templates/modern/ModernMenuPage', () => ({ default: () => <div>Modern design</div> }));
vi.mock('../templates/classic/ClassicMenuPage', () => ({ default: () => <div>Classic design</div> }));

import MenuPage from './MenuPage';

function page() {
  return (
    <MemoryRouter initialEntries={['/aura']}>
      <Routes>
        <Route path="/:restaurantName" element={<MenuPage />} />
      </Routes>
    </MemoryRouter>
  );
}

afterEach(cleanup);

describe('MenuPage design', () => {
  it('shows the design the restaurant chose', () => {
    currentMeta = { name: 'Aura', tagline: '', themeColor: '#c9a876', template: 'modern' };
    render(page());

    expect(screen.getByText('Modern design')).toBeTruthy();
    expect(screen.queryByText('Classic design')).toBeNull();
  });

  it('falls back to Classic when no design is set', () => {
    currentMeta = { name: 'Aura', tagline: '', themeColor: '#c9a876' };
    render(page());

    expect(screen.getByText('Classic design')).toBeTruthy();
  });

  it('swaps design in place when the menu data changes, without remounting the page', () => {
    currentMeta = { name: 'Aura', tagline: '', themeColor: '#c9a876', template: 'classic' };
    const { rerender } = render(page());
    expect(screen.getByText('Classic design')).toBeTruthy();

    currentMeta = { ...currentMeta, template: 'modern' };
    rerender(page());

    expect(screen.getByText('Modern design')).toBeTruthy();
    expect(screen.queryByText('Classic design')).toBeNull();
  });
});
