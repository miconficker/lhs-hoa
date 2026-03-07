import type { Meta, StoryObj } from "@storybook/react";
import { Badge } from "./badge";

/**
 * Badge component stories demonstrating all variants.
 */
const meta = {
  title: "UI/Badge",
  component: Badge,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "secondary", "destructive", "outline"],
      description: "Badge visual variant",
    },
  },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The default badge component.
 */
export const Default: Story = {
  args: {
    children: "Badge",
  },
};

/**
 * All badge variants for different visual styles.
 */
export const Variants: Story = {
  render: () => (
    <div className="flex gap-4 flex-wrap">
      <Badge variant="default">Default</Badge>
      <Badge variant="secondary">Secondary</Badge>
      <Badge variant="destructive">Destructive</Badge>
      <Badge variant="outline">Outline</Badge>
    </div>
  ),
};

/**
 * Badges used as status indicators.
 */
export const StatusBadges: Story = {
  render: () => (
    <div className="flex gap-4 flex-wrap">
      <Badge variant="default">Active</Badge>
      <Badge variant="secondary">Draft</Badge>
      <Badge variant="destructive">Cancelled</Badge>
      <Badge variant="outline">Pending</Badge>
    </div>
  ),
};

/**
 * Badge with custom styling through className.
 */
export const CustomStyled: Story = {
  render: () => (
    <div className="flex gap-4 flex-wrap">
      <Badge className="bg-green-500 hover:bg-green-600">Success</Badge>
      <Badge className="bg-yellow-500 hover:bg-yellow-600">Warning</Badge>
      <Badge className="bg-blue-500 hover:bg-blue-600">Info</Badge>
    </div>
  ),
};

/**
 * Small badges for compact displays.
 */
export const SmallBadges: Story = {
  render: () => (
    <div className="flex gap-4 flex-wrap">
      <Badge className="text-xs px-2 py-0">New</Badge>
      <Badge variant="secondary" className="text-xs px-2 py-0">
        Beta
      </Badge>
      <Badge variant="destructive" className="text-xs px-2 py-0">
        Hot
      </Badge>
    </div>
  ),
};

/**
 * Badge with icon.
 */
export const WithIcon: Story = {
  render: () => (
    <div className="flex gap-4 flex-wrap">
      <Badge>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="mr-1"
        >
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
        </svg>
        Featured
      </Badge>
      <Badge variant="destructive">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="mr-1"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        Alert
      </Badge>
    </div>
  ),
};

/**
 * Inline badges within text.
 */
export const Inline: Story = {
  render: () => (
    <div className="space-y-2 max-w-md">
      <p>
        This is an important message <Badge variant="destructive">Urgent</Badge>{" "}
        that needs attention.
      </p>
      <p>
        New feature available <Badge variant="default">New</Badge> for all
        users.
      </p>
      <p>
        Status: <Badge variant="outline">In Progress</Badge>
      </p>
    </div>
  ),
};
