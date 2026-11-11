import { tableLabel } from '../utils/table';

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
    save: 'Save',
    saved: 'Saved',
    edit: 'Edit',
    cancel: 'Cancel',
    editName: (name: string) => `Full name of ${name}`,
    editPhone: (name: string) => `Phone number of ${name}`,
    detailsSaved: (name: string) => `Saved ${name}`,
    nameRequired: 'Enter a full name.',
    phoneNotSaved:
      'The name was saved, but the phone number could not be changed yet: the server does not support it. Ask the Azai team.',
  },

  kitchen: {
    title: 'Kitchen',
    enableSound: 'Tap to enable sound',
    empty: 'No open orders. New orders appear here with a bell.',
    table: (n: string) => tableLabel(n),
    waiting: (waited: string, target: number) => `New · ${waited} · ${target} min`,
    cooking: 'Cooking',
    readyWaiting: 'Ready · waiting for the waiter',
    start: 'Start',
    ready: 'Ready',
    served: 'Served',
    cancel: 'Cancel order',
    veryLate: (table: string, minutes: number, target: number) =>
      `${tableLabel(table)}: cooking for ${minutes} min (target ${target} min)`,
    dismiss: 'Dismiss',
    remake: 'REMAKE',
  },

  waiter: {
    title: 'My tables',
    empty: 'No tables are assigned to you yet. Ask your manager.',
    noOrders: 'No open orders',
    foodReady: 'Food ready',
    cooking: 'Cooking',
    ordered: 'Ordered',
    served: 'Served',
    readyBanner: (table: string) => `${tableLabel(table)}: food is ready`,
    order: (n: number) => `Order ${n}`,
  },

  tables: {
    waiter: 'Waiter',
    noWaiter: 'No waiter (alerts go to managers)',
    noWaiterShort: 'no waiter',
    turnedOff: (name: string) => `${name} (turned off)`,
    saved: 'Saved',
    downloadQr: 'Download QR',
    printSticker: 'Print sticker',
    stickerHint: 'Scan to see the menu and order',
    qrFailed: 'Could not draw the QR code. Copy the link instead.',
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

  bills: {
    title: 'Bills',
    navLabel: 'Bills',
    status: {
      open: 'Eating',
      bill_requested: 'Bill asked',
      collected: 'Collected',
      confirmed: 'Confirmed',
      walkout: 'Walkout',
    } as Record<string, string>,
    methods: { cash: 'Cash', telebirr: 'Telebirr', cbe_birr_bank: 'CBE Birr / bank' } as Record<string, string>,
    total: 'Total',
    paid: 'Paid',
    owed: 'Owed',
    askBill: 'Ask for bill',
    collect: 'Collect',
    collectTitle: (table: string) => `Collect for table ${table}`,
    amount: 'Amount',
    method: 'Paid by',
    reference: 'Transaction reference',
    referenceHint: 'From the Telebirr or CBE SMS, so the cashier can check it.',
    save: 'Save',
    cancel: 'Cancel',
    confirm: 'Confirm money received',
    move: 'Move or join table',
    moveTo: 'To table',
    handover: 'Hand over',
    handoverTo: 'Hand to',
    waiter: (name: string) => (name ? `Waiter: ${name}` : 'No waiter'),
    sectionCollected: 'Collected, waiting for you to confirm',
    sectionOpen: 'Open bills',
    sectionConfirmed: 'Confirmed today',
    none: 'Nothing here.',
    collectedBy: (name: string, method: string) => `${name} · ${method}`,
  },

  shift: {
    start: 'Start shift',
    end: 'End shift',
    onShift: (since: string) => `On shift since ${since}`,
    offShift: 'Not on shift',
  },

  /** Banners for live alerts, by event. */
  alerts: {
    'bill:requested': (table: string) => `${tableLabel(table)} asks for the bill`,
    'bill:reminder': (table: string) => `${tableLabel(table)}: the bill is still unpaid`,
    'bill:escalated': (table: string) => `${tableLabel(table)}: the bill is unpaid for a long time`,
    'bill:collected': (table: string) => `${tableLabel(table)}: money collected, please confirm`,
    'bill:unconfirmed': (table: string) => `${tableLabel(table)}: collected money not confirmed yet`,
    'bill:handed_over': (table: string) => `${tableLabel(table)}'s bill was handed to you`,
    'table:long_open': (table: string) => `${tableLabel(table)} has been open a long time`,
    'table:open_bill_rescanned': (table: string) => `New customers at table ${table}, but its bill is unpaid`,
    'shift:open_bills': () => 'A waiter tried to end their shift with unpaid bills',
    'problem:reported': (table: string) => `${tableLabel(table)} reported a problem with a dish`,
    'walkout:marked': (table: string) => `${tableLabel(table)} left without paying`,
  } as Record<string, (table: string) => string>,

  problems: {
    report: 'Report problem',
    reportTitle: (dish: string) => `What is wrong with ${dish}?`,
    reasons: {
      cold: 'Cold',
      wrong_dish: 'Wrong dish',
      undercooked: 'Undercooked',
      too_slow: 'Too slow',
      foreign_object: 'Foreign object',
      other: 'Other',
    } as Record<string, string>,
    note: 'Note',
    send: 'Send to manager',
    sent: 'Sent to the manager',
    decisions: { remake: 'Remake', remove_from_bill: 'Remove from bill' } as Record<string, string>,
    faults: { kitchen: 'Kitchen', waiter: 'Waiter', none: 'No one' } as Record<string, string>,
    fault: 'Who was at fault',
    people: (ready: string, served: string, reported: string) =>
      `Readied by ${ready || '—'} · served by ${served || '—'} · reported by ${reported || '—'}`,
  },

  walkouts: {
    mark: 'Left without paying',
    confirmMark: (table: string, amount: string) => `Mark table ${table} as a walkout of ${amount}?`,
    summary: (table: string, amount: string, waiter: string) =>
      `${tableLabel(table)} left without paying ${amount}${waiter ? `, waiter ${waiter}` : ''}`,
    decisions: { waiter_pays: 'Waiter pays', restaurant_loss: 'Restaurant takes the loss' } as Record<string, string>,
    note: 'Note (optional)',
  },

  decisionsScreen: {
    title: 'Alerts',
    navLabel: 'Alerts',
    problems: 'Problems with dishes',
    walkouts: 'Walkouts',
    none: 'Nothing waiting for you.',
    decide: 'Decide',
  },

  reports: {
    title: 'Reports',
    navLabel: 'Reports',
    date: 'Day',
    sales: 'Sales by payment method',
    salesTotal: 'Total collected',
    waiters: 'Waiters',
    waiterColumns: ['Waiter', 'Bills', 'Sales', 'Collected', 'Confirmed', 'Not confirmed', 'Walkouts'],
    losses: 'Losses',
    walkouts: 'Walkouts',
    removed: 'Dishes removed from bills',
    kitchen: 'Kitchen times',
    kitchenColumns: ['Dish', 'Orders', 'Average', 'Target', 'Late'],
    openBills: 'Bills still open',
    minutes: (m: number) => `${m.toFixed(1)} min`,
    nothing: 'Nothing for this day.',
    noWaiter: 'No waiter',
  },

  myShift: {
    collected: (amount: string, notConfirmed: string) => `This shift: collected ${amount} · not confirmed yet ${notConfirmed}`,
    confirmed: (amount: string, bills: number) => `This shift: confirmed ${amount} on ${bills} bill(s)`,
  },

  push: {
    enable: 'Turn on phone alerts',
    enabled: 'Phone alerts are on',
    blocked: 'Alerts are blocked in this browser. Allow notifications for this site in the browser settings.',
    unsupported: 'This browser cannot show alerts. On iPhone, add this page to the home screen first.',
  },

  customerBill: {
    ask: 'Ask for the bill',
    asked: 'Your waiter is bringing the bill',
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
