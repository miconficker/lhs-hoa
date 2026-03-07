import type { Meta, StoryObj } from "@storybook/react";
import { RadioGroup, RadioGroupItem } from "./radio-group";
import { Label } from "./label";

/**
 * RadioGroup component stories demonstrating radio button groups.
 */
const meta = {
  title: "UI/RadioGroup",
  component: RadioGroup,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    disabled: {
      control: "boolean",
      description: "Disable the radio group",
    },
  },
} satisfies Meta<typeof RadioGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * A basic radio group with default selection.
 */
export const Default: Story = {
  render: () => (
    <RadioGroup defaultValue="option1">
      <div className="flex items-center space-x-2">
        <RadioGroupItem value="option1" id="option1" />
        <Label htmlFor="option1">Option 1</Label>
      </div>
      <div className="flex items-center space-x-2">
        <RadioGroupItem value="option2" id="option2" />
        <Label htmlFor="option2">Option 2</Label>
      </div>
      <div className="flex items-center space-x-2">
        <RadioGroupItem value="option3" id="option3" />
        <Label htmlFor="option3">Option 3</Label>
      </div>
    </RadioGroup>
  ),
};

/**
 * Radio group with labels and descriptions.
 */
export const WithDescriptions: Story = {
  render: () => (
    <RadioGroup defaultValue="comfortable">
      <div className="space-y-1">
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="comfortable" id="comfortable" />
          <Label htmlFor="comfortable">Comfortable</Label>
        </div>
        <p className="text-xs text-muted-foreground ml-6">
          Spacious seating with extra legroom
        </p>
      </div>
      <div className="space-y-1">
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="compact" id="compact" />
          <Label htmlFor="compact">Compact</Label>
        </div>
        <p className="text-xs text-muted-foreground ml-6">
          Efficient use of space
        </p>
      </div>
      <div className="space-y-1">
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="spacious" id="spacious" />
          <Label htmlFor="spacious">Spacious</Label>
        </div>
        <p className="text-xs text-muted-foreground ml-6">
          Maximum room and comfort
        </p>
      </div>
    </RadioGroup>
  ),
};

/**
 * Vertical radio group layout.
 */
export const Vertical: Story = {
  render: () => (
    <RadioGroup defaultValue="default">
      <div className="flex items-center space-x-2">
        <RadioGroupItem value="default" id="v-default" />
        <Label htmlFor="v-default">Default Theme</Label>
      </div>
      <div className="flex items-center space-x-2">
        <RadioGroupItem value="dark" id="v-dark" />
        <Label htmlFor="v-dark">Dark Mode</Label>
      </div>
      <div className="flex items-center space-x-2">
        <RadioGroupItem value="light" id="v-light" />
        <Label htmlFor="v-light">Light Mode</Label>
      </div>
    </RadioGroup>
  ),
};

/**
 * Horizontal radio group layout.
 */
export const Horizontal: Story = {
  render: () => (
    <RadioGroup className="flex gap-6" defaultValue="small">
      <div className="flex items-center space-x-2">
        <RadioGroupItem value="small" id="small" />
        <Label htmlFor="small">Small</Label>
      </div>
      <div className="flex items-center space-x-2">
        <RadioGroupItem value="medium" id="medium" />
        <Label htmlFor="medium">Medium</Label>
      </div>
      <div className="flex items-center space-x-2">
        <RadioGroupItem value="large" id="large" />
        <Label htmlFor="large">Large</Label>
      </div>
    </RadioGroup>
  ),
};

/**
 * Disabled radio group.
 */
export const Disabled: Story = {
  render: () => (
    <RadioGroup disabled defaultValue="option1">
      <div className="flex items-center space-x-2">
        <RadioGroupItem value="option1" id="disabled1" />
        <Label htmlFor="disabled1">Disabled Option 1</Label>
      </div>
      <div className="flex items-center space-x-2">
        <RadioGroupItem value="option2" id="disabled2" />
        <Label htmlFor="disabled2">Disabled Option 2</Label>
      </div>
    </RadioGroup>
  ),
};

/**
 * Mixed enabled and disabled items.
 */
export const MixedState: Story = {
  render: () => (
    <RadioGroup defaultValue="free">
      <div className="flex items-center space-x-2">
        <RadioGroupItem value="free" id="free" />
        <Label htmlFor="free">Free Plan</Label>
      </div>
      <div className="flex items-center space-x-2">
        <RadioGroupItem value="pro" id="pro" />
        <Label htmlFor="pro">Pro Plan</Label>
      </div>
      <div className="flex items-center space-x-2 opacity-50">
        <RadioGroupItem value="enterprise" id="enterprise" disabled />
        <Label htmlFor="enterprise" className="cursor-not-allowed">
          Enterprise Plan (Sold Out)
        </Label>
      </div>
    </RadioGroup>
  ),
};

/**
 * Radio group in a form context.
 */
export const FormContext: Story = {
  render: () => (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold mb-2">Notification Preferences</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Choose how you want to receive notifications
        </p>
      </div>
      <RadioGroup defaultValue="all">
        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="all" id="all" />
            <div className="space-y-1">
              <Label htmlFor="all">All Notifications</Label>
              <p className="text-xs text-muted-foreground">
                Receive all updates via email and push notifications
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="email" id="email-only" />
            <div className="space-y-1">
              <Label htmlFor="email-only">Email Only</Label>
              <p className="text-xs text-muted-foreground">
                Receive updates only via email
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="none" id="none" />
            <div className="space-y-1">
              <Label htmlFor="none">None</Label>
              <p className="text-xs text-muted-foreground">
                No notifications, check manually
              </p>
            </div>
          </div>
        </div>
      </RadioGroup>
    </div>
  ),
};
