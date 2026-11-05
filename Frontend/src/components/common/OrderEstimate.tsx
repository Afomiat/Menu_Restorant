import type { CartItem } from '../../types';
import { useNow } from '../../hooks/useNow';
import { customerEstimate } from '../../utils/kitchenTimer';

/** The customer's ready estimate for one order (Pro): "About 15 min", "Ready in about 7 min". */
export default function OrderEstimate({ order, color = '#64748b' }: { order: CartItem; color?: string }) {
  const now = useNow(15_000);
  const text = customerEstimate(order.status, order.targetMinutes, order.startedAt, now);
  if (!text) return null;
  return (
    <span data-testid="order-estimate" style={{ fontSize: '11px', fontWeight: 600, color, whiteSpace: 'nowrap' }}>
      {text}
    </span>
  );
}
