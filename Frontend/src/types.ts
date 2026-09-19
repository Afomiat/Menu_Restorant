export interface MenuItem {
  id: string;
  categoryId: string;
  name: string;
  subtitle?: string;
  description: string;
  fullDescription?: string;
  price: number;
  imageUrl: string;
  tags: ('vegetarian' | 'spicy' | 'gluten-free' | 'vegan' | 'chef-pick')[];
  allergens?: string[];
  available: boolean;
  weightLabel?: string; // e.g. "500 CR", "410 GR"
  badge?: string; // e.g. "-25%", "POPULAR", "NEW"
  variants?: { name: string; priceAdjustment: number }[];
}

export interface Category {
  id: string;
  name: string;
  sortOrder: number;
  iconUrl?: string;
}

export interface RestaurantTheme {
  primary: string;           // Brand accent color (buttons, active pills, badges, highlights)
  secondary?: string;        // Secondary / hover color (gradients, hover states)
  primaryLight?: string;     // Very soft tint for badge backgrounds (e.g. #fff2ed or rgba)
  background?: string;       // Page background (e.g. #f8f9fb for light, #15161c for dark)
  surface?: string;          // Cards, sheets, modals (e.g. #ffffff or #1b1d26)
  text?: string;             // Primary typography color
  textMuted?: string;        // Muted / secondary typography color
  darkBar?: string;          // Floating navigation bar / dark pill containers
  mode?: 'light' | 'dark';   // Optional theme mode hint
}

export interface RestaurantMeta {
  name: string;
  tagline: string;
  themeColor: string;
  theme?: RestaurantTheme;
  colors?: RestaurantTheme;
  template?: 'classic' | 'modern';
  deliveryAddress?: string;
  currency?: string;
  heroImageUrl?: string;
  heroTitle?: string;
  heroSubtitle?: string;
  heroBadges?: string[];
}

export type OrderStatus = 'not_started' | 'preparing' | 'ready' | 'complete' | 'cancelled';

export interface CartItem {
  item: MenuItem;
  quantity: number;
  variant: string;
  notes?: string;
  orderId?: string;
  placedAt?: number;
  status?: OrderStatus;
  tableNumber?: string | null;
}

export interface RestaurantMenu {
  meta: RestaurantMeta;
  categories: Category[];
  items: MenuItem[];
}


