import { useState, useEffect } from 'react';
import Header from './components/Header';
import MenuTimeline from './components/MenuTimeline';
import ItemDetailModal from './components/ItemDetailModal';
import CartDrawer from './components/CartDrawer';
import type { CartItem } from './components/CartDrawer';
import OfflineBanner from './components/OfflineBanner';
import SkeletonLoader from './components/SkeletonLoader';
import { CATEGORIES, MENU_ITEMS } from './data/menuData';
import type { MenuItem } from './data/menuData';
import { HelpCircle } from 'lucide-react';

export default function App() {
  const [tableNumber, setTableNumber] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('specials');
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCartOpen, setIsCartOpen] = useState(false);

  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const stored = localStorage.getItem('aura_menu_cart');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Table Detection
  useEffect(() => {
    const detectTable = () => {
      // 1. Check path routing: /t/12
      const path = window.location.pathname;
      const pathMatch = path.match(/\/t\/(\d+)/);
      if (pathMatch) {
        setTableNumber(pathMatch[1]);
        return;
      }

      // 2. Check query param: ?table=12
      const params = new URLSearchParams(window.location.search);
      const queryTable = params.get('table');
      if (queryTable) {
        setTableNumber(queryTable);
      }
    };

    detectTable();
  }, []);

  // Sync Cart to localStorage
  useEffect(() => {
    localStorage.setItem('aura_menu_cart', JSON.stringify(cart));
  }, [cart]);

  // Simulate loading state for skeletons
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1200);
    return () => clearTimeout(timer);
  }, []);

  // Scroll Spy Observer
  useEffect(() => {
    if (isLoading) return;

    const sections = CATEGORIES.map((cat) => document.getElementById(cat.id));
    const observerOptions = {
      root: null,
      rootMargin: '-160px 0px -50% 0px', // Triggers when section enters active header zone
      threshold: 0
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setActiveCategory(entry.target.id);
        }
      });
    }, observerOptions);

    sections.forEach((section) => {
      if (section) observer.observe(section);
    });

    return () => {
      sections.forEach((section) => {
        if (section) observer.unobserve(section);
      });
    };
  }, [isLoading]);

  // Category selection click navigation
  const handleCategorySelect = (id: string) => {
    setActiveCategory(id);
    const element = document.getElementById(id);
    if (element) {
      const headerOffset = 180;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
  };

  // Add Item to Order Tray
  const handleAddToOrder = (item: MenuItem, qty: number, variant: string) => {
    setCart((prev) => {
      const existingIdx = prev.findIndex(
        (ci) => ci.item.id === item.id && ci.variant === variant
      );
      if (existingIdx > -1) {
        const next = [...prev];
        next[existingIdx].quantity += qty;
        return next;
      }
      return [...prev, { item, quantity: qty, variant }];
    });
    setIsCartOpen(true);
  };

  // Update Item Quantity in Tray
  const handleUpdateQuantity = (idx: number, change: number) => {
    setCart((prev) => {
      const next = [...prev];
      const nextQty = next[idx].quantity + change;
      if (nextQty <= 0) {
        next.splice(idx, 1);
        return next;
      }
      next[idx].quantity = nextQty;
      return next;
    });
  };

  // Remove Item from Tray
  const handleRemoveItem = (idx: number) => {
    setCart((prev) => prev.filter((_, i) => i !== idx));
  };

  // Clear Tray after order submission
  const handleClearCart = () => {
    setCart([]);
  };

  // Filter Items
  const filteredItems = MENU_ITEMS.filter((item) => {
    const matchesSearch = searchQuery
      ? item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.subtitle?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase())
      : true;

    return matchesSearch && item.available;
  });

  // Helper: check if a category has any items after filters
  const getCategoryItems = (categoryId: string) => {
    return filteredItems.filter((item) => item.categoryId === categoryId);
  };

  return (
    <div className="app-container">
      {/* Offline Banner */}
      <OfflineBanner />

      {/* Header Sticky */}
      <Header
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        categories={isLoading ? [] : CATEGORIES.filter((cat) => getCategoryItems(cat.id).length > 0)}
        activeCategory={activeCategory}
        onCategorySelect={handleCategorySelect}
        totalCartItems={cart.reduce((sum, item) => sum + item.quantity, 0)}
        onCartClick={() => setIsCartOpen(true)}
      />

      {/* Main Content Area */}
      {isLoading ? (
        <SkeletonLoader />
      ) : (
        <div style={{ flexGrow: 1 }}>
          {CATEGORIES.map((category) => {
            const categoryItems = getCategoryItems(category.id);
            if (categoryItems.length === 0) return null;

            return (
              <section
                key={category.id}
                id={category.id}
                className="category-section fade-in"
                style={{
                  paddingTop: '24px',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.02)'
                }}
              >
                {/* Section Eyebrow Header */}
                <div
                  style={{
                    padding: '0 20px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <h2
                    style={{
                      fontFamily: 'var(--font-serif)',
                      fontSize: '38px',
                      fontWeight: 400,
                      fontStyle: 'italic',
                      color: 'var(--accent-gold)',
                      textAlign: 'center',
                      letterSpacing: '1px'
                    }}
                  >
                    {category.name}
                  </h2>
                </div>

                {/* Timeline rendering for this category */}
                <MenuTimeline items={categoryItems} onItemSelect={setSelectedItem} />
              </section>
            );
          })}
        </div>
      )}

      {/* Item Detail Slide-Up Modal */}
      <ItemDetailModal
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
        onAddToOrder={handleAddToOrder}
      />

      {/* Bottom Cart Drawer */}
      <CartDrawer
        cart={cart}
        tableNumber={tableNumber}
        isOpen={isCartOpen}
        setIsOpen={setIsCartOpen}
        onUpdateQuantity={handleUpdateQuantity}
        onRemoveItem={handleRemoveItem}
        onClearCart={handleClearCart}
      />

      {/* Footer Branding */}
      <footer
        style={{
          padding: '40px 24px 100px 24px',
          textAlign: 'center',
          borderTop: '1px solid rgba(255,255,255,0.02)',
          backgroundColor: 'var(--bg-dark)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '8px'
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: '18px',
            letterSpacing: '1px',
            color: 'var(--text-primary)',
            opacity: 0.8
          }}
        >
          AURA
        </span>
        <span
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: '10px',
            color: 'var(--text-secondary)',
            letterSpacing: '2px',
            textTransform: 'uppercase',
            opacity: 0.6
          }}
        >
          An Elegant Dining Experience
        </span>
      </footer>
    </div>
  );
}
