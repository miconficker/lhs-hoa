import type { Meta, StoryObj } from "@storybook/react";
import { Label } from "./label";
import { Input } from "./input";

/**
 * Label component stories demonstrating form labels.
 */
const meta = {
  title: "UI/Label",
  component: Label,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    disabled: {
      control: "boolean",
      description: "Disable the label",
    },
  },
} satisfies Meta<typeof Label>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The default label component.
 */
export const Default: Story = {
  args: {
    children: "Label",
  },
};

/**
 * Label with associated form input.
 */
export const WithInput: Story = {
  render: () => (
    <div className="space-y-4 w-[350px]">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" placeholder="john@example.com" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input id="password" type="password" />
      </div>
    </div>
  ),
};

/**
 * Disabled label state.
 */
export const Disabled: Story = {
  render: () => (
    <div className="space-y-4 w-[350px]">
      <div className="space-y-2">
        <Label disabled htmlFor="disabled-input">
          Disabled Label
        </Label>
        <Input id="disabled-input" disabled placeholder="Cannot edit" />
      </div>
    </div>
  ),
};

/**
 * Required field indicator.
 */
export const Required: Story = {
  render: () => (
    <div className="space-y-4 w-[350px]">
      <div className="space-y-2">
        <Label htmlFor="name">
          Name <span className="text-destructive">*</span>
        </Label>
        <Input id="name" placeholder="John Doe" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">
          Email <span className="text-destructive">*</span>
        </Label>
        <Input id="email" type="email" placeholder="john@example.com" />
      </div>
    </div>
  ),
};

/**
 * Label with helper text.
 */
export const WithHelperText: Story = {
  render: () => (
    <div className="space-y-4 w-[350px]">
      <div className="space-y-2">
        <Label htmlFor="username">Username</Label>
        <Input id="username" placeholder="johndoe" />
        <p className="text-xs text-muted-foreground">
          Choose a unique username for your account
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="bio">Bio</Label>
        <Input id="bio" placeholder="Tell us about yourself" />
        <p className="text-xs text-muted-foreground">Maximum 200 characters</p>
      </div>
    </div>
  ),
};

/**
 * Label with error state.
 */
export const ErrorState: Story = {
  render: () => (
    <div className="space-y-4 w-[350px]">
      <div className="space-y-2">
        <Label htmlFor="error-email" className="text-destructive">
          Email
        </Label>
        <Input
          id="error-email"
          className="border-destructive focus-visible:ring-destructive"
          placeholder="john@example.com"
        />
        <p className="text-xs text-destructive">Please enter a valid email</p>
      </div>
    </div>
  ),
};

/**
 * Horizontal form layout with labels.
 */
export const HorizontalForm: Story = {
  render: () => (
    <div className="space-y-4 w-[450px]">
      <div className="grid grid-cols-4 items-center gap-4">
        <Label htmlFor="name" className="text-right">
          Name
        </Label>
        <Input id="name" className="col-span-3" placeholder="John Doe" />
      </div>
      <div className="grid grid-cols-4 items-center gap-4">
        <Label htmlFor="email" className="text-right">
          Email
        </Label>
        <Input
          id="email"
          type="email"
          className="col-span-3"
          placeholder="john@example.com"
        />
      </div>
      <div className="grid grid-cols-4 items-center gap-4">
        <Label htmlFor="role" className="text-right">
          Role
        </Label>
        <Input id="role" className="col-span-3" placeholder="Administrator" />
      </div>
    </div>
  ),
};

/**
 * Custom styled label.
 */
export const CustomStyled: Story = {
  render: () => (
    <div className="space-y-4 w-[350px]">
      <div className="space-y-2">
        <Label className="text-base font-semibold" htmlFor="large">
          Large Label
        </Label>
        <Input id="large" placeholder="Input with large label" />
      </div>
      <div className="space-y-2">
        <Label className="text-muted-foreground" htmlFor="muted">
          Muted Label
        </Label>
        <Input id="muted" placeholder="Input with muted label" />
      </div>
    </div>
  ),
};
