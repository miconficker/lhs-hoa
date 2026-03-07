import type { Meta, StoryObj } from "@storybook/react";
import { Input } from "./input";

/**
 * Input component stories demonstrating various input states.
 */
const meta = {
  title: "UI/Input",
  component: Input,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    type: {
      control: "select",
      options: ["text", "password", "email", "number", "tel", "url"],
      description: "Input type",
    },
    disabled: {
      control: "boolean",
      description: "Disable the input",
    },
    placeholder: {
      control: "text",
      description: "Placeholder text",
    },
  },
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The default input component.
 */
export const Default: Story = {
  args: {
    placeholder: "Enter text...",
  },
};

/**
 * All input types for different data formats.
 */
export const Types: Story = {
  render: () => (
    <div className="space-y-4 w-[350px]">
      <Input type="text" placeholder="Text input" />
      <Input type="password" placeholder="Password" />
      <Input type="email" placeholder="Email address" />
      <Input type="number" placeholder="Number" />
      <Input type="tel" placeholder="Phone number" />
      <Input type="url" placeholder="Website URL" />
    </div>
  ),
};

/**
 * Disabled input state.
 */
export const Disabled: Story = {
  render: () => (
    <div className="space-y-4 w-[350px]">
      <Input disabled placeholder="Disabled input" />
      <Input disabled value="Cannot edit this" />
    </div>
  ),
};

/**
 * Input with default value.
 */
export const WithValue: Story = {
  render: () => (
    <div className="space-y-4 w-[350px]">
      <Input defaultValue="john@example.com" placeholder="Email" />
      <Input defaultValue="Premium Plan" placeholder="Plan" />
    </div>
  ),
};

/**
 * Input with various states using className.
 */
export const States: Story = {
  render: () => (
    <div className="space-y-4 w-[350px]">
      <Input placeholder="Normal state" />
      <input
        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-2 ring-ring ring-offset-2"
        placeholder="Focused state (simulated)"
      />
      <Input
        className="border-red-500 focus-visible:ring-red-500"
        placeholder="Error state"
      />
    </div>
  ),
};

/**
 * Input with label and description.
 */
export const WithLabel: Story = {
  render: () => (
    <div className="space-y-4 w-[350px]">
      <div className="space-y-2">
        <label htmlFor="email" className="text-sm font-medium">
          Email
        </label>
        <Input id="email" type="email" placeholder="john@example.com" />
        <p className="text-xs text-muted-foreground">
          We'll never share your email with anyone else.
        </p>
      </div>
      <div className="space-y-2">
        <label htmlFor="password" className="text-sm font-medium">
          Password
        </label>
        <Input id="password" type="password" placeholder="••••••••" />
      </div>
    </div>
  ),
};

/**
 * Multiple inputs in a form layout.
 */
export const FormLayout: Story = {
  render: () => (
    <div className="space-y-4 w-[400px]">
      <div className="space-y-2">
        <label htmlFor="first-name" className="text-sm font-medium">
          First Name
        </label>
        <Input id="first-name" placeholder="John" />
      </div>
      <div className="space-y-2">
        <label htmlFor="last-name" className="text-sm font-medium">
          Last Name
        </label>
        <Input id="last-name" placeholder="Doe" />
      </div>
      <div className="space-y-2">
        <label htmlFor="email" className="text-sm font-medium">
          Email
        </label>
        <Input id="email" type="email" placeholder="john@example.com" />
      </div>
    </div>
  ),
};

/**
 * Input with icon.
 */
export const WithIcon: Story = {
  render: () => (
    <div className="space-y-4 w-[350px]">
      <div className="relative">
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
          className="absolute left-3 top-3 text-muted-foreground"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <Input className="pl-9" placeholder="Search..." />
      </div>
      <div className="relative">
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
          className="absolute left-3 top-3 text-muted-foreground"
        >
          <rect width="20" height="16" x="2" y="4" rx="2" />
          <path d="m6 8-4 4 4 4" />
        </svg>
        <Input className="pl-9" type="email" placeholder="Email" />
      </div>
    </div>
  ),
};
