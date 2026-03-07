import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "../card";

describe("Card", () => {
  describe("Card", () => {
    it("should render card container", () => {
      render(<Card>Card content</Card>);
      expect(screen.getByText("Card content")).toBeInTheDocument();
    });

    it("should render with default classes", () => {
      render(<Card>Card</Card>);
      const card = screen.getByText("Card");
      expect(card).toHaveClass("rounded-lg", "border", "bg-card");
      expect(card).toHaveClass("shadow-sm");
    });

    it("should accept custom className", () => {
      render(<Card className="custom-card">Card</Card>);
      const card = screen.getByText("Card");
      expect(card).toHaveClass("custom-card");
    });

    it("should render children", () => {
      render(
        <Card>
          <span>Child content</span>
        </Card>,
      );
      expect(screen.getByText("Child content")).toBeInTheDocument();
    });
  });

  describe("CardHeader", () => {
    it("should render card header", () => {
      render(<CardHeader>Header</CardHeader>);
      expect(screen.getByText("Header")).toBeInTheDocument();
    });

    it("should render with default padding", () => {
      render(<CardHeader>Header</CardHeader>);
      const header = screen.getByText("Header");
      expect(header).toHaveClass("p-6");
    });

    it("should render with flex column layout", () => {
      render(<CardHeader>Header</CardHeader>);
      const header = screen.getByText("Header");
      expect(header).toHaveClass("flex", "flex-col");
    });
  });

  describe("CardTitle", () => {
    it("should render as h3 element", () => {
      render(<CardTitle>Title</CardTitle>);
      const title = screen.getByText("Title");
      expect(title.tagName).toBe("H3");
    });

    it("should render with default styling", () => {
      render(<CardTitle>Card Title</CardTitle>);
      const title = screen.getByText("Card Title");
      expect(title).toHaveClass("text-2xl", "font-semibold");
    });

    it("should have tracking tight", () => {
      render(<CardTitle>Title</CardTitle>);
      const title = screen.getByText("Title");
      expect(title).toHaveClass("tracking-tight");
    });
  });

  describe("CardDescription", () => {
    it("should render as p element", () => {
      render(<CardDescription>Description</CardDescription>);
      const description = screen.getByText("Description");
      expect(description.tagName).toBe("P");
    });

    it("should render with muted text color", () => {
      render(<CardDescription>Description text</CardDescription>);
      const description = screen.getByText("Description text");
      expect(description).toHaveClass("text-sm", "text-muted-foreground");
    });
  });

  describe("CardContent", () => {
    it("should render card content", () => {
      render(<CardContent>Content</CardContent>);
      expect(screen.getByText("Content")).toBeInTheDocument();
    });

    it("should render with padding but no top padding", () => {
      render(<CardContent>Content</CardContent>);
      const content = screen.getByText("Content");
      expect(content).toHaveClass("p-6", "pt-0");
    });
  });

  describe("CardFooter", () => {
    it("should render card footer", () => {
      render(<CardFooter>Footer</CardFooter>);
      expect(screen.getByText("Footer")).toBeInTheDocument();
    });

    it("should render with flex layout", () => {
      render(<CardFooter>Footer</CardFooter>);
      const footer = screen.getByText("Footer");
      expect(footer).toHaveClass("flex", "items-center");
    });

    it("should render with padding but no top padding", () => {
      render(<CardFooter>Footer</CardFooter>);
      const footer = screen.getByText("Footer");
      expect(footer).toHaveClass("p-6", "pt-0");
    });
  });

  describe("Complete Card Structure", () => {
    it("should render complete card with all components", () => {
      render(
        <Card>
          <CardHeader>
            <CardTitle>Test Card</CardTitle>
            <CardDescription>Test description</CardDescription>
          </CardHeader>
          <CardContent>
            <p>Card content goes here</p>
          </CardContent>
          <CardFooter>
            <button>Action</button>
          </CardFooter>
        </Card>,
      );

      expect(screen.getByText("Test Card")).toBeInTheDocument();
      expect(screen.getByText("Test description")).toBeInTheDocument();
      expect(screen.getByText("Card content goes here")).toBeInTheDocument();
      expect(screen.getByText("Action")).toBeInTheDocument();
    });

    it("should render nested components with proper spacing", () => {
      const { container } = render(
        <Card>
          <CardHeader>
            <CardTitle>Title</CardTitle>
            <CardDescription>Description</CardDescription>
          </CardHeader>
          <CardContent>Content</CardContent>
        </Card>,
      );

      const header = container.querySelector('[class*="space-y-1.5"]');
      expect(header).toBeInTheDocument();
    });
  });
});
