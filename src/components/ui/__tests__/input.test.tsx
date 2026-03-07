import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Input } from "../input";

describe("Input", () => {
  it("should render input element", () => {
    render(<Input />);
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("should render with default classes", () => {
    render(<Input />);
    const input = screen.getByRole("textbox");
    expect(input).toHaveClass("flex", "h-10", "w-full");
    expect(input).toHaveClass("rounded-md", "border", "border-input");
  });

  it("should accept user input", async () => {
    const user = userEvent.setup();
    render(<Input placeholder="Enter text" />);

    const input = screen.getByPlaceholderText("Enter text");
    await user.type(input, "Hello World");

    expect(input).toHaveValue("Hello World");
  });

  it("should render with text type by default", () => {
    render(<Input />);
    const input = screen.getByRole("textbox") as HTMLInputElement;
    expect(input.type).toBe("text");
  });

  it("should render with password type", () => {
    render(<Input type="password" />);
    const input = document.querySelector("input[type='password']");
    expect(input).toBeInTheDocument();
  });

  it("should render with email type", () => {
    render(<Input type="email" />);
    const input = screen.getByRole("textbox");
    expect(screen.getByRole("textbox")).toHaveAttribute("type", "email");
  });

  it("should render with number type", () => {
    render(<Input type="number" />);
    const input = screen.getByRole("spinbutton");
    expect(input).toBeInTheDocument();
  });

  it("should render with placeholder", () => {
    render(<Input placeholder="Search..." />);
    expect(screen.getByPlaceholderText("Search...")).toBeInTheDocument();
  });

  it("should be disabled when disabled prop is true", () => {
    render(<Input disabled />);
    const input = screen.getByRole("textbox");
    expect(input).toBeDisabled();
  });

  it("should have disabled styling when disabled", () => {
    render(<Input disabled />);
    const input = screen.getByRole("textbox");
    expect(input).toHaveClass("disabled:opacity-50");
  });

  it("should apply custom className", () => {
    render(<Input className="custom-input" />);
    const input = screen.getByRole("textbox");
    expect(input).toHaveClass("custom-input");
  });

  it("should have focus-visible classes for accessibility", () => {
    render(<Input />);
    const input = screen.getByRole("textbox");
    expect(input).toHaveClass("focus-visible:outline-none");
    expect(input).toHaveClass("focus-visible:ring-2");
  });

  it("should accept value prop", () => {
    render(<Input value="Initial value" readOnly />);
    const input = screen.getByRole("textbox");
    expect(input).toHaveValue("Initial value");
  });

  it("should accept name prop", () => {
    render(<Input name="username" />);
    const input = screen.getByRole("textbox");
    expect(input).toHaveAttribute("name", "username");
  });

  it("should accept id prop", () => {
    render(<Input id="email-input" />);
    const input = screen.getByRole("textbox");
    expect(input).toHaveAttribute("id", "email-input");
  });

  it("should be required when required prop is true", () => {
    render(<Input required />);
    const input = screen.getByRole("textbox");
    expect(input).toBeRequired();
  });

  it("should have proper placeholder styling", () => {
    render(<Input placeholder="Placeholder" />);
    const input = screen.getByPlaceholderText("Placeholder");
    expect(input).toHaveClass("placeholder:text-muted-foreground");
  });

  it("should handle onChange callback", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    render(<Input onChange={handleChange} />);

    const input = screen.getByRole("textbox");
    await user.type(input, "a");

    expect(handleChange).toHaveBeenCalled();
  });

  it("should have proper ring offset for focus", () => {
    render(<Input />);
    const input = screen.getByRole("textbox");
    expect(input).toHaveClass("ring-offset-background");
    expect(input).toHaveClass("focus-visible:ring-offset-2");
  });
});
