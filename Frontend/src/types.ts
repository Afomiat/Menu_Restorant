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
  /** Minutes the dish takes to cook; empty uses the restaurant's default prep time (Pro). */
  prepMinutes?: number | null;
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
  /** Restaurant logo shown in the menu header (image URL or /public path). */
  logoUrl?: string;
  /** Free-text opening hours, e.g. "Daily 11:00 AM – 10:00 PM". */
  openingHours?: string;
  plan?: PlanTier;
  /** Pro timings; present on the staff profile (GET /admin/tenant). */
  settings?: TenantSettings;
  /** Backend tenant slug. Set only for restaurants loaded from the live API. */
  slug?: string;
}

/** Plan tiers from lowest to highest: each plan includes everything below it. */
export type PlanTier = 'basic' | 'plus' | 'pro';

/** Staff roles; super_admin is the Azai team. */
export type StaffRole = 'manager' | 'cashier' | 'waiter' | 'chef' | 'super_admin';

/** A staff account as the manager's Staff screen shows it. */
export interface StaffMember {
  id: string;
  tenant_id: string;
  full_name: string;
  phone: string;
  email: string;
  role: StaffRole;
  is_active: boolean;
  created_at: string;
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
  /** The order's cooking target in minutes (Pro): its slowest dish. */
  targetMinutes?: number;
  /** When the chef started the order (ms), for the timer and the customer's estimate. */
  startedAt?: number;
}

/** A restaurant's Pro timings, in minutes. */
export interface TenantSettings {
  default_prep_minutes: number;
  bill_reminder_minutes: number;
  bill_escalation_minutes: number;
  confirm_reminder_minutes: number;
  long_table_minutes: number;
}

export interface RestaurantMenu {
  meta: RestaurantMeta;
  categories: Category[];
  items: MenuItem[];
  plan?: PlanTier;
}

export interface BackendTenant {
  id: string;
  slug: string;
  name: string;
  plan: PlanTier;
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
  prep_minutes?: number | null;
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
  target_minutes?: number;
  started_at?: string | null;
  started_by?: string | null;
  ready_at?: string | null;
  ready_by?: string | null;
  served_at?: string | null;
  served_by?: string | null;
}

/** A dining table as staff screens see it (Pro adds its waiter). */
export interface BackendTable {
  id: string;
  tenant_id: string;
  table_number: string;
  is_active: boolean;
  assigned_waiter_id?: string | null;
  assigned_waiter_name?: string;
}

/** One table with its open orders, for the waiter's screen. */
export interface TableOrders {
  table: BackendTable;
  orders: BackendOrder[];
}


