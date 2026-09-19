import { useState, useMemo } from 'react';
import {
  ChefHat,
  Clock3,
  CheckCircle2,
  Flame,
  Check,
  CheckCheck,
  Trash2,
  Sparkles,
  Layers,
  Search,
  X,
  Timer,
  UtensilsCrossed,
} from 'lucide-react';
import type { CartItem, MenuItem, OrderStatus, RestaurantMeta } from '../types';
import {
  updateOrderStatus,
  updateTableOrdersStatus,
  clearCompletedOrders,
  clearAllRestaurantOrders,
  deleteTableOrders,
} from '../services/orderService';
import { formatPrice } from '../utils/currency';
import AdminConfirmModal from './AdminConfirmModal';
import SearchBar from '../components/common/SearchBar';

interface AdminKitchenViewProps {
  slug: string;
  meta: RestaurantMeta;
  orders: CartItem[];
  items?: MenuItem[];
  onBackToMenu?: () => void;
}

export default function AdminKitchenView({
  slug,
  meta,
  orders = [],
  items = [],
  onBackToMenu,
}: AdminKitchenViewProps) {
  const [filterTab, setFilterTab] = useState<'active' | 'cooking' | 'ready' | 'history'>('active');
  const [searchQuery, setSearchQuery] = useState('');

  // Confirmation Modals State
  const [isClearAllModalOpen, setIsClearAllModalOpen] = useState(false);
  const [isClearHistoryModalOpen, setIsClearHistoryModalOpen] = useState(false);
  const [tableToDelete, setTableToDelete] = useState<string | null>(null);

  const activeCurrency = meta?.currency || 'ETB';

  // Safely hydrate all order items
  const safeOrders: CartItem[] = useMemo(() => {
    return (orders || [])
      .filter(Boolean)
      .map((order, index) => {
        const existingItem = order?.item;
        const matchedItem = items?.find((m) => m?.id === (existingItem?.id || (order as any)?.itemId));
        const fallbackItem: MenuItem = {
          id: existingItem?.id || (order as any)?.itemId || `unknown-${index}`,
          name: existingItem?.name || (order as any)?.name || 'Dish Item',
          price: typeof existingItem?.price === 'number' ? existingItem.price : (order as any)?.price || 0,
          imageUrl: existingItem?.imageUrl || '/images/cat_food.jpg',
          description: existingItem?.description || '',
          tags: existingItem?.tags || [],
          available: existingItem?.available !== false,
          categoryId: existingItem?.categoryId || 'all',
          variants: existingItem?.variants || [],
        };

        return {
          ...order,
          orderId: order?.orderId || `ORD-${index}-${Date.now()}`,
          quantity: typeof order?.quantity === 'number' && order.quantity > 0 ? order.quantity : 1,
          variant: order?.variant || '',
          status: order?.status || 'not_started',
          placedAt: order?.placedAt || Date.now(),
          tableNumber: order?.tableNumber || null,
          item: matchedItem || existingItem || fallbackItem,
        };
      });
  }, [orders, items]);

  // Global counts for filter cards
  const cookingCount = useMemo(
    () => safeOrders.filter((o) => o.status === 'preparing').length,
    [safeOrders]
  );
  const readyCount = useMemo(
    () => safeOrders.filter((o) => o.status === 'ready').length,
    [safeOrders]
  );
  const activeOrdersCount = useMemo(
    () => safeOrders.filter((o) => o.status !== 'complete' && o.status !== 'cancelled').length,
    [safeOrders]
  );
  const historyCount = useMemo(
    () => safeOrders.filter((o) => o.status === 'complete' || o.status === 'cancelled').length,
    [safeOrders]
  );

  // Tab Filtering + Search Filtering
  const filteredOrders = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return safeOrders.filter((order) => {
      // 1. Tab Status Filter
      let matchesTab = true;
      if (filterTab === 'cooking') {
        matchesTab = order.status === 'preparing';
      } else if (filterTab === 'ready') {
        matchesTab = order.status === 'ready';
      } else if (filterTab === 'history') {
        matchesTab = order.status === 'complete' || order.status === 'cancelled';
      } else {
        // active queue
        matchesTab = order.status !== 'complete' && order.status !== 'cancelled';
      }

      if (!matchesTab) return false;

      // 2. Search Query Filter
      if (query) {
        const tableName = order.tableNumber ? `table ${order.tableNumber}` : 'direct order';
        const dishName = (order.item?.name || '').toLowerCase();
        const variantName = (order.variant || '').toLowerCase();
        const matchesSearch =
          tableName.includes(query) ||
          dishName.includes(query) ||
          variantName.includes(query);
        if (!matchesSearch) return false;
      }

      return true;
    });
  }, [safeOrders, filterTab, searchQuery]);

  // Group filtered orders by Table Number
  const ordersByTable = useMemo(() => {
    const map = new Map<string, CartItem[]>();
    filteredOrders.forEach((order) => {
      const tableKey = order.tableNumber ? `Table ${order.tableNumber}` : 'Direct Orders';
      const existing = map.get(tableKey) || [];
      map.set(tableKey, [...existing, order]);
    });
    return Array.from(map.entries());
  }, [filteredOrders]);

  const formatElapsed = (placedAt?: number) => {
    if (!placedAt) return 'Just now';
    const elapsedSec = Math.floor((Date.now() - placedAt) / 1000);
    if (elapsedSec < 60) return `${Math.max(1, elapsedSec)}s ago`;
    const elapsedMin = Math.floor(elapsedSec / 60);
    if (elapsedMin < 60) return `${elapsedMin}m ago`;
    const elapsedHr = Math.floor(elapsedMin / 60);
    return `${elapsedHr}h ago`;
  };

  const handleStatusChange = (orderId: string, status: OrderStatus) => {
    updateOrderStatus(slug, orderId, status);
  };

  const handleStartTableCooking = (tableKey: string) => {
    const rawTable = tableKey.replace('Table ', '').trim();
    updateTableOrdersStatus(slug, rawTable, 'preparing');
  };

  const handleMarkTableReady = (tableKey: string) => {
    const rawTable = tableKey.replace('Table ', '').trim();
    updateTableOrdersStatus(slug, rawTable, 'ready');
  };

  const handleCompleteTable = (tableKey: string) => {
    const rawTable = tableKey.replace('Table ', '').trim();
    updateTableOrdersStatus(slug, rawTable, 'complete');
  };

  const confirmDeleteTable = () => {
    if (!tableToDelete) return;
    const rawTable = tableToDelete.replace('Table ', '').trim();
    deleteTableOrders(slug, rawTable);
    setTableToDelete(null);
  };

  const confirmClearAllQueue = () => {
    clearAllRestaurantOrders(slug);
    setIsClearAllModalOpen(false);
  };

  const confirmClearHistory = () => {
    clearCompletedOrders(slug);
    setIsClearHistoryModalOpen(false);
  };

  return (
    <div className="admin-kitchen-page-view">
      {/* ── Top Kitchen Header & Action Bar ───────────────────────────────── */}
      <div className="admin-kitchen-top-header">
        <div className="admin-kitchen-title-section">
          <div className="admin-kitchen-badge-icon">
            <ChefHat size={24} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 className="admin-kitchen-main-title">Live Kitchen Dispatch</h1>
              <span className="admin-kitchen-live-pill">
                <span className="admin-kitchen-live-dot" />
                Live Sync
              </span>
            </div>
            <p className="admin-kitchen-subtitle">
              Manage incoming customer table orders in real time.
            </p>
          </div>
        </div>

        {/* Right Tools: Search Bar, Clear Kitchen & Back to Menu */}
        <div className="admin-kitchen-top-actions">
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search by table or dish..."
            variant="admin"
            style={{ maxWidth: '280px' }}
          />

          {filterTab === 'history' && historyCount > 0 && (
            <button
              type="button"
              className="admin-sec-pill-btn"
              onClick={() => setIsClearHistoryModalOpen(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                color: '#64748b',
                borderColor: '#cbd5e1',
              }}
              title="Clear completed order history"
            >
              <Trash2 size={15} />
              <span>Clear History</span>
            </button>
          )}

          {safeOrders.length > 0 && (
            <button
              type="button"
              className="admin-sec-pill-btn"
              onClick={() => setIsClearAllModalOpen(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                color: '#ef4444',
                borderColor: '#fecaca',
              }}
              title="Wipe and clear all kitchen orders"
            >
              <Trash2 size={15} />
              <span>Clear Kitchen</span>
            </button>
          )}

          {onBackToMenu && (
            <button
              type="button"
              className="admin-sec-pill-btn"
              onClick={onBackToMenu}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <UtensilsCrossed size={16} />
              <span>Back to Menu</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Unified Big Clickable Filter Cards Grid ─────────────────────────── */}
      <div className="admin-kitchen-filter-cards-grid">
        {/* Card 1: All Active Queue */}
        <button
          type="button"
          className={`admin-kitchen-filter-card ${filterTab === 'active' ? 'active tab-active' : ''}`}
          onClick={() => setFilterTab('active')}
        >
          <div className="admin-kitchen-filter-icon active">
            <Layers size={22} />
          </div>
          <div>
            <div className="admin-kitchen-filter-num">{activeOrdersCount}</div>
            <div className="admin-kitchen-filter-label">All Active Queue</div>
          </div>
        </button>

        {/* Card 2: Cooking in Kitchen */}
        <button
          type="button"
          className={`admin-kitchen-filter-card ${filterTab === 'cooking' ? 'active tab-cooking' : ''}`}
          onClick={() => setFilterTab('cooking')}
        >
          <div className="admin-kitchen-filter-icon cooking">
            <Flame size={22} />
          </div>
          <div>
            <div className="admin-kitchen-filter-num">{cookingCount}</div>
            <div className="admin-kitchen-filter-label">Cooking in Kitchen</div>
          </div>
        </button>

        {/* Card 3: Ready for Table */}
        <button
          type="button"
          className={`admin-kitchen-filter-card ${filterTab === 'ready' ? 'active tab-ready' : ''}`}
          onClick={() => setFilterTab('ready')}
        >
          <div className="admin-kitchen-filter-icon ready">
            <CheckCheck size={22} />
          </div>
          <div>
            <div className="admin-kitchen-filter-num">{readyCount}</div>
            <div className="admin-kitchen-filter-label">Ready for Table</div>
          </div>
        </button>

        {/* Card 4: History / Served */}
        <button
          type="button"
          className={`admin-kitchen-filter-card ${filterTab === 'history' ? 'active tab-history' : ''}`}
          onClick={() => setFilterTab('history')}
        >
          <div className="admin-kitchen-filter-icon history">
            <CheckCircle2 size={22} />
          </div>
          <div>
            <div className="admin-kitchen-filter-num">{historyCount}</div>
            <div className="admin-kitchen-filter-label">History / Served</div>
          </div>
        </button>
      </div>

      {/* ── Table Tickets Grid (Full Dashboard View) ──────────────────────── */}
      {ordersByTable.length === 0 ? (
        <div className="admin-kitchen-empty-state">
          <div className="admin-kitchen-empty-icon">
            <Sparkles size={38} />
          </div>
          <h3 className="admin-kitchen-empty-title">
            {filterTab === 'cooking'
              ? 'No Dishes Currently Cooking'
              : filterTab === 'ready'
              ? 'No Orders Ready for Pickup'
              : filterTab === 'history'
              ? 'Order History is Clear'
              : searchQuery
              ? `No tickets match "${searchQuery}"`
              : 'Kitchen Queue is Clear'}
          </h3>
          <p className="admin-kitchen-empty-desc">
            {searchQuery
              ? 'Try searching with another table number or dish name.'
              : 'When customers send food orders to the kitchen from the QR menu, tickets appear here in real time.'}
          </p>
          {searchQuery && (
            <button
              type="button"
              className="admin-sec-pill-btn"
              onClick={() => setSearchQuery('')}
              style={{ marginTop: '14px' }}
            >
              Clear Search
            </button>
          )}
        </div>
      ) : (
        <div className="admin-kitchen-tickets-grid">
          {ordersByTable.map(([tableLabel, tableOrders]) => {
            const hasNew = tableOrders.some((o) => !o.status || o.status === 'not_started');
            const hasCooking = tableOrders.some((o) => o.status === 'preparing');
            const allReady =
              tableOrders.length > 0 && tableOrders.every((o) => o.status === 'ready');
            const oldestPlacedAt = Math.min(...tableOrders.map((o) => o.placedAt || Date.now()));
            const totalTableSum = tableOrders.reduce((sum, order) => {
              const itemObj = order.item;
              const variantAdj =
                itemObj?.variants?.find((v) => v?.name === order.variant)?.priceAdjustment || 0;
              const itemBasePrice = typeof itemObj?.price === 'number' ? itemObj.price : 0;
              return sum + (itemBasePrice + variantAdj) * (order.quantity || 1);
            }, 0);

            return (
              <div key={tableLabel} className="admin-kitchen-table-card">
                {/* Table Ticket Header */}
                <div className="admin-kitchen-card-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div className="admin-kitchen-table-badge">
                      <span>{tableLabel}</span>
                    </div>
                    <div className="admin-kitchen-card-meta">
                      <span className="admin-kitchen-card-time">
                        <Timer size={13} />
                        {formatElapsed(oldestPlacedAt)}
                      </span>
                      <span className="admin-kitchen-card-dot">•</span>
                      <span className="admin-kitchen-card-items-count">
                        {tableOrders.length} {tableOrders.length === 1 ? 'dish' : 'dishes'}
                      </span>
                    </div>
                  </div>

                  {/* Table-wide Batch Actions */}
                  <div className="admin-kitchen-card-header-actions">
                    {hasNew && (
                      <button
                        type="button"
                        className="admin-kitchen-batch-btn cooking"
                        onClick={() => handleStartTableCooking(tableLabel)}
                        title="Start cooking all items for this table"
                      >
                        <Flame size={14} />
                        <span>Start All</span>
                      </button>
                    )}
                    {hasCooking && (
                      <button
                        type="button"
                        className="admin-kitchen-batch-btn ready"
                        onClick={() => handleMarkTableReady(tableLabel)}
                        title="Mark all cooking items as ready"
                      >
                        <CheckCheck size={14} />
                        <span>Mark All Ready</span>
                      </button>
                    )}
                    {allReady && (
                      <button
                        type="button"
                        className="admin-kitchen-batch-btn complete"
                        onClick={() => handleCompleteTable(tableLabel)}
                        title="Complete and serve all items for this table"
                      >
                        <CheckCircle2 size={14} />
                        <span>Served Table</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setTableToDelete(tableLabel)}
                      title={`Remove / Clear all orders for ${tableLabel}`}
                      style={{
                        background: 'none',
                        border: '1px solid #e2e8f0',
                        color: '#94a3b8',
                        borderRadius: '8px',
                        padding: '6px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.color = '#ef4444';
                        (e.currentTarget as HTMLElement).style.borderColor = '#fecaca';
                        (e.currentTarget as HTMLElement).style.backgroundColor = '#fee2e2';
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.color = '#94a3b8';
                        (e.currentTarget as HTMLElement).style.borderColor = '#e2e8f0';
                        (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Table Dishes List */}
                <div className="admin-kitchen-card-items-list">
                  {tableOrders.map((order) => {
                    const status = order.status || 'not_started';
                    const itemObj = order.item;
                    const variantAdj =
                      itemObj?.variants?.find((v) => v?.name === order.variant)?.priceAdjustment || 0;
                    const itemBasePrice = typeof itemObj?.price === 'number' ? itemObj.price : 0;
                    const itemTotal = (itemBasePrice + variantAdj) * (order.quantity || 1);
                    const itemImg = itemObj?.imageUrl || '/images/cat_food.jpg';
                    const itemName = itemObj?.name || 'Dish Item';

                    return (
                      <div
                        key={order.orderId}
                        className={`admin-kitchen-dish-row status-${status}`}
                      >
                        {/* Quantity + Image + Info */}
                        <div className="admin-kitchen-dish-left">
                          <span className="admin-kitchen-qty-badge">{order.quantity}x</span>

                          <img
                            src={itemImg}
                            alt={itemName}
                            className="admin-kitchen-dish-thumb"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = '/images/cat_food.jpg';
                            }}
                          />

                          <div className="admin-kitchen-dish-details">
                            <div className="admin-kitchen-dish-title">{itemName}</div>
                            {order.variant && (
                              <span className="admin-kitchen-variant-tag">{order.variant}</span>
                            )}
                            <div className="admin-kitchen-dish-sub">
                              <span className="admin-kitchen-dish-price">
                                {formatPrice(itemTotal, activeCurrency)}
                              </span>
                              <span className="admin-kitchen-dish-time">
                                <Clock3 size={11} />
                                {formatElapsed(order.placedAt)}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Status Indicator & Positive Progression Action */}
                        <div className="admin-kitchen-dish-right">
                          {status === 'not_started' && (
                            <button
                              type="button"
                              className="admin-kitchen-action-btn start"
                              onClick={() => handleStatusChange(order.orderId!, 'preparing')}
                              title="Start preparing dish. This locks customer from undoing."
                            >
                              <Flame size={14} />
                              <span>Start Cooking</span>
                            </button>
                          )}

                          {status === 'preparing' && (
                            <button
                              type="button"
                              className="admin-kitchen-action-btn ready"
                              onClick={() => handleStatusChange(order.orderId!, 'ready')}
                              title="Mark dish ready for table delivery"
                            >
                              <Check size={14} />
                              <span>Mark Ready</span>
                            </button>
                          )}

                          {status === 'ready' && (
                            <button
                              type="button"
                              className="admin-kitchen-action-btn complete"
                              onClick={() => handleStatusChange(order.orderId!, 'complete')}
                              title="Mark dish as delivered / served"
                            >
                              <CheckCircle2 size={14} />
                              <span>Served</span>
                            </button>
                          )}

                          {status === 'complete' && (
                            <span className="admin-kitchen-status-pill complete">
                              <CheckCircle2 size={13} />
                              <span>Served</span>
                            </span>
                          )}

                          {status === 'cancelled' && (
                            <span className="admin-kitchen-status-pill cancelled">
                              <span>Cancelled</span>
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Table Card Footer Summary */}
                <div className="admin-kitchen-card-footer">
                  <span className="admin-kitchen-footer-label">Table Total:</span>
                  <span className="admin-kitchen-footer-total">
                    {formatPrice(totalTableSum, activeCurrency)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Confirmation Modal for Clearing All Kitchen Orders */}
      <AdminConfirmModal
        isOpen={isClearAllModalOpen}
        title="Clear Kitchen Queue"
        message="Are you sure you want to clear all orders from the kitchen? This will wipe the active live queue completely."
        confirmLabel="Clear Kitchen"
        isDestructive={true}
        onConfirm={confirmClearAllQueue}
        onClose={() => setIsClearAllModalOpen(false)}
      />

      {/* Confirmation Modal for Deleting a Single Table Ticket */}
      <AdminConfirmModal
        isOpen={Boolean(tableToDelete)}
        title="Remove Table Orders"
        message={`Are you sure you want to remove all orders for ${tableToDelete}? This will dismiss this table ticket.`}
        itemName={tableToDelete || undefined}
        confirmLabel="Remove Table"
        isDestructive={true}
        onConfirm={confirmDeleteTable}
        onClose={() => setTableToDelete(null)}
      />

      {/* Confirmation Modal for Clearing History */}
      <AdminConfirmModal
        isOpen={isClearHistoryModalOpen}
        title="Clear Order History"
        message="Are you sure you want to clear all completed and served orders from history?"
        confirmLabel="Clear History"
        isDestructive={true}
        onConfirm={confirmClearHistory}
        onClose={() => setIsClearHistoryModalOpen(false)}
      />
    </div>
  );
}
