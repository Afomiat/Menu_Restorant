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

describe('AdminSidebar plan badge', () => {
  it.each([
    ['basic', '⚡ Basic Plan'],
    ['plus', '👑 Plus Plan'],
    ['pro', '💎 Pro Plan'],
  ] as const)('shows the %s plan', (plan, label) => {
    render(<AdminSidebar meta={{ ...baseMeta, plan }} slug="aura" />);

    expect(screen.getByText(label)).toBeTruthy();
  });

  it('marks Kitchen Orders as a Plus feature only on Basic', () => {
    render(<AdminSidebar meta={{ ...baseMeta, plan: 'basic' }} slug="aura" />);
    expect(screen.getByText('PLUS')).toBeTruthy();
    cleanup();

    render(<AdminSidebar meta={{ ...baseMeta, plan: 'pro' }} slug="aura" />);
    expect(screen.queryByText('PLUS')).toBeNull();
  });
});

describe('AdminSidebar by role', () => {
  const navItems = () => Array.from(document.querySelectorAll('.admin-nav-item')).map((el) => el.textContent?.trim());

  it('shows a manager everything, with Staff marked PRO below the Pro plan', () => {
    render(<AdminSidebar meta={{ ...baseMeta, plan: 'plus' }} slug="aura" onOpenStaff={vi.fn()} onOpenSettings={vi.fn()} onLogout={vi.fn()} onChangeDesign={vi.fn()} role="manager" />);

    expect(navItems()).toEqual(['Dashboard', 'Kitchen Orders', 'StaffPRO', 'Tables & QR Codes', 'Restaurant Settings', 'Sign Out']);
    expect(screen.getByRole('radiogroup', { name: 'Menu design' })).toBeTruthy();
  });

  it('drops the PRO mark on the Pro plan and opens the Staff screen', () => {
    const onOpenStaff = vi.fn();
    render(<AdminSidebar meta={{ ...baseMeta, plan: 'pro' }} slug="aura" onOpenStaff={onOpenStaff} role="manager" />);

    fireEvent.click(screen.getByText('Staff'));
    expect(screen.queryByText('PRO')).toBeNull();
    expect(onOpenStaff).toHaveBeenCalledTimes(1);
  });

  it('shows a chef only the kitchen and sign out', () => {
    render(<AdminSidebar meta={{ ...baseMeta, plan: 'pro' }} slug="aura" onOpenStaff={vi.fn()} onOpenSettings={vi.fn()} onLogout={vi.fn()} onChangeDesign={vi.fn()} role="chef" />);

    expect(navItems()).toEqual(['Kitchen Orders', 'Sign Out']);
    expect(screen.queryByRole('radiogroup', { name: 'Menu design' })).toBeNull();
  });

  it('shows a waiter only sign out', () => {
    render(<AdminSidebar meta={{ ...baseMeta, plan: 'pro' }} slug="aura" onOpenStaff={vi.fn()} onLogout={vi.fn()} role="waiter" />);

    expect(navItems()).toEqual(['Sign Out']);
  });

  it('shows how many decisions wait on Alerts', () => {
    render(<AdminSidebar meta={{ ...baseMeta, plan: 'pro' }} slug="aura" role="manager" onSelectView={vi.fn()} alertsCount={3} />);
    expect(screen.getByTestId('alerts-count').textContent).toBe('3');
    cleanup();
    render(<AdminSidebar meta={{ ...baseMeta, plan: 'pro' }} slug="aura" role="manager" onSelectView={vi.fn()} alertsCount={0} />);
    expect(screen.queryByTestId('alerts-count')).toBeNull();
  });

  it('shows the Menu Status card to managers only', () => {
    render(<AdminSidebar meta={{ ...baseMeta, plan: 'pro' }} slug="aura" role="manager" />);
    expect(screen.getByText('Menu Status: Live')).toBeTruthy();
    cleanup();

    for (const role of ['chef', 'waiter', 'cashier'] as const) {
      render(<AdminSidebar meta={{ ...baseMeta, plan: 'pro' }} slug="aura" role={role} />);
      expect(screen.queryByText('Menu Status: Live')).toBeNull();
      cleanup();
    }
  });
});

describe('AdminSidebar Bills (Pro managers)', () => {
  it('shows Bills to managers on Pro only', () => {
    const onSelectView = vi.fn();
    render(<AdminSidebar meta={{ ...baseMeta, plan: 'pro' }} slug="aura" onSelectView={onSelectView} role="manager" />);
    fireEvent.click(screen.getByText('Bills'));
    expect(onSelectView).toHaveBeenCalledWith('bills');
    cleanup();

    render(<AdminSidebar meta={{ ...baseMeta, plan: 'plus' }} slug="aura" onSelectView={vi.fn()} role="manager" />);
    expect(screen.queryByText('Bills')).toBeNull();
    cleanup();

    render(<AdminSidebar meta={{ ...baseMeta, plan: 'pro' }} slug="aura" onSelectView={vi.fn()} role="chef" />);
    expect(screen.queryByText('Bills')).toBeNull();
  });
});

describe('AdminSidebar Alerts and Reports (Pro managers)', () => {
  it('opens Alerts and Reports', () => {
    const onSelectView = vi.fn();
    render(<AdminSidebar meta={{ ...baseMeta, plan: 'pro' }} slug="aura" onSelectView={onSelectView} role="manager" />);

    fireEvent.click(screen.getByText('Alerts'));
    fireEvent.click(screen.getByText('Reports'));
    expect(onSelectView.mock.calls.map((c) => c[0])).toEqual(['alerts', 'reports']);
    cleanup();

    render(<AdminSidebar meta={{ ...baseMeta, plan: 'plus' }} slug="aura" onSelectView={vi.fn()} role="manager" />);
    expect(screen.queryByText('Alerts')).toBeNull();
    expect(screen.queryByText('Reports')).toBeNull();
  });
});
