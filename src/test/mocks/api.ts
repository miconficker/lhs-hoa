import { vi } from "vitest";
import type { User, AuthResponse } from "@/types";

// Mock API response types
export interface MockApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

// Mock API request function
export const mockApiRequest = vi.fn();

// Setup mock API with default implementations
export function setupMockApi() {
  mockApiRequest.mockClear();

  // Default: successful response
  mockApiRequest.mockResolvedValue({
    data: {},
    error: undefined,
  });

  return mockApiRequest;
}

// Mock successful API call
export function mockSuccess<T>(data: T) {
  mockApiRequest.mockResolvedValueOnce({
    data,
    error: undefined,
  });
}

// Mock failed API call
export function mockError(error: string) {
  mockApiRequest.mockResolvedValueOnce({
    data: undefined,
    error,
  });
}

// Mock network error
export function mockNetworkError(message: string = "Network error") {
  mockApiRequest.mockRejectedValueOnce(new Error(message));
}

// Mock authentication endpoints
export function mockAuthEndpoints() {
  // Login success
  mockApiRequest.mockImplementation((endpoint: string) => {
    if (endpoint === "/auth/login") {
      return Promise.resolve({
        data: {
          token: "mock-jwt-token",
          user: {
            id: "test-user-1",
            email: "test@example.com",
            role: "resident",
            name: "Test User",
          } as User,
        } as AuthResponse,
        error: undefined,
      });
    }

    if (endpoint === "/auth/me") {
      return Promise.resolve({
        data: {
          id: "test-user-1",
          email: "test@example.com",
          role: "resident",
          name: "Test User",
        } as User,
        error: undefined,
      });
    }

    return Promise.resolve({
      data: {},
      error: undefined,
    });
  });
}

// Reset all mocks
export function resetMockApi() {
  mockApiRequest.mockReset();
  mockApiRequest.mockClear();
}

// Get mock call history
export function getApiCallHistory() {
  return mockApiRequest.mock.calls;
}

// Verify endpoint was called
export function verifyEndpointCalled(endpoint: string, method: string = "GET") {
  return mockApiRequest.mock.calls.some((call) => {
    const [calledEndpoint, options] = call;
    return (
      calledEndpoint === endpoint && (!options || options.method === method)
    );
  });
}

// Get last call arguments
export function getLastCall() {
  const calls = mockApiRequest.mock.calls;
  return calls.length > 0 ? calls[calls.length - 1] : null;
}
