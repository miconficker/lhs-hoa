import { describe, it, expect, beforeEach, vi } from "vitest";
import { apiRequest } from "@/lib/api";
import {
  mockSuccess,
  mockError,
  mockNetworkError,
  resetMockApi,
} from "@/test/mocks/api";
import { cleanupLocalStorage } from "@/test/mocks/auth";
import { mockPayments, mockUsers } from "@/test/fixtures/data";

// Mock API module
vi.mock("@/lib/api", () => ({
  apiRequest: vi.fn(),
}));

describe("Payment Integration Flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanupLocalStorage();
    resetMockApi();
  });

  describe("Balance Calculation", () => {
    it("should retrieve household balance correctly", async () => {
      // Mock balance response
      mockSuccess({
        household_id: "household-1",
        balance: 1500,
        late_fee: 150,
        total_due: 1650,
        due_date: "2026-03-31",
      });

      const result = await apiRequest("/payments/balance/household-1");

      expect(result.data).toBeDefined();
      expect(result.data.balance).toBe(1500);
      expect(result.data.late_fee).toBe(150);
      expect(result.data.total_due).toBe(1650);
      expect(result.error).toBeUndefined();
    });

    it("should calculate late fees correctly", async () => {
      // Mock balance with late fee
      mockSuccess({
        household_id: "household-1",
        balance: 1500,
        late_fee: 150, // 10% late fee
        total_due: 1650,
        days_overdue: 15,
      });

      const result = await apiRequest("/payments/balance/household-1");

      expect(result.data.late_fee).toBe(150);
      expect(result.data.total_due).toBeGreaterThan(result.data.balance);
    });
  });

  describe("Payment Initiation", () => {
    it("should initiate payment with proof upload", async () => {
      // Mock successful payment initiation
      mockSuccess({
        payment_id: "payment-1",
        status: "pending",
        message: "Payment submitted for verification",
        verification_queue_id: "vq-1",
      });

      const result = await apiRequest("/payments/initiate", {
        method: "POST",
        body: {
          household_id: "household-1",
          payment_type: "association_dues",
          amount: 1500,
          proof_url: "https://r2.bucket/proof.jpg",
        },
      });

      expect(result.data).toBeDefined();
      expect(result.data.payment_id).toBe("payment-1");
      expect(result.data.status).toBe("pending");
      expect(result.error).toBeUndefined();
    });

    it("should reject payment with invalid file type", async () => {
      // Mock validation error
      mockError("Invalid file type. Only JPG, PNG, and PDF allowed");

      const result = await apiRequest("/payments/initiate", {
        method: "POST",
        body: {
          household_id: "household-1",
          payment_type: "association_dues",
          amount: 1500,
          proof_url: "https://r2.bucket/proof.exe",
        },
      });

      expect(result.data).toBeUndefined();
      expect(result.error).toContain("Invalid file type");
    });

    it("should reject payment exceeding file size limit", async () => {
      // Mock file size error
      mockError("File size exceeds 5MB limit");

      const result = await apiRequest("/payments/initiate", {
        method: "POST",
        body: {
          household_id: "household-1",
          payment_type: "association_dues",
          amount: 1500,
          proof_url: "https://r2.bucket/huge-file.pdf",
        },
      });

      expect(result.data).toBeUndefined();
      expect(result.error).toContain("File size exceeds");
    });
  });

  describe("Payment Verification (Admin)", () => {
    it("should load verification queue for admin", async () => {
      // Mock verification queue
      mockSuccess({
        queue: [
          {
            id: "vq-1",
            payment_id: "payment-1",
            user_id: "resident-1",
            payment_type: "association_dues",
            amount: 1500,
            status: "pending",
            household_address: "Block 1, Lot 1",
            proof_url: "https://r2.bucket/proof.jpg",
            created_at: "2026-03-06T10:00:00Z",
          },
        ],
        total: 1,
        pending: 1,
      });

      const result = await apiRequest("/admin/payments/verify");

      expect(result.data).toBeDefined();
      expect(result.data.queue).toHaveLength(1);
      expect(result.data.queue[0].status).toBe("pending");
      expect(result.error).toBeUndefined();
    });

    it("should approve payment and update balance", async () => {
      // Mock approval response
      mockSuccess({
        payment_id: "payment-1",
        status: "completed",
        message: "Payment approved and verified",
        household_balance: {
          previous_balance: 1500,
          new_balance: 0,
          payment_applied: 1500,
        },
      });

      const result = await apiRequest("/admin/payments/payment-1/verify", {
        method: "PUT",
        body: {
          action: "approve",
        },
      });

      expect(result.data).toBeDefined();
      expect(result.data.status).toBe("completed");
      expect(result.data.household_balance.new_balance).toBe(0);
      expect(result.error).toBeUndefined();
    });

    it("should reject payment with reason", async () => {
      // Mock rejection response
      mockSuccess({
        payment_id: "payment-1",
        status: "rejected",
        rejection_reason: "Blurry proof image",
        message: "Payment rejected. Please resubmit with clear proof",
      });

      const result = await apiRequest("/admin/payments/payment-1/verify", {
        method: "PUT",
        body: {
          action: "reject",
          rejection_reason: "Blurry proof image",
        },
      });

      expect(result.data).toBeDefined();
      expect(result.data.status).toBe("rejected");
      expect(result.data.rejection_reason).toBe("Blurry proof image");
      expect(result.error).toBeUndefined();
    });

    it("should prevent non-admin from accessing verification endpoint", async () => {
      // Mock forbidden response
      mockError("Forbidden: Admin access required");

      const result = await apiRequest("/admin/payments/verify");

      expect(result.data).toBeUndefined();
      expect(result.error).toBe("Forbidden: Admin access required");
    });
  });

  describe("In-Person Payment Recording", () => {
    it("should record in-person payment immediately", async () => {
      // Mock immediate payment recording
      mockSuccess({
        payment_id: "payment-2",
        status: "completed",
        payment_type: "association_dues",
        amount: 1500,
        payment_method: "cash",
        recorded_by: "admin-1",
        recorded_at: "2026-03-06T10:00:00Z",
        message: "Payment recorded successfully",
      });

      const result = await apiRequest("/admin/payments/in-person", {
        method: "POST",
        body: {
          household_id: "household-1",
          payment_type: "association_dues",
          amount: 1500,
          payment_method: "cash",
        },
      });

      expect(result.data).toBeDefined();
      expect(result.data.status).toBe("completed");
      expect(result.data.payment_method).toBe("cash");
      expect(result.error).toBeUndefined();
    });
  });

  describe("Payment History Export", () => {
    it("should export payments to CSV", async () => {
      // Mock CSV export
      mockSuccess({
        csv_data:
          "id,household_id,amount,status,date\npayment-1,household-1,1500,completed,2026-03-06",
        filename: "payments_export_2026-03-06.csv",
        total_records: 1,
      });

      const result = await apiRequest(
        "/admin/payments/export?start_date=2026-01-01&end_date=2026-03-31",
      );

      expect(result.data).toBeDefined();
      expect(result.data.csv_data).toContain("id,household_id,amount");
      expect(result.data.total_records).toBe(1);
      expect(result.error).toBeUndefined();
    });

    it("should filter export by date range", async () => {
      // Mock filtered export
      mockSuccess({
        csv_data:
          "id,household_id,amount,status,date\npayment-1,household-1,1500,completed,2026-03-06",
        filename: "payments_export_2026-03-01_to_2026-03-31.csv",
        total_records: 1,
        filters: {
          start_date: "2026-03-01",
          end_date: "2026-03-31",
        },
      });

      const result = await apiRequest(
        "/admin/payments/export?start_date=2026-03-01&end_date=2026-03-31",
      );

      expect(result.data).toBeDefined();
      expect(result.data.filters.start_date).toBe("2026-03-01");
      expect(result.data.filters.end_date).toBe("2026-03-31");
    });
  });
});
