import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import AdminKitchenView from './AdminKitchenView';
import type { RestaurantMeta } from '../types';

const baseMeta: RestaurantMeta = { name: 'Aura', tagline: '', themeColor: '#c9a876' };

afterEach(cleanup);

describe('AdminKitchenView plan check', () => {
  it('asks a Basic restaurant to upgrade to Plus', () => {
    render(<AdminKitchenView slug="aura" meta={{ ...baseMeta, plan: 'basic' }} orders={[]} onUpgradePlan={() => {}} />);

    expect(screen.getByText('Plus Plan Feature')).toBeTruthy();
    expect(screen.getByText('Upgrade to Plus (Instant Activation)')).toBeTruthy();
  });

  it.each(['plus', 'pro'] as const)('opens the kitchen screen on %s', (plan) => {
    render(<AdminKitchenView slug="aura" meta={{ ...baseMeta, plan }} orders={[]} />);

    expect(screen.queryByText('Plus Plan Feature')).toBeNull();
  });
});
