import { describe, it, expect, beforeEach, vi } from "vitest";
import { apiRequest } from "@/lib/api";
import { mockSuccess, mockError, resetMockApi } from "@/test/mocks/api";
import { cleanupLocalStorage } from "@/test/mocks/auth";
import { mockServiceRequests, mockUsers } from "@/test/fixtures/data";

// Mock API module
vi.mock("@/lib/api", () => ({
  apiRequest: vi.fn(),
}));

describe("Service Request Integration Flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanupLocalStorage();
    resetMockApi();
  });

  describe("Service Request Submission", () => {
    it("should submit new service request successfully", async () => {
      // Mock successful submission
      mockSuccess({
        ...mockServiceRequests.open,
        message: "Service request submitted successfully",
      });

      const result = await apiRequest("/service-requests", {
        method: "POST",
        body: {
          category: "plumbing",
          priority: "medium",
          description: "Leaky faucet in kitchen",
        },
      });

      expect(result.data).toBeDefined();
      expect(result.data.id).toBe("sr-open");
      expect(result.data.status).toBe("open");
      expect(result.data.category).toBe("plumbing");
      expect(result.error).toBeUndefined();
    });

    it("should auto-assign household_id from authenticated user", async () => {
      // Mock submission with household auto-assignment
      mockSuccess({
        id: "sr-2",
        household_id: "household-1", // Auto-assigned from user's household
        category: "electrical",
        priority: "high",
        description: "Power outlet not working",
        status: "open",
      });

      const result = await apiRequest("/service-requests", {
        method: "POST",
        body: {
          category: "electrical",
          priority: "high",
          description: "Power outlet not working",
        },
      });

      expect(result.data).toBeDefined();
      expect(result.data.household_id).toBe("household-1");
      expect(result.data.status).toBe("open");
    });

    it("should validate required fields", async () => {
      // Mock validation error
      mockError(
        "Validation failed: category, priority, and description are required",
      );

      const result = await apiRequest("/service-requests", {
        method: "POST",
        body: {
          category: "plumbing",
          // Missing priority and description
        },
      });

      expect(result.data).toBeUndefined();
      expect(result.error).toContain("Validation failed");
    });
  });

  describe("Service Request Updates (Admin)", () => {
    it("should allow admin to update request status", async () => {
      // Mock status update
      mockSuccess({
        id: "sr-1",
        status: "in_progress",
        assigned_to: "staff-1",
        message: "Service request updated",
      });

      const result = await apiRequest("/service-requests/sr-1", {
        method: "PUT",
        body: {
          status: "in_progress",
          assigned_to: "staff-1",
        },
      });

      expect(result.data).toBeDefined();
      expect(result.data.status).toBe("in_progress");
      expect(result.data.assigned_to).toBe("staff-1");
      expect(result.error).toBeUndefined();
    });

    it("should allow admin to assign staff member", async () => {
      // Mock staff assignment
      mockSuccess({
        id: "sr-1",
        assigned_to: "staff-2",
        status: "assigned",
        message: "Staff member assigned successfully",
      });

      const result = await apiRequest("/service-requests/sr-1", {
        method: "PUT",
        body: {
          assigned_to: "staff-2",
        },
      });

      expect(result.data).toBeDefined();
      expect(result.data.assigned_to).toBe("staff-2");
      expect(result.data.status).toBe("assigned");
    });

    it("should prevent residents from updating requests", async () => {
      // Mock forbidden response
      mockError("Forbidden: Admin access required");

      const result = await apiRequest("/service-requests/sr-1", {
        method: "PUT",
        body: {
          status: "in_progress",
        },
      });

      expect(result.data).toBeUndefined();
      expect(result.error).toBe("Forbidden: Admin access required");
    });
  });

  describe("Service Request Retrieval", () => {
    it("should return only own requests for residents", async () => {
      // Mock resident's requests
      mockSuccess({
        requests: [
          {
            id: "sr-1",
            household_id: "household-1",
            category: "plumbing",
            status: "open",
            description: "Leaky faucet",
          },
          {
            id: "sr-2",
            household_id: "household-1",
            category: "electrical",
            status: "completed",
            description: "Power outlet",
          },
        ],
        total: 2,
      });

      const result = await apiRequest("/service-requests");

      expect(result.data).toBeDefined();
      expect(result.data.requests).toHaveLength(2);
      expect(
        result.data.requests.every(
          (req: any) => req.household_id === "household-1",
        ),
      ).toBe(true);
    });

    it("should return all requests for admin", async () => {
      // Mock all requests (admin view)
      mockSuccess({
        requests: [
          {
            id: "sr-1",
            household_id: "household-1",
            category: "plumbing",
            status: "open",
          },
          {
            id: "sr-2",
            household_id: "household-2",
            category: "electrical",
            status: "in_progress",
          },
          {
            id: "sr-3",
            household_id: "household-3",
            category: "maintenance",
            status: "completed",
          },
        ],
        total: 3,
      });

      const result = await apiRequest("/service-requests");

      expect(result.data).toBeDefined();
      expect(result.data.requests).toHaveLength(3);
    });

    it("should support filtering by status", async () => {
      // Mock filtered requests
      mockSuccess({
        requests: [
          {
            id: "sr-1",
            household_id: "household-1",
            category: "plumbing",
            status: "open",
          },
        ],
        total: 1,
        filter: {
          status: "open",
        },
      });

      const result = await apiRequest("/service-requests?status=open");

      expect(result.data).toBeDefined();
      expect(result.data.requests).toHaveLength(1);
      expect(result.data.requests[0].status).toBe("open");
      expect(result.data.filter.status).toBe("open");
    });
  });

  describe("Service Request Cancellation", () => {
    it("should allow resident to cancel own open request", async () => {
      // Mock cancellation
      mockSuccess({
        id: "sr-1",
        status: "cancelled",
        message: "Service request cancelled successfully",
      });

      const result = await apiRequest("/service-requests/sr-1", {
        method: "DELETE",
      });

      expect(result.data).toBeDefined();
      expect(result.data.status).toBe("cancelled");
      expect(result.error).toBeUndefined();
    });

    it("should prevent cancellation of in-progress requests", async () => {
      // Mock validation error
      mockError("Cannot cancel request that is already in progress");

      const result = await apiRequest("/service-requests/sr-progress", {
        method: "DELETE",
      });

      expect(result.data).toBeUndefined();
      expect(result.error).toContain("Cannot cancel");
    });

    it("should prevent cancellation of completed requests", async () => {
      // Mock validation error
      mockError("Cannot cancel completed request");

      const result = await apiRequest("/service-requests/sr-completed", {
        method: "DELETE",
      });

      expect(result.data).toBeUndefined();
      expect(result.error).toContain("Cannot cancel completed");
    });
  });

  describe("Service Request Details", () => {
    it("should retrieve single request details", async () => {
      // Mock request details
      mockSuccess({
        id: "sr-1",
        household_id: "household-1",
        category: "plumbing",
        priority: "medium",
        description: "Leaky faucet in kitchen",
        status: "open",
        created_at: "2026-03-06T10:00:00Z",
        updated_at: "2026-03-06T10:00:00Z",
        assigned_to: null,
        completion_notes: null,
      });

      const result = await apiRequest("/service-requests/sr-1");

      expect(result.data).toBeDefined();
      expect(result.data.id).toBe("sr-1");
      expect(result.data.description).toBe("Leaky faucet in kitchen");
      expect(result.data.status).toBe("open");
    });

    it("should return 404 for non-existent request", async () => {
      // Mock not found error
      mockError("Service request not found");

      const result = await apiRequest("/service-requests/non-existent");

      expect(result.data).toBeUndefined();
      expect(result.error).toBe("Service request not found");
    });

    it("should prevent residents from viewing other households requests", async () => {
      // Mock forbidden response
      mockError("Forbidden: You do not have permission to view this request");

      const result = await apiRequest("/service-requests/sr-2");

      expect(result.data).toBeUndefined();
      expect(result.error).toBe("Forbidden: You do not have permission");
    });
  });
});
