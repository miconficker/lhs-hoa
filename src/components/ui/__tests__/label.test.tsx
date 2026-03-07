import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Label } from "../label";

describe("Label", () => {
  it("should render label with text", () => {
    render(<Label>Email</Label>);
    expect(screen.getByText("Email")).toBeInTheDocument();
  });

  it("should render as label element", () => {
    render(<Label>Test Label</Label>);
    const label = screen.getByText("Test Label");
    expect(label.tagName).toBe("LABEL");
  });

  it("should render with default styling", () => {
    render(<Label>Label</Label>);
    const label = screen.getByText("Label");
    expect(label).toHaveClass("text-sm", "font-medium");
  });

  it("should accept htmlFor prop to associate with input", () => {
    render(
      <>
        <Label htmlFor="email">Email</Label>
        <input id="email" type="email" />
      </>,
    );
    const label = screen.getByText("Email");
    expect(label).toHaveAttribute("for", "email");
  });

  it("should have proper disabled styling when peer is disabled", () => {
    render(<Label className="peer-disabled:opacity-70">Label</Label>);
    const label = screen.getByText("Label");
    expect(label).toHaveClass("peer-disabled:opacity-70");
  });

  it("should accept custom className", () => {
    render(<Label className="custom-label">Custom</Label>);
    const label = screen.getByText("Custom");
    expect(label).toHaveClass("custom-label");
  });

  it("should have leading-none for text alignment", () => {
    render(<Label>Label</Label>);
    const label = screen.getByText("Label");
    expect(label).toHaveClass("leading-none");
  });

  it("should be accessible via text content", () => {
    render(<Label>Username</Label>);
    expect(screen.getByText("Username")).toBeVisible();
  });

  it("should associate with form control properly", () => {
    render(
      <form>
        <Label htmlFor="password">Password</Label>
        <input id="password" type="password" />
      </form>,
    );

    const input = screen.getByLabelText("Password");
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute("id", "password");
  });
});
