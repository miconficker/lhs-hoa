import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { toast } from "sonner";

describe("Sonner (Toast)", () => {
  it("should be imported and available", () => {
    expect(toast).toBeDefined();
    expect(typeof toast.success).toBe("function");
    expect(typeof toast.error).toBe("function");
    expect(typeof toast.info).toBe("function");
    expect(typeof toast.warning).toBe("function");
  });

  it("should have toast function that returns toast ID", () => {
    const result = toast("Test message");
    expect(typeof result).toBe("number");
  });

  it("should have toast.success function", () => {
    const result = toast.success("Success message");
    expect(typeof result).toBe("number");
  });

  it("should have toast.error function", () => {
    const result = toast.error("Error message");
    expect(typeof result).toBe("number");
  });

  it("should have toast.info function", () => {
    const result = toast.info("Info message");
    expect(typeof result).toBe("number");
  });

  it("should have toast.warning function", () => {
    const result = toast.warning("Warning message");
    expect(typeof result).toBe("number");
  });

  it("should accept options in toast calls", () => {
    const result = toast("Message with options", {
      duration: 3000,
      position: "top-right",
    });
    expect(typeof result).toBe("number");
  });

  it("should have toast.promise function", () => {
    const promise = Promise.resolve("data");
    const result = toast.promise(promise, {
      loading: "Loading...",
      success: "Success!",
      error: "Error!",
    });
    expect(result).toBeDefined();
  });

  it("should have toast.dismiss function", () => {
    const result = toast.dismiss();
    expect(result).toBeUndefined();
  });

  it("should handle toast with action button", () => {
    const result = toast("Message", {
      action: {
        label: "Undo",
        onClick: vi.fn(),
      },
    });
    expect(typeof result).toBe("number");
  });

  // Note: Full integration testing would require mounting Toaster component
  // and checking DOM mutations, which is complex for unit tests
  it("should export toast functions for use in components", () => {
    expect(toast).toHaveProperty("success");
    expect(toast).toHaveProperty("error");
    expect(toast).toHaveProperty("info");
    expect(toast).toHaveProperty("warning");
    expect(toast).toHaveProperty("promise");
    expect(toast).toHaveProperty("dismiss");
  });
});
