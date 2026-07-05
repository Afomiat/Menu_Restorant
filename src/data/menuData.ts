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
  variants?: { name: string; priceAdjustment: number }[];
}

export interface Category {
  id: string;
  name: string;
  sortOrder: number;
}

export const CATEGORIES: Category[] = [
  { id: 'specials', name: "Specials", sortOrder: 1 },
  { id: 'starters', name: 'Starters', sortOrder: 2 },
  { id: 'mains', name: 'Mains', sortOrder: 3 },
  { id: 'sides', name: 'Sides', sortOrder: 4 },
  { id: 'desserts', name: 'Desserts', sortOrder: 5 },
  { id: 'drinks', name: 'Drinks', sortOrder: 6 }
];

export const MENU_ITEMS: MenuItem[] = [
  // 1. Specials / Chef's Picks (specials)
  {
    id: 'pasta-1',
    categoryId: 'specials',
    name: 'Spaghetti',
    subtitle: 'meat frying',
    description: 'Slow-simmered beef ragù with fresh heritage tomatoes and garden herbs.',
    fullDescription: 'Our signature slow-cooked beef and veal ragù, simmered for six hours with dry red wine, aromatic root vegetables, and San Marzano tomatoes, served over house-made artisanal spaghetti, finished with aged Parmigiano-Reggiano and freshly torn basil leaves.',
    price: 650,
    imageUrl: '/images/spaghetti_beef_ragu.webp',
    tags: ['chef-pick'],
    allergens: ['Gluten', 'Dairy', 'Celery'],
    available: true,
    weightLabel: '500 CR',
    variants: [
      { name: 'Standard Portion', priceAdjustment: 0 },
      { name: 'Double Meat Ragù', priceAdjustment: 150 }
    ]
  },
  {
    id: 'grill-1',
    categoryId: 'specials',
    name: 'Ribeye Steak',
    subtitle: '300g Grain Fed',
    description: 'Angus ribeye char-grilled with smoked garlic herb butter.',
    fullDescription: 'Prime 28-day dry-aged Angus ribeye steak, seared over open hickory flames, basted in rosemary-garlic butter, served with blistered cherry tomatoes and a rich red wine reduction sauce.',
    price: 1200,
    imageUrl: '/images/ribeye_steak.webp',
    tags: ['chef-pick'],
    allergens: ['Dairy'],
    available: true,
    weightLabel: '450 GR'
  },

  // 2. Starters / Appetizers (starters)
  {
    id: 'starter-1',
    categoryId: 'starters',
    name: 'Truffle Garlic Bread',
    subtitle: 'with Sea Salt',
    description: 'Artisanal sourdough spread with black truffle butter and sea salt.',
    fullDescription: 'Crisp sourdough slices wood-fired to perfection, slathered in black truffle butter, baked with whipped buffalo mozzarella, and finished with a pinch of flaky Maldon sea salt and fresh chives.',
    price: 320,
    imageUrl: '/images/truffle_garlic_bread.webp',
    tags: ['vegetarian'],
    allergens: ['Gluten', 'Dairy'],
    available: true,
    weightLabel: '220 GR'
  },
  {
    id: 'starter-2',
    categoryId: 'starters',
    name: 'Burrata & Heirloom',
    subtitle: 'with Fig Balsamic',
    description: 'Creamy burrata surrounded by heritage tomatoes and aged balsamic glaze.',
    fullDescription: 'Fresh Italian burrata cheese paired with multi-colored heirloom tomatoes, dressed in a 12-year aged balsamic reduction and cold-pressed olive oil, sprinkled with toasted pine nuts and fresh baby basil.',
    price: 480,
    imageUrl: '/images/burrata_heirloom.webp',
    tags: ['vegetarian', 'gluten-free'],
    allergens: ['Dairy', 'Nuts'],
    available: true,
    weightLabel: '280 GR'
  },

  // 3. Mains / Entrées (mains)
  {
    id: 'pasta-2',
    categoryId: 'mains',
    name: 'Spaghetti',
    subtitle: 'with Olive Oil',
    description: 'Pressed Tuscan olive oil, toasted garlic chips, and vine-ripened cherry tomatoes.',
    fullDescription: 'Cold-pressed extra virgin olive oil infused with garlic slivers toasted to gold, tossed with vine-ripened cherry tomatoes, crushed red chili flakes, and fresh parsley, served over thin spaghetti and garnished with a sprig of fresh basil and cracked black pepper.',
    price: 380,
    imageUrl: '/images/spaghetti_aglio_olio.webp',
    tags: ['vegetarian', 'gluten-free'],
    allergens: ['Garlic'],
    available: true,
    weightLabel: '410 GR',
    variants: [
      { name: 'Standard Portion', priceAdjustment: 0 },
      { name: 'With Gluten-Free Pasta', priceAdjustment: 80 }
    ]
  },
  {
    id: 'pasta-3',
    categoryId: 'mains',
    name: 'Taco Pesto',
    subtitle: 'Soup Recipe',
    description: 'A vibrant sweet basil pesto spaghetti accented by micro-basil and pine nuts.',
    fullDescription: 'A custom fusion green spaghetti coated in a rich pesto cream sauce crafted from sweet Genovese basil, roasted pine nuts, fresh garlic, extra virgin olive oil, and Parmigiano-Reggiano, decorated with edible flowers, fresh basil leaves, and gold flakes.',
    price: 580,
    imageUrl: '/images/basil_pesto_pasta.webp',
    tags: ['vegetarian'],
    allergens: ['Nuts', 'Dairy', 'Gluten'],
    available: true,
    weightLabel: '430 CR',
    variants: [
      { name: 'Standard Portion', priceAdjustment: 0 },
      { name: 'Add Crumbled Goat Cheese', priceAdjustment: 100 }
    ]
  },
  {
    id: 'pasta-4',
    categoryId: 'mains',
    name: 'Spaghetti',
    subtitle: 'with Shrimp & Mushroom',
    description: 'Noodles with pan-seared prawns and sautéed seasonal forest mushrooms.',
    fullDescription: 'Pan-seared ocean king prawns and a selection of forest wild mushrooms sautéed in a dry white wine butter sauce, combined with delicate hand-pulled pasta strings and finished with fresh microgreens and lemon zest.',
    price: 680,
    imageUrl: '/images/shrimp_mushroom_pasta.webp',
    tags: ['spicy'],
    allergens: ['Shellfish', 'Dairy', 'Gluten'],
    available: true,
    weightLabel: '370 CR'
  },
  {
    id: 'grill-2',
    categoryId: 'mains',
    name: 'Charred Octopus',
    subtitle: 'with Romesco',
    description: 'Tender grilled octopus tentacle with roasted red pepper romesco.',
    fullDescription: 'Slow-braised octopus tentacle charred on wood coals, served on a rich almond and roasted red bell pepper romesco paste, drizzled with lemon-herb oil and microgreens.',
    price: 850,
    imageUrl: '/images/charred_octopus.webp',
    tags: ['gluten-free', 'spicy'],
    allergens: ['Nuts', 'Molluscs'],
    available: true,
    weightLabel: '310 GR'
  },

  // 4. Sides (sides)
  {
    id: 'side-1',
    categoryId: 'sides',
    name: 'Truffle Fries',
    subtitle: 'with Parmesan',
    description: 'Crispy thin-cut fries tossed with white truffle oil and fresh rosemary.',
    fullDescription: 'Gourmet thin-cut fries fried to a perfect golden crisp, seasoned with sea salt, drizzled with white truffle oil, and generously dusted with grated Parmigiano-Reggiano and fresh rosemary sprigs.',
    price: 250,
    imageUrl: '/images/truffle_fries.webp',
    tags: ['vegetarian'],
    allergens: ['Dairy'],
    available: true,
    weightLabel: '180 GR'
  },
  {
    id: 'side-2',
    categoryId: 'sides',
    name: 'Charred Broccolini',
    subtitle: 'with Garlic & Chili',
    description: 'Wood-fired tender broccolini sautéed with toasted garlic slivers.',
    fullDescription: 'Tender fresh broccolini stems grilled over wood flames, tossed with extra virgin olive oil, toasted garlic chips, chili flakes, and finished with fresh lemon juice.',
    price: 280,
    imageUrl: '/images/charred_broccolini.webp',
    tags: ['vegetarian', 'gluten-free'],
    allergens: ['Garlic'],
    available: true,
    weightLabel: '150 GR'
  },

  // 5. Desserts (desserts)
  {
    id: 'dessert-1',
    categoryId: 'desserts',
    name: 'Classic Tiramisu',
    subtitle: 'House-Made',
    description: 'Espresso-soaked ladyfingers layered with rich mascarpone sabayon.',
    fullDescription: 'An authentic Italian dessert of ladyfinger cookies dipped in premium espresso and dark rum, layered with whipped mascarpone cheese and sabayon cream, finished with a heavy dust of fine Dutch cocoa powder.',
    price: 290,
    imageUrl: '/images/classic_tiramisu.webp',
    tags: ['vegetarian'],
    allergens: ['Gluten', 'Dairy', 'Eggs'],
    available: true,
    weightLabel: '200 GR'
  },
  {
    id: 'dessert-2',
    categoryId: 'desserts',
    name: 'Pistachio Panna Cotta',
    subtitle: 'with Berry Coulis',
    description: 'Silky vanilla bean custard infused with roasted Sicilian pistachio.',
    fullDescription: 'Silky, cold-set custard crafted from fresh dairy cream and organic vanilla beans, blended with toasted Sicilian pistachio paste, topped with fresh raspberry coulis and crushed pistachios.',
    price: 320,
    imageUrl: '/images/pistachio_panna_cotta.webp',
    tags: ['vegetarian', 'gluten-free'],
    allergens: ['Dairy', 'Nuts'],
    available: true,
    weightLabel: '160 GR'
  },

  // 6. Drinks (drinks)
  {
    id: 'drink-1',
    categoryId: 'drinks',
    name: 'Fresh Orange Juice',
    subtitle: 'Cold Pressed',
    description: 'Freshly squeezed sweet oranges packed with natural vitamins.',
    fullDescription: 'Locally sourced sweet oranges, cold-pressed to order to preserve maximum nutrients and flavor, served chilled over ice with a fresh orange wedge on the rim.',
    price: 150,
    imageUrl: '/images/fresh_juice.webp',
    tags: ['vegetarian', 'vegan', 'gluten-free'],
    available: true,
    weightLabel: '300 ML'
  },
  {
    id: 'drink-2',
    categoryId: 'drinks',
    name: 'Classic Mojito',
    subtitle: 'Refreshing Cocktail',
    description: 'A vibrant blend of white rum, fresh mint, lime, and sparkling soda.',
    fullDescription: 'The ultimate refreshing cocktail made with premium white rum, muddled fresh mint leaves, squeezed lime juice, and a touch of cane sugar syrup, topped with sparkling soda water and served over crushed ice.',
    price: 350,
    imageUrl: '/images/classic_mojito.webp',
    tags: ['vegetarian', 'vegan', 'gluten-free'],
    available: true,
    weightLabel: '250 ML'
  },
  {
    id: 'drink-3',
    categoryId: 'drinks',
    name: 'Artisanal Espresso',
    subtitle: 'House Roasted',
    description: 'A rich and velvety shot of our signature house-roasted espresso.',
    fullDescription: 'A perfectly extracted double shot of our signature blend coffee beans, featuring notes of dark chocolate and caramel, topped with a beautiful thick crema and elegant latte art.',
    price: 120,
    imageUrl: '/images/artisanal_coffee.webp',
    tags: ['vegetarian', 'gluten-free', 'chef-pick'],
    available: true,
    weightLabel: '60 ML'
  }
];
