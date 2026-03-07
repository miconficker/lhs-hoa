import type {
  User,
  Household,
  Lot,
  Payment,
  ServiceRequest,
  Notification,
} from "@/types";

/**
 * Test data factories for creating consistent mock data
 */

// User factories
export const createMockUser = (overrides: Partial<User> = {}): User => ({
  id: "user-1",
  email: "test@example.com",
  role: "resident",
  name: "Test User",
  ...overrides,
});

export const mockUsers = {
  admin: createMockUser({
    id: "admin-1",
    email: "admin@lagunahills.com",
    role: "admin",
    name: "Admin User",
  }),
  resident: createMockUser({
    id: "resident-1",
    email: "resident@lagunahills.com",
    role: "resident",
    name: "Resident User",
  }),
  staff: createMockUser({
    id: "staff-1",
    email: "staff@lagunahills.com",
    role: "staff",
    name: "Staff User",
  }),
};

// Household factories
export const createMockHousehold = (
  overrides: Partial<Household> = {},
): Household => ({
  id: "household-1",
  lot_id: "lot-1",
  owner_user_id: "user-1",
  address: "123 Main Street",
  street: "Main Street",
  block: "Block 1",
  lot: "Lot 1",
  ...overrides,
});

export const mockHouseholds = {
  household1: createMockHousehold({
    id: "household-1",
    lot_id: "lot-1",
    owner_user_id: "resident-1",
    address: "Block 1, Lot 1, Main Street",
    street: "Main Street",
    block: "Block 1",
    lot: "Lot 1",
  }),
  household2: createMockHousehold({
    id: "household-2",
    lot_id: "lot-2",
    owner_user_id: "resident-2",
    address: "Block 1, Lot 2, Main Street",
    street: "Main Street",
    block: "Block 1",
    lot: "Lot 2",
  }),
};

// Lot factories
export const createMockLot = (overrides: Partial<Lot> = {}): Lot => ({
  id: "lot-1",
  lot_number: "1",
  block: "Block 1",
  address: "123 Main Street",
  owner_user_id: "user-1",
  lot_type: "residential",
  ...overrides,
});

export const mockLots = {
  residential1: createMockLot({
    id: "lot-1",
    lot_number: "1",
    block: "Block 1",
    address: "Block 1, Lot 1",
    owner_user_id: "resident-1",
    lot_type: "residential",
  }),
  community: createMockLot({
    id: "lot-community",
    lot_number: "COMMUNITY",
    block: "Block 1",
    address: "Community Center",
    owner_user_id: "developer-owner",
    lot_type: "community",
  }),
};

// Payment factories
export const createMockPayment = (
  overrides: Partial<Payment> = {},
): Payment => ({
  id: "payment-1",
  household_id: "household-1",
  amount: 1500,
  payment_type: "association_dues",
  payment_method: "bank_transfer",
  status: "pending",
  payment_date: "2026-03-06",
  ...overrides,
});

export const mockPayments = {
  pending: createMockPayment({
    id: "payment-pending",
    status: "pending",
    amount: 1500,
  }),
  completed: createMockPayment({
    id: "payment-completed",
    status: "completed",
    amount: 1500,
  }),
  rejected: createMockPayment({
    id: "payment-rejected",
    status: "rejected",
    amount: 1500,
    rejection_reason: "Blurry proof image",
  }),
};

// Service request factories
export const createMockServiceRequest = (
  overrides: Partial<ServiceRequest> = {},
): ServiceRequest => ({
  id: "sr-1",
  household_id: "household-1",
  category: "plumbing",
  priority: "medium",
  description: "Leaky faucet in kitchen",
  status: "open",
  created_at: "2026-03-06T10:00:00Z",
  ...overrides,
});

export const mockServiceRequests = {
  open: createMockServiceRequest({
    id: "sr-open",
    status: "open",
    category: "plumbing",
  }),
  inProgress: createMockServiceRequest({
    id: "sr-progress",
    status: "in_progress",
    category: "electrical",
  }),
  completed: createMockServiceRequest({
    id: "sr-completed",
    status: "completed",
    category: "plumbing",
  }),
};

// Notification factories
export const createMockNotification = (
  overrides: Partial<Notification> = {},
): Notification => ({
  id: "notif-1",
  user_id: "user-1",
  type: "announcement",
  title: "Test Notification",
  message: "This is a test notification",
  read: false,
  created_at: "2026-03-06T10:00:00Z",
  ...overrides,
});

export const mockNotifications = {
  unread: createMockNotification({
    id: "notif-unread",
    read: false,
    type: "announcement",
  }),
  read: createMockNotification({
    id: "notif-read",
    read: true,
    type: "reminder",
  }),
  demand: createMockNotification({
    id: "notif-demand",
    type: "demand_letter",
    title: "Payment Demand",
    message: "Please pay your dues",
  }),
};

// Auth response factories
export const createMockAuthResponse = (
  user: User,
  token: string = "mock-token",
) => ({
  token,
  user,
});

export const mockAuthResponses = {
  admin: createMockAuthResponse(mockUsers.admin, "admin-token"),
  resident: createMockAuthResponse(mockUsers.resident, "resident-token"),
  staff: createMockAuthResponse(mockUsers.staff, "staff-token"),
};
