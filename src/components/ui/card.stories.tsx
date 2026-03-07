import type { Meta, StoryObj } from "@storybook/react";
import {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
} from "./card";

/**
 * Card component stories demonstrating different card layouts.
 */
const meta = {
  title: "UI/Card",
  component: Card,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * A basic card with header, content, and footer.
 */
export const Default: Story = {
  render: () => (
    <Card className="w-[350px]">
      <CardHeader>
        <CardTitle>Card Title</CardTitle>
        <CardDescription>Card description goes here</CardDescription>
      </CardHeader>
      <CardContent>
        <p>Card content goes here. This is the main content area.</p>
      </CardContent>
      <CardFooter>
        <p>Card footer content</p>
      </CardFooter>
    </Card>
  ),
};

/**
 * Card with only content, no header or footer.
 */
export const ContentOnly: Story = {
  render: () => (
    <Card className="w-[350px]">
      <CardContent>
        <p>This card has only content without header or footer.</p>
      </CardContent>
    </Card>
  ),
};

/**
 * Card with header and actions in the footer.
 */
export const WithActions: Story = {
  render: () => (
    <Card className="w-[350px]">
      <CardHeader>
        <CardTitle>Create Project</CardTitle>
        <CardDescription>Deploy your new project in one-click.</CardDescription>
      </CardHeader>
      <CardContent>
        <p>Make sure to configure your deployment settings before deploying.</p>
      </CardContent>
      <CardFooter className="flex justify-between">
        <button className="text-sm text-muted-foreground hover:underline">
          Cancel
        </button>
        <button className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:bg-primary/90">
          Deploy
        </button>
      </CardFooter>
    </Card>
  ),
};

/**
 * Multiple cards displayed together.
 */
export const MultipleCards: Story = {
  render: () => (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Card 1</CardTitle>
          <CardDescription>Description for card 1</CardDescription>
        </CardHeader>
        <CardContent>
          <p>Content for card 1</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Card 2</CardTitle>
          <CardDescription>Description for card 2</CardDescription>
        </CardHeader>
        <CardContent>
          <p>Content for card 2</p>
        </CardContent>
      </Card>
    </div>
  ),
};

/**
 * Card with long content testing scroll behavior.
 */
export const LongContent: Story = {
  render: () => (
    <Card className="w-[350px] h-[300px]">
      <CardHeader>
        <CardTitle>Long Content Card</CardTitle>
        <CardDescription>Card with scrollable content</CardDescription>
      </CardHeader>
      <CardContent className="overflow-y-auto">
        <p>
          Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do
          eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad
          minim veniam, quis nostrud exercitation ullamco laboris nisi ut
          aliquip ex ea commodo consequat.
        </p>
        <p className="mt-4">
          Duis aute irure dolor in reprehenderit in voluptate velit esse cillum
          dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non
          proident.
        </p>
        <p className="mt-4">
          sunt in culpa qui officia deserunt mollit anim id est laborum.
        </p>
      </CardContent>
    </Card>
  ),
};
