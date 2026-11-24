import type { DishRevenue } from '../types';
import { formatPrice } from '../utils/currency';

interface FinanceTopDishesProps {
  dishes: DishRevenue[];
  currency?: string;
}

export default function FinanceTopDishes({ dishes, currency = 'ETB' }: FinanceTopDishesProps) {
  const money = (val: number) => formatPrice(val, currency);
  const maxRevenue = dishes.length > 0 ? dishes[0].revenue : 1;

  return (
    <div
      style={{
        backgroundColor: '#ffffff',
        borderRadius: '16px',
        border: '1px solid #e2e8f0',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
        flex: 1,
      }}
    >
      <div>
        <h2 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: '#0f172a' }}>Top Dishes by Revenue</h2>
        <span style={{ fontSize: '12px', color: '#64748b' }}>Highest earning menu items</span>
      </div>

      {dishes.length === 0 ? (
        <div style={{ padding: '30px 0', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
          No dish sales in this period.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '12px' }}>
          {dishes.slice(0, 8).map((d, idx) => {
            const barWidth = Math.max((d.revenue / maxRevenue) * 100, 4);
            return (
              <div key={d.item_name} style={{ display: 'grid', gap: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '13px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: '#94a3b8', fontWeight: 700, width: '16px' }}>{idx + 1}.</span>
                    <span style={{ fontWeight: 600, color: '#0f172a' }}>{d.item_name}</span>
                    <span style={{ color: '#64748b', fontSize: '12px' }}>×{d.quantity_sold}</span>
                  </div>
                  <span style={{ fontWeight: 700, color: '#0f172a' }}>{money(d.revenue)}</span>
                </div>
                <div style={{ height: '6px', borderRadius: '3px', backgroundColor: '#f1f5f9', overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${barWidth}%`,
                      backgroundColor: 'var(--admin-primary, #ff5a36)',
                      borderRadius: '3px',
                      transition: 'width 0.3s ease',
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
