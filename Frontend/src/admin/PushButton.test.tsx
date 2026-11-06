import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const push = { pushSupported: vi.fn(), fetchPushKey: vi.fn(), enablePush: vi.fn() };
vi.mock('../utils/push', () => ({
  pushSupported: () => push.pushSupported(),
  fetchPushKey: () => push.fetchPushKey(),
  enablePush: () => push.enablePush(),
}));

import PushButton from './PushButton';

function withPermission(permission: NotificationPermission) {
  vi.stubGlobal('Notification', { permission });
}

beforeEach(() => {
  Object.values(push).forEach((f) => f.mockReset());
  push.pushSupported.mockReturnValue(true);
  push.fetchPushKey.mockResolvedValue({ enabled: true, public_key: 'k' });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('PushButton', () => {
  it('turns phone alerts on from a tap', async () => {
    withPermission('default');
    push.enablePush.mockResolvedValue('on');
    render(<PushButton />);

    fireEvent.click(await screen.findByText('Turn on phone alerts'));

    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Phone alerts are on'));
  });

  it('keeps the subscription saved when alerts were already allowed', async () => {
    withPermission('granted');
    push.enablePush.mockResolvedValue('on');
    render(<PushButton />);

    expect((await screen.findByRole('status')).textContent).toBe('Phone alerts are on');
    await waitFor(() => expect(push.enablePush).toHaveBeenCalled());
  });

  it('explains blocked alerts and unsupported browsers', async () => {
    withPermission('denied');
    render(<PushButton />);
    expect((await screen.findByRole('status')).textContent).toContain('blocked');
    cleanup();

    push.pushSupported.mockReturnValue(false);
    render(<PushButton />);
    expect((await screen.findByRole('status')).textContent).toContain('add this page to the home screen');
  });

  it('shows nothing when the server has push off', async () => {
    withPermission('default');
    push.fetchPushKey.mockResolvedValue({ enabled: false, public_key: '' });
    const { container } = render(<PushButton />);

    await waitFor(() => expect(push.fetchPushKey).toHaveBeenCalled());
    expect(container.textContent).toBe('');
  });
});
