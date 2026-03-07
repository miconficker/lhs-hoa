import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Badge } from "../badge";

describe("Badge", () => {
  it("should render badge with text", () => {
    render(<Badge>New</Badge>);
    expect(screen.getByText("New")).toBeInTheDocument();
  });

  it("should render with default variant classes", () => {
    render(<Badge>Default</Badge>);
    const badge = screen.getByText("Default");
    expect(badge).toHaveClass("bg-primary", "text-primary-foreground");
  });

  it("should render with secondary variant", () => {
    render(<Badge variant="secondary">Secondary</Badge>);
    const badge = screen.getByText("Secondary");
    expect(badge).toHaveClass("bg-secondary", "text-secondary-foreground");
  });

  it("should render with destructive variant", () => {
    render(<Badge variant="destructive">Error</Badge>);
    const badge = screen.getByText("Error");
    expect(badge).toHaveClass("bg-destructive", "text-destructive-foreground");
  });

  it("should render with outline variant", () => {
    render(<Badge variant="outline">Outline</Badge>);
    const badge = screen.getByText("Outline");
    expect(badge).toHaveClass("text-foreground", "border");
  });

  it("should have rounded-full shape", () => {
    render(<Badge>Rounded</Badge>);
    const badge = screen.getByText("Rounded");
    expect(badge).toHaveClass("rounded-full");
  });

  it("should have proper padding", () => {
    render(<Badge>Badge</Badge>);
    const badge = screen.getByText("Badge");
    expect(badge).toHaveClass("px-2.5", "py-0.5");
  });

  it("should have small text size", () => {
    render(<Badge>Small</Badge>);
    const badge = screen.getByText("Small");
    expect(badge).toHaveClass("text-xs", "font-semibold");
  });

  it("should have focus-visible styles", () => {
    render(<Badge>Focus</Badge>);
    const badge = screen.getByText("Focus");
    expect(badge).toHaveClass("focus:outline-none");
    expect(badge).toHaveClass("focus:ring-2");
  });

  it("should have hover effect", () => {
    render(<Badge>Hover</Badge>);
    const badge = screen.getByText("Hover");
    expect(badge).toHaveClass("transition-colors");
  });

  it("should accept custom className", () => {
    render(<Badge className="custom-badge">Custom</Badge>);
    const badge = screen.getByText("Custom");
    expect(badge).toHaveClass("custom-badge");
  });

  it("should render with inline-flex layout", () => {
    render(<Badge>Inline</Badge>);
    const badge = screen.getByText("Inline");
    expect(badge).toHaveClass("inline-flex", "items-center");
  });
});
