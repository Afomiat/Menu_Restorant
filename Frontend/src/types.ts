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
  plan?: 'standard' | 'vip';
}

export type OrderStatus =
  | 'not_started'
  | 'pending_grace'
  | 'received'
  | 'preparing'
  | 'ready'
  | 'delivered'
  | 'complete'
  | 'cancelled';

export interface CartItem {
  item: MenuItem;
  quantity: number;
  variant?: string;
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
  plan?: 'standard' | 'vip';
}

export interface BackendTenant {
  id: string;
  slug: string;
  name: string;
  plan: 'standard' | 'vip';
  currency: string;
  theme_config: Record<string, any>;
  is_active: boolean;
}

export interface BackendCategory {
  id: string;
  tenant_id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
}

export interface BackendMenuItem {
  id: string;
  tenant_id: string;
  category_id: string;
  name: string;
  description: string;
  price: number;
  image_url: string;
  tags: string[];
  is_available: boolean;
  is_sold_out: boolean;
  created_at: string;
}

export interface BackendFullMenuResponse {
  data: {
    tenant: BackendTenant;
    categories: BackendCategory[];
    items: BackendMenuItem[];
  };
}

export interface BackendOrderItemModifier {
  id?: string;
  modifier_id: string;
  modifier_name: string;
  price_applied: number;
}

export interface BackendOrderItem {
  id: string;
  order_id: string;
  menu_item_id: string;
  item_name: string;
  unit_price: number;
  quantity: number;
  notes: string;
  modifiers?: BackendOrderItemModifier[];
}

export interface BackendOrder {
  id: string;
  tenant_id: string;
  table_id?: string;
  table_number: string;
  customer_session_token: string;
  status: OrderStatus;
  total_amount: number;
  grace_period_ends_at: string;
  created_at: string;
  items?: BackendOrderItem[];
}


