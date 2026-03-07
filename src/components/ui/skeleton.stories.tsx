import type { Meta, StoryObj } from "@storybook/react";
import { Skeleton } from "./skeleton";

/**
 * Skeleton component stories demonstrating loading placeholders.
 */
const meta = {
  title: "UI/Skeleton",
  component: Skeleton,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    className: {
      control: "text",
      description: "Additional CSS classes for custom sizing",
    },
  },
} satisfies Meta<typeof Skeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * A basic skeleton loader.
 */
export const Default: Story = {
  render: () => <Skeleton className="h-12 w-[250px]" />,
};

/**
 * Different skeleton sizes.
 */
export const Sizes: Story = {
  render: () => (
    <div className="space-y-4">
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-8 w-1/2" />
      <Skeleton className="h-12 w-2/3" />
      <Skeleton className="h-16 w-full" />
    </div>
  ),
};

/**
 * Card skeleton loader.
 */
export const CardSkeleton: Story = {
  render: () => (
    <div className="w-[350px] space-y-4 rounded-lg border p-6">
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-8 w-3/4" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-full" />
      <div className="flex gap-2">
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-10 w-24" />
      </div>
    </div>
  ),
};

/**
 * List skeleton loader.
 */
export const ListSkeleton: Story = {
  render: () => (
    <div className="w-[350px] space-y-4">
      <div className="flex items-center space-x-4">
        <Skeleton className="h-12 w-12 rounded-full" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
      <div className="flex items-center space-x-4">
        <Skeleton className="h-12 w-12 rounded-full" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-4 w-2/5" />
          <Skeleton className="h-3 w-3/5" />
        </div>
      </div>
      <div className="flex items-center space-x-4">
        <Skeleton className="h-12 w-12 rounded-full" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
    </div>
  ),
};

/**
 * Form skeleton loader.
 */
export const FormSkeleton: Story = {
  render: () => (
    <div className="w-[400px] space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-10 w-full" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-10 w-full" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-32 w-full" />
      </div>
      <Skeleton className="h-10 w-32" />
    </div>
  ),
};

/**
 * Blog post skeleton loader.
 */
export const BlogPostSkeleton: Story = {
  render: () => (
    <div className="w-[500px] space-y-4">
      <Skeleton className="h-8 w-3/4" />
      <div className="flex items-center space-x-4">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="space-y-1">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-32" />
        </div>
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-6 w-16 rounded-full" />
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
    </div>
  ),
};

/**
 * Dashboard cards skeleton.
 */
export const DashboardSkeleton: Story = {
  render: () => (
    <div className="grid grid-cols-3 gap-4 w-[600px]">
      <div className="space-y-2 p-4 border rounded-lg">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-8 w-16" />
      </div>
      <div className="space-y-2 p-4 border rounded-lg">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-20" />
      </div>
      <div className="space-y-2 p-4 border rounded-lg">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-8 w-14" />
      </div>
    </div>
  ),
};

/**
 * Table skeleton loader.
 */
export const TableSkeleton: Story = {
  render: () => (
    <div className="w-full max-w-md space-y-3">
      <div className="flex gap-4">
        <Skeleton className="h-10 flex-1" />
        <Skeleton className="h-10 flex-1" />
        <Skeleton className="h-10 flex-1" />
        <Skeleton className="h-10 w-20" />
      </div>
      <div className="flex gap-4">
        <Skeleton className="h-10 flex-1" />
        <Skeleton className="h-10 flex-1" />
        <Skeleton className="h-10 flex-1" />
        <Skeleton className="h-10 w-20" />
      </div>
      <div className="flex gap-4">
        <Skeleton className="h-10 flex-1" />
        <Skeleton className="h-10 flex-1" />
        <Skeleton className="h-10 flex-1" />
        <Skeleton className="h-10 w-20" />
      </div>
    </div>
  ),
};

/**
 * Circular skeleton for avatars.
 */
export const AvatarSkeleton: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <Skeleton className="h-10 w-10 rounded-full" />
      <Skeleton className="h-12 w-12 rounded-full" />
      <Skeleton className="h-14 w-14 rounded-full" />
      <Skeleton className="h-16 w-16 rounded-full" />
    </div>
  ),
};
