// Common UI labels using UK plain language standards
export const labels = {
  // Navigation
  dashboard: "Home",
  map: "Map",
  serviceRequests: "Report a problem",
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

  // Form labels
  email: "Email address",
  password: "Password",
  confirmPassword: "Confirm password",
  firstName: "First name",
  lastName: "Last name",
  address: "Address",
  phone: "Phone number",
  description: "Details",

  // Status
  pending: "Waiting",
  inProgress: "In progress",
  completed: "Done",
  rejected: "Not approved",
  approved: "Approved",

  // Admin
  adminPanel: "Admin panel",
  users: "People",
  households: "Households",
  lots: "Properties",
  settings: "Settings",
} as const;

export type LabelKey = keyof typeof labels;
