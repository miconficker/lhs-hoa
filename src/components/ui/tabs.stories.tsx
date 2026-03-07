import type { Meta, StoryObj } from "@storybook/react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./tabs";

/**
 * Tabs component stories demonstrating tabbed content.
 */
const meta = {
  title: "UI/Tabs",
  component: TabsList,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    defaultValue: {
      control: "text",
      description: "Default active tab value",
    },
  },
} satisfies Meta<typeof TabsList>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Basic tabs with default selection.
 */
export const Default: Story = {
  render: () => (
    <Tabs defaultValue="account">
      <TabsList>
        <TabsTrigger value="account">Account</TabsTrigger>
        <TabsTrigger value="password">Password</TabsTrigger>
      </TabsList>
      <TabsContent value="account">
        <div className="space-y-2">
          <p className="text-sm">Make changes to your account here.</p>
          <input
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            defaultValue="john@example.com"
          />
        </div>
      </TabsContent>
      <TabsContent value="password">
        <div className="space-y-2">
          <p className="text-sm">Change your password here.</p>
          <input
            type="password"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            defaultValue="password123"
          />
        </div>
      </TabsContent>
    </Tabs>
  ),
};

/**
 * Three tabs example.
 */
export const ThreeTabs: Story = {
  render: () => (
    <Tabs defaultValue="overview">
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="features">Features</TabsTrigger>
        <TabsTrigger value="pricing">Pricing</TabsTrigger>
      </TabsList>
      <TabsContent value="overview">
        <p className="text-sm p-4">
          This is the overview tab content. It provides a general introduction
          to the product or service.
        </p>
      </TabsContent>
      <TabsContent value="features">
        <p className="text-sm p-4">
          This tab highlights the key features and capabilities of the product.
        </p>
      </TabsContent>
      <TabsContent value="pricing">
        <p className="text-sm p-4">
          Pricing information and plans are displayed in this tab.
        </p>
      </TabsContent>
    </Tabs>
  ),
};

/**
 * Vertical tabs layout.
 */
export const VerticalTabs: Story = {
  render: () => (
    <div className="flex gap-4">
      <Tabs defaultValue="tab1" orientation="vertical" className="w-[200px]">
        <TabsList className="flex flex-col h-full w-full">
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          <TabsTrigger value="tab2">Tab 2</TabsTrigger>
          <TabsTrigger value="tab3">Tab 3</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1" className="mt-2">
          <p className="text-sm">Content for Tab 1</p>
        </TabsContent>
        <TabsContent value="tab2" className="mt-2">
          <p className="text-sm">Content for Tab 2</p>
        </TabsContent>
        <TabsContent value="tab3" className="mt-2">
          <p className="text-sm">Content for Tab 3</p>
        </TabsContent>
      </Tabs>
    </div>
  ),
};

/**
 * Tabs with icons.
 */
export const WithIcons: Story = {
  render: () => (
    <Tabs defaultValue="preview">
      <TabsList>
        <TabsTrigger value="preview">
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
            className="mr-2"
          >
            <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          Preview
        </TabsTrigger>
        <TabsTrigger value="code">
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
            className="mr-2"
          >
            <polyline points="16 18 22 12 16 6" />
            <polyline points="8 6 2 12 8 18" />
          </svg>
          Code
        </TabsTrigger>
      </TabsList>
      <TabsContent value="preview">
        <p className="text-sm p-4">Preview content goes here.</p>
      </TabsContent>
      <TabsContent value="code">
        <p className="text-sm p-4">Code content goes here.</p>
      </TabsContent>
    </Tabs>
  ),
};

/**
 * Tabs with rich content.
 */
export const RichContent: Story = {
  render: () => (
    <Tabs defaultValue="profile" className="w-[500px]">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="profile">Profile</TabsTrigger>
        <TabsTrigger value="settings">Settings</TabsTrigger>
        <TabsTrigger value="billing">Billing</TabsTrigger>
      </TabsList>
      <TabsContent value="profile" className="space-y-4">
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">Profile Information</h3>
          <p className="text-sm text-muted-foreground">
            Manage your profile information and preferences.
          </p>
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">First Name</label>
              <input
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                defaultValue="John"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Last Name</label>
              <input
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                defaultValue="Doe"
              />
            </div>
          </div>
        </div>
      </TabsContent>
      <TabsContent value="settings" className="space-y-4">
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">Settings</h3>
          <p className="text-sm text-muted-foreground">
            Configure your application settings.
          </p>
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Email Notifications</p>
              <p className="text-xs text-muted-foreground">
                Receive email updates about your account
              </p>
            </div>
            <input type="checkbox" className="h-4 w-4" />
          </div>
        </div>
      </TabsContent>
      <TabsContent value="billing" className="space-y-4">
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">Billing Information</h3>
          <p className="text-sm text-muted-foreground">
            Manage your billing and payment information.
          </p>
        </div>
        <div className="space-y-4">
          <div className="rounded-lg border p-4">
            <p className="text-sm font-medium">Premium Plan</p>
            <p className="text-xs text-muted-foreground">$29/month</p>
          </div>
        </div>
      </TabsContent>
    </Tabs>
  ),
};

/**
 * Disabled tab example.
 */
export const DisabledTab: Story = {
  render: () => (
    <Tabs defaultValue="tab1">
      <TabsList>
        <TabsTrigger value="tab1">Active Tab</TabsTrigger>
        <TabsTrigger value="tab2">Another Tab</TabsTrigger>
        <TabsTrigger value="tab3" disabled>
          Disabled Tab
        </TabsTrigger>
      </TabsList>
      <TabsContent value="tab1">
        <p className="text-sm p-4">Content for active tab</p>
      </TabsContent>
      <TabsContent value="tab2">
        <p className="text-sm p-4">Content for another tab</p>
      </TabsContent>
      <TabsContent value="tab3">
        <p className="text-sm p-4">This tab is disabled</p>
      </TabsContent>
    </Tabs>
  ),
};
