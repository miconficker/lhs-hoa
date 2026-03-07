import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "./button";

/**
 * Button component stories demonstrating all variants and sizes.
 */
const meta = {
  title: "UI/Button",
  component: Button,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: [
        "default",
        "destructive",
        "outline",
        "secondary",
        "ghost",
        "link",
      ],
      description: "Button visual variant",
    },
    size: {
      control: "select",
      options: ["default", "sm", "lg", "icon"],
      description: "Button size",
    },
    isLoading: {
      control: "boolean",
      description: "Show loading state",
    },
    disabled: {
      control: "boolean",
      description: "Disable the button",
    },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The default button component.
 */
export const Default: Story = {
  args: {
    children: "Button",
  },
};

/**
 * All button variants for different visual styles.
 */
export const Variants: Story = {
  render: () => (
    <div className="flex gap-4 flex-wrap">
      <Button variant="default">Default</Button>
      <Button variant="destructive">Destructive</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="link">Link</Button>
    </div>
  ),
};

/**
 * All button sizes for different spacing needs.
 */
export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <Button size="sm">Small</Button>
      <Button size="default">Default</Button>
      <Button size="lg">Large</Button>
      <Button size="icon">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 12h14" />
          <path d="M12 5v14" />
        </svg>
      </Button>
    </div>
  ),
};

/**
 * Button with loading state.
 */
export const Loading: Story = {
  render: () => (
    <div className="flex gap-4">
      <Button isLoading>Loading</Button>
      <Button variant="outline" isLoading>
        Loading
      </Button>
      <Button variant="destructive" isLoading>
        Loading
      </Button>
    </div>
  ),
};

/**
 * Disabled button states for all variants.
 */
export const Disabled: Story = {
  render: () => (
    <div className="flex gap-4 flex-wrap">
      <Button disabled>Default</Button>
      <Button variant="destructive" disabled>
        Destructive
      </Button>
      <Button variant="outline" disabled>
        Outline
      </Button>
      <Button variant="secondary" disabled>
        Secondary
      </Button>
      <Button variant="ghost" disabled>
        Ghost
      </Button>
      <Button variant="link" disabled>
        Link
      </Button>
    </div>
  ),
};

/**
 * Button with click handler example.
 */
export const WithClickHandler: Story = {
  args: {
    children: "Click Me",
    onClick: () => alert("Button clicked!"),
  },
};

/**
 * Icon button example with custom content.
 */
export const IconButton: Story = {
  args: {
    size: "icon",
    children: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 5v14M5 12h14" />
      </svg>
    ),
    "aria-label": "Add item",
  },
};
