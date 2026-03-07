import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "../sheet";

describe("Sheet", () => {
  it("should render sheet trigger button", () => {
    render(
      <Sheet>
        <SheetTrigger>Open Sheet</SheetTrigger>
        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle>Sheet Title</SheetTitle>
          </SheetHeader>
        </SheetContent>
      </Sheet>,
    );

    expect(
      screen.getByRole("button", { name: "Open Sheet" }),
    ).toBeInTheDocument();
  });

  it("should not show sheet content initially", () => {
    render(
      <Sheet>
        <SheetTrigger>Open</SheetTrigger>
        <SheetContent side="right">
          <SheetTitle>Hidden Content</SheetTitle>
        </SheetContent>
      </Sheet>,
    );

    expect(screen.queryByText("Hidden Content")).not.toBeInTheDocument();
  });

  it("should open sheet when trigger is clicked", async () => {
    const user = userEvent.setup();
    render(
      <Sheet>
        <SheetTrigger>Open Sheet</SheetTrigger>
        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle>Sheet Title</SheetTitle>
            <SheetDescription>Sheet description</SheetDescription>
          </SheetHeader>
        </SheetContent>
      </Sheet>,
    );

    await user.click(screen.getByRole("button", { name: "Open Sheet" }));

    expect(screen.getByText("Sheet Title")).toBeInTheDocument();
    expect(screen.getByText("Sheet description")).toBeInTheDocument();
  });

  it("should render with right side positioning", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <Sheet>
        <SheetTrigger>Open</SheetTrigger>
        <SheetContent side="right">
          <SheetTitle>Content</SheetTitle>
        </SheetContent>
      </Sheet>,
    );

    await user.click(screen.getByRole("button", { name: "Open" }));

    const content = container.querySelector('[data-state="open"]');
    expect(content).toBeInTheDocument();
  });

  it("should render with left side positioning", async () => {
    const user = userEvent.setup();
    render(
      <Sheet>
        <SheetTrigger>Open</SheetTrigger>
        <SheetContent side="left">
          <SheetTitle>Left Sheet</SheetTitle>
        </SheetContent>
      </Sheet>,
    );

    await user.click(screen.getByRole("button", { name: "Open" }));

    expect(screen.getByText("Left Sheet")).toBeInTheDocument();
  });

  it("should render SheetTitle as h2 element", async () => {
    const user = userEvent.setup();
    render(
      <Sheet>
        <SheetTrigger>Open</SheetTrigger>
        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle>Title</SheetTitle>
          </SheetHeader>
        </SheetContent>
      </Sheet>,
    );

    await user.click(screen.getByRole("button", { name: "Open" }));

    const title = screen.getByText("Title");
    expect(title.tagName).toBe("H2");
  });

  it("should have close button", async () => {
    const user = userEvent.setup();
    render(
      <Sheet>
        <SheetTrigger>Open</SheetTrigger>
        <SheetContent side="right">
          <SheetTitle>Sheet</SheetTitle>
        </SheetContent>
      </Sheet>,
    );

    await user.click(screen.getByRole("button", { name: "Open" }));

    // Close button has sr-only text
    expect(screen.getByText("Close")).toBeInTheDocument();
  });

  it("should accept custom className on trigger", () => {
    render(
      <Sheet>
        <SheetTrigger className="custom-trigger">Open</SheetTrigger>
        <SheetContent side="right">
          <SheetTitle>Content</SheetTitle>
        </SheetContent>
      </Sheet>,
    );

    const trigger = screen.getByRole("button", { name: "Open" });
    expect(trigger).toHaveClass("custom-trigger");
  });
});
