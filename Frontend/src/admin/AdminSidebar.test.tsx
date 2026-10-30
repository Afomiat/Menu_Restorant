import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import AdminSidebar from './AdminSidebar';
import type { RestaurantMeta } from '../types';

const baseMeta: RestaurantMeta = { name: 'Aura', tagline: '', themeColor: '#c9a876' };

afterEach(cleanup);

function designOption(name: 'Modern' | 'Classic') {
  return screen.getByRole('radio', { name });
}

describe('AdminSidebar menu design switch', () => {
  it('marks the restaurant’s current design as selected', () => {
    render(<AdminSidebar meta={{ ...baseMeta, template: 'modern' }} slug="aura" onChangeDesign={vi.fn()} />);

    expect(designOption('Modern').getAttribute('aria-checked')).toBe('true');
    expect(designOption('Classic').getAttribute('aria-checked')).toBe('false');
  });

  it('treats a menu without a design as Classic, like the customer menu does', () => {
    render(<AdminSidebar meta={baseMeta} slug="aura" onChangeDesign={vi.fn()} />);

    expect(designOption('Classic').getAttribute('aria-checked')).toBe('true');
  });

  it('reports the design the manager picks', () => {
    const onChangeDesign = vi.fn();
    render(<AdminSidebar meta={{ ...baseMeta, template: 'classic' }} slug="aura" onChangeDesign={onChangeDesign} />);

    fireEvent.click(designOption('Modern'));

    expect(onChangeDesign).toHaveBeenCalledTimes(1);
    expect(onChangeDesign).toHaveBeenCalledWith('modern');
  });

  it('hides the switch when the page cannot change the design', () => {
    render(<AdminSidebar meta={baseMeta} slug="aura" />);

    expect(screen.queryByRole('radiogroup', { name: 'Menu design' })).toBeNull();
  });
});
