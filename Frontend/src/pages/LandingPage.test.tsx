import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../services/menuService', () => ({
  fetchActiveRestaurants: vi.fn().mockResolvedValue([
    { id: '1', slug: 'tapu', name: 'Tapu', plan: 'pro', currency: 'ETB', is_active: true },
    { id: '2', slug: 'luna', name: 'Luna', plan: 'basic', currency: 'ETB', is_active: true },
  ]),
}));

import LandingPage from './LandingPage';

afterEach(cleanup);

describe('LandingPage plan badges', () => {
  it('shows each restaurant with its plan name', async () => {
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>
    );

    expect(await screen.findByText('Pro PLAN')).toBeTruthy();
    expect(screen.getByText('Basic PLAN')).toBeTruthy();
  });
});
