import type { DishRevenue } from '../types';
import { formatPrice } from '../utils/currency';
import FinancePartFailed from './FinancePartFailed';

interface FinanceTopDishesProps {
  /** null when the top dishes could not be loaded */
  dishes: DishRevenue[] | null;
  currency?: string;
}

export default function FinanceTopDishes({ dishes, currency = 'ETB' }: FinanceTopDishesProps) {
  const money = (val: number) => formatPrice(val, currency);
  const maxRevenue = dishes && dishes.length > 0 ? dishes[0].revenue || 1 : 1;

  return (
    <div className="rpt-panel" role="region" aria-label="Top Dishes by Revenue">
      <h2 className="rpt-panel-title">Top Dishes by Revenue</h2>
      <p className="rpt-panel-hint">Highest earning menu items</p>

      {dishes === null ? (
        <FinancePartFailed />
      ) : dishes.length === 0 ? (
        <p className="rpt-empty fin-empty">No dish sales in this period.</p>
      ) : (
        <ol className="rpt-rows">
          {dishes.slice(0, 8).map((d, idx) => (
            <li key={d.item_name} className="fin-dish">
              <div className="rpt-row">
                <span className="rpt-row-main">
                  <span className="fin-rank">{idx + 1}</span>
                  <span style={{ fontWeight: 600 }}>{d.item_name}</span>
                  <span className="rpt-muted">×{d.quantity_sold}</span>
                </span>
                <strong>{money(d.revenue)}</strong>
              </div>
              <div className="fin-meter" aria-hidden="true">
                <span style={{ width: `${Math.max((d.revenue / maxRevenue) * 100, 4)}%` }} />
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
