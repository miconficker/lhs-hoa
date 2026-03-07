import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RadioGroup, RadioGroupItem } from "../radio-group";

describe("RadioGroup", () => {
  it("should render radio group", () => {
    render(
      <RadioGroup defaultValue="option1">
        <div>
          <RadioGroupItem value="option1" id="option1" />
          <label htmlFor="option1">Option 1</label>
        </div>
        <div>
          <RadioGroupItem value="option2" id="option2" />
          <label htmlFor="option2">Option 2</label>
        </div>
      </RadioGroup>,
    );

    expect(screen.getByLabelText("Option 1")).toBeInTheDocument();
    expect(screen.getByLabelText("Option 2")).toBeInTheDocument();
  });

  it("should have default value selected", () => {
    render(
      <RadioGroup defaultValue="option1">
        <RadioGroupItem value="option1" id="option1" />
        <label htmlFor="option1">Option 1</label>
        <RadioGroupItem value="option2" id="option2" />
        <label htmlFor="option2">Option 2</label>
      </RadioGroup>,
    );

    const option1 = screen.getByLabelText("Option 1");
    expect(option1).toBeChecked();
  });

  it("should change selection when clicked", async () => {
    const user = userEvent.setup();
    render(
      <RadioGroup defaultValue="option1">
        <RadioGroupItem value="option1" id="option1" />
        <label htmlFor="option1">Option 1</label>
        <RadioGroupItem value="option2" id="option2" />
        <label htmlFor="option2">Option 2</label>
      </RadioGroup>,
    );

    await user.click(screen.getByLabelText("Option 2"));

    const option2 = screen.getByLabelText("Option 2");
    expect(option2).toBeChecked();

    const option1 = screen.getByLabelText("Option 1");
    expect(option1).not.toBeChecked();
  });

  it("should render with grid layout", () => {
    const { container } = render(
      <RadioGroup>
        <RadioGroupItem value="option1" id="option1" />
        <label htmlFor="option1">Option 1</label>
      </RadioGroup>,
    );

    const radioGroup = container.querySelector('[role="radiogroup"]');
    expect(radioGroup).toHaveClass("grid", "gap-2");
  });

  it("should have proper accessibility attributes", () => {
    render(
      <RadioGroup defaultValue="option1">
        <RadioGroupItem value="option1" id="option1" />
        <label htmlFor="option1">Option 1</label>
        <RadioGroupItem value="option2" id="option2" />
        <label htmlFor="option2">Option 2</label>
      </RadioGroup>,
    );

    expect(screen.getByRole("radiogroup")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Option 1" })).toBeInTheDocument();
  });

  it("should be disabled when disabled prop is true", () => {
    render(
      <RadioGroup>
        <RadioGroupItem value="option1" id="option1" disabled />
        <label htmlFor="option1">Option 1</label>
      </RadioGroup>,
    );

    const option = screen.getByLabelText("Option 1");
    expect(option).toBeDisabled();
  });

  it("should have proper styling for focus", () => {
    render(
      <RadioGroup>
        <RadioGroupItem value="option1" id="option1" />
        <label htmlFor="option1">Option 1</label>
      </RadioGroup>,
    );

    const option = screen.getByLabelText("Option 1");
    expect(option).toHaveClass("focus-visible:ring-2");
  });

  it("should have rounded border", () => {
    render(
      <RadioGroup>
        <RadioGroupItem value="option1" id="option1" />
        <label htmlFor="option1">Option 1</label>
      </RadioGroup>,
    );

    const option = screen.getByLabelText("Option 1");
    expect(option).toHaveClass("rounded-full");
  });

  it("should accept custom className", () => {
    const { container } = render(
      <RadioGroup className="custom-group">
        <RadioGroupItem value="option1" id="option1" />
        <label htmlFor="option1">Option 1</label>
      </RadioGroup>,
    );

    const radioGroup = container.querySelector('[role="radiogroup"]');
    expect(radioGroup).toHaveClass("custom-group");
  });
});
