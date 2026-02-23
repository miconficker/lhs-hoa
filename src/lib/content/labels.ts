// Common UI labels using UK plain language standards
export const labels = {
  // Navigation
  dashboard: "Home",
  map: "Map",
  reservations: "Book a space",
  payments: "Payments",
  documents: "Documents",
  announcements: "News",
  polls: "Have your say",
  myLots: "My property",

  // Actions
  submit: "Send",
  cancel: "Cancel",
  save: "Save",
  delete: "Delete",
  edit: "Change",
  create: "Create new",
  search: "Search",
  filter: "Filter",
  export: "Download",
  import: "Upload",
  newRequest: "New request",
  newPayment: "New payment",
  view: "View",
  update: "Update",
  viewQR: "View QR",
  signIn: "Sign in",
  signingIn: "Signing in...",

  // Form labels
  email: "Email address",
  password: "Password",
  confirmPassword: "Confirm password",
  firstName: "First name",
  lastName: "Last name",
  address: "Address",
  phone: "Phone number",
  description: "Details",
  amount: "Amount",
  paymentMethod: "Payment method",
  period: "Period",
  referenceNumber: "Reference number",
  selectMethod: "Select method",

  // Status
  pending: "Waiting",
  inProgress: "In progress",
  completed: "Done",
  rejected: "Not approved",
  approved: "Approved",
  failed: "Failed",

  // Admin
  adminPanel: "Admin panel",
  users: "People",
  households: "Households",
  lots: "Properties",
  settings: "Settings",

  // Login page
  signInTitle: "Sign in to your account",
  signInWithGoogle: "Sign in with Google",
  orContinueWithEmail: "Or continue with email",
  noAccountMessage:
    "Don't have an account? Contact your HOA admin to get approved.",

  // Service requests
  serviceRequests: "Service requests",
  status: "Status",
  priority: "Priority",
  category: "Category",
  all: "All",
  noRequestsFound: "No problems reported yet.",

  // Payments
  outstandingBalance: "Outstanding balance",
  paymentHistory: "Payment history",
  createPayment: "Create payment",
  scanToPay: "Scan to pay with",
  amountPHP: "Amount (PHP)",
  periodsDue: "Periods due",
  noPaymentHistory: "No payments yet.",
  gcashPayment: "GCash payment",
  gcashInstructions: [
    "Open GCash app and scan the QR code",
    "Enter the amount and confirm payment",
    "Save the receipt/reference number",
    "Payment will be verified and updated automatically",
  ],

  // Categories and priorities
  plumbing: "Plumbing",
  electrical: "Electrical",
  commonArea: "Common area",
  security: "Security",
  other: "Other",
  low: "Low",
  normal: "Normal",
  high: "High",
  urgent: "Urgent",

  // Payment methods
  gcash: "GCash",
  paymaya: "PayMaya",
  instapay: "Instapay",
  cash: "Cash",
  inPerson: "In-Person",
} as const;

export type LabelKey = keyof typeof labels;
