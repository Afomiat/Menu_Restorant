/**
 * Text shown on the staff screens. New staff-facing text lives here so another language
 * (Amharic) can be added later as a file with the same keys.
 */
export const en = {
  roles: {
    manager: 'Manager',
    cashier: 'Cashier',
    waiter: 'Waiter',
    chef: 'Chef',
    super_admin: 'Azai team',
  },

  login: {
    identifierLabel: 'Phone number or email',
    identifierPlaceholder: '0911 234 567',
    missingFields: 'Please enter your phone number (or email) and password.',
  },

  staff: {
    title: 'Staff',
    navLabel: 'Staff',
    proOnly: 'Staff accounts are part of the Pro plan. Upgrade to Pro to give each waiter, chef and cashier their own login.',
    loading: 'Loading staff…',
    empty: 'No staff yet. Add your first staff member below.',
    addTitle: 'Add staff member',
    fullName: 'Full name',
    phone: 'Phone number',
    phonePlaceholder: '0911 234 567',
    email: 'Email (optional)',
    password: 'Password',
    passwordHint: 'At least 6 characters. Give it to the staff member; they sign in with their phone and this password.',
    role: 'Role',
    add: 'Add',
    adding: 'Adding…',
    added: (name: string) => `${name} was added`,
    you: 'You',
    active: 'Active',
    inactive: 'Turned off',
    turnOff: 'Turn off',
    turnOn: 'Turn on',
    resetPassword: 'New password',
    resetPasswordPrompt: (name: string) => `New password for ${name} (at least 6 characters)`,
    passwordReset: (name: string) => `Password changed for ${name}`,
    saved: 'Saved',
  },

  kitchen: {
    title: 'Kitchen',
    enableSound: 'Tap to enable sound',
    empty: 'No open orders. New orders appear here with a bell.',
    table: (n: string) => `Table ${n}`,
    waiting: (waited: string, target: number) => `New · ${waited} · ${target} min`,
    cooking: 'Cooking',
    readyWaiting: 'Ready · waiting for the waiter',
    start: 'Start',
    ready: 'Ready',
    served: 'Served',
    cancel: 'Cancel order',
    veryLate: (table: string, minutes: number, target: number) =>
      `Table ${table}: cooking for ${minutes} min (target ${target} min)`,
    dismiss: 'Dismiss',
  },

  waiter: {
    title: 'My tables',
    empty: 'No tables are assigned to you yet. Ask your manager.',
    noOrders: 'No open orders',
    foodReady: 'Food ready',
    cooking: 'Cooking',
    ordered: 'Ordered',
    served: 'Served',
    readyBanner: (table: string) => `Table ${table}: food is ready`,
    order: (n: number) => `Order ${n}`,
  },

  tables: {
    waiter: 'Waiter',
    noWaiter: 'No waiter (alerts go to managers)',
  },

  settings: {
    proTitle: 'Pro timings (minutes)',
    defaultPrep: 'Default prep time',
    billReminder: 'Remind waiter about an unpaid bill after',
    billEscalation: 'Alert manager about an unpaid bill after',
    confirmReminder: 'Remind cashier to confirm after',
    longTable: 'Remind waiter about a long-open table after',
    save: 'Save timings',
    saved: 'Timings saved',
  },

  dish: {
    prepMinutes: 'Prep time (minutes)',
    prepHint: (fallback: number) => `Leave empty to use the restaurant default (${fallback} min).`,
  },

  roleHome: {
    greeting: (name: string) => (name ? `Hello, ${name}` : 'Hello'),
    signedInAs: (role: string) => `Signed in as ${role}`,
    waiterComing: 'Your tables, food-ready bells and bills will appear here.',
    cashierComing: 'Bills waiting for confirmation will appear here.',
    signOut: 'Sign out',
  },

  inactiveNotice: 'Your account was turned off by a manager. Ask your manager if this is a mistake.',
};

export const t = en;
