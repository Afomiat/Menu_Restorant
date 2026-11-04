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
