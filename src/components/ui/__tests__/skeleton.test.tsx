import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Skeleton } from "../skeleton";

describe("Skeleton", () => {
  it("should render skeleton element", () => {
    const { container } = render(<Skeleton />);
    const skeleton = container.querySelector(".animate-pulse");
    expect(skeleton).toBeInTheDocument();
  });

  it("should render with default classes", () => {
    const { container } = render(<Skeleton />);
    const skeleton = container.querySelector(".animate-pulse");
    expect(skeleton).toHaveClass("bg-muted", "rounded-md");
  });

  it("should have animate-pulse class for loading animation", () => {
    const { container } = render(<Skeleton />);
    const skeleton = container.querySelector(".animate-pulse");
    expect(skeleton).toHaveClass("animate-pulse");
  });

  it("should accept custom className", () => {
    const { container } = render(<Skeleton className="w-full h-8" />);
    const skeleton = container.querySelector(".animate-pulse");
    expect(skeleton).toHaveClass("w-full", "h-8");
  });

  it("should render as div element", () => {
    const { container } = render(<Skeleton />);
    const skeleton = container.querySelector("div.animate-pulse");
    expect(skeleton?.tagName).toBe("DIV");
  });

  it("should have rounded-md border radius", () => {
    const { container } = render(<Skeleton />);
    const skeleton = container.querySelector(".animate-pulse");
    expect(skeleton).toHaveClass("rounded-md");
  });

  it("should be customizable with width and height", () => {
    const { container } = render(<Skeleton className="w-32 h-4" />);
    const skeleton = container.querySelector(".animate-pulse");
    expect(skeleton).toHaveClass("w-32", "h-4");
  });

  it("should accept additional props", () => {
    const { container } = render(<Skeleton data-testid="custom-skeleton" />);
    const skeleton = container.querySelector('[data-testid="custom-skeleton"]');
    expect(skeleton).toBeInTheDocument();
  });

  it("should render multiple skeletons without conflict", () => {
    const { container } = render(
      <div>
        <Skeleton className="w-full h-4 mb-2" />
        <Skeleton className="w-2/3 h-4 mb-2" />
        <Skeleton className="w-1/2 h-4" />
      </div>,
    );
    const skeletons = container.querySelectorAll(".animate-pulse");
    expect(skeletons).toHaveLength(3);
  });

  it("should be used in card structure", () => {
    const { container } = render(
      <div className="p-4 space-y-2">
        <Skeleton className="h-4 w-1/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>,
    );
    const skeletons = container.querySelectorAll(".animate-pulse");
    expect(skeletons).toHaveLength(3);
  });
});
