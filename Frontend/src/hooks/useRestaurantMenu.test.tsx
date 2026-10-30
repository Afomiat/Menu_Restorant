import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { RestaurantMenu } from '../types';

const fetchRestaurantMenu = vi.fn<(slug: string) => Promise<RestaurantMenu>>();
let pushLiveUpdate: (() => void) | undefined;
const liveSlugs: (string | null)[] = [];

vi.mock('../services/menuService', () => ({
  fetchRestaurantMenu: (slug: string) => fetchRestaurantMenu(slug),
  getSavedMenu: () => null,
  forgetSavedMenu: () => {},
  MenuServiceError: class MenuServiceError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
}));

// Stands in for the backend's live channel: the test triggers the "menu changed" message itself
vi.mock('./useLiveMenuUpdates', () => ({
  useLiveMenuUpdates: (slug: string | null, onMenuUpdated: () => void) => {
    liveSlugs.push(slug);
    pushLiveUpdate = onMenuUpdated;
  },
}));

import useRestaurantMenu from './useRestaurantMenu';

function menu(template: 'classic' | 'modern', slug?: string): RestaurantMenu {
  return {
    meta: { name: 'Aura', tagline: '', themeColor: '#c9a876', template, slug },
    categories: [],
    items: [],
  };
}

beforeEach(() => {
  fetchRestaurantMenu.mockReset();
  pushLiveUpdate = undefined;
  liveSlugs.length = 0;
});

afterEach(cleanup);

describe('useRestaurantMenu design changes', () => {
  it('switches design on a live update from the backend, without showing the loader again', async () => {
    fetchRestaurantMenu.mockResolvedValueOnce(menu('classic', 'aura'));
    const { result } = renderHook(() => useRestaurantMenu('aura'));
    await waitFor(() => expect(result.current.meta?.template).toBe('classic'));

    fetchRestaurantMenu.mockResolvedValueOnce(menu('modern', 'aura'));
    const loadingStates: boolean[] = [];
    await act(async () => {
      pushLiveUpdate?.();
      loadingStates.push(result.current.loading);
    });

    await waitFor(() => expect(result.current.meta?.template).toBe('modern'));
    expect(loadingStates).toEqual([false]);
    expect(result.current.loading).toBe(false);
  });

  it('switches design when a demo menu is changed in the same browser', async () => {
    fetchRestaurantMenu.mockResolvedValueOnce(menu('modern'));
    const { result } = renderHook(() => useRestaurantMenu('aura'));
    await waitFor(() => expect(result.current.meta?.template).toBe('modern'));

    fetchRestaurantMenu.mockResolvedValueOnce(menu('classic'));
    act(() => {
      window.dispatchEvent(new CustomEvent('restaurant-menu-updated', { detail: { slug: 'aura' } }));
    });

    await waitFor(() => expect(result.current.meta?.template).toBe('classic'));
  });

  it('ignores menu changes for another restaurant', async () => {
    fetchRestaurantMenu.mockResolvedValue(menu('modern'));
    const { result } = renderHook(() => useRestaurantMenu('aura'));
    await waitFor(() => expect(result.current.meta?.template).toBe('modern'));
    const callsBefore = fetchRestaurantMenu.mock.calls.length;

    act(() => {
      window.dispatchEvent(new CustomEvent('restaurant-menu-updated', { detail: { slug: 'luna' } }));
    });

    expect(fetchRestaurantMenu.mock.calls.length).toBe(callsBefore);
  });

  it('listens for live updates only for menus that come from the backend', async () => {
    fetchRestaurantMenu.mockResolvedValueOnce(menu('modern', 'aura'));
    const live = renderHook(() => useRestaurantMenu('aura'));
    await waitFor(() => expect(live.result.current.meta).not.toBeNull());
    expect(liveSlugs.at(-1)).toBe('aura');
    live.unmount();

    liveSlugs.length = 0;
    fetchRestaurantMenu.mockResolvedValueOnce(menu('modern'));
    const demo = renderHook(() => useRestaurantMenu('luna'));
    await waitFor(() => expect(demo.result.current.meta).not.toBeNull());
    expect(liveSlugs.every((slug) => slug === null)).toBe(true);
  });
});
