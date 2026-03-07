import type { Meta, StoryObj } from "@storybook/react";
import { toast } from "sonner";
import { Button } from "./button";
import { Toaster } from "./sonner";

/**
 * Sonner (Toast) component stories demonstrating toast notifications.
 */
const meta = {
  title: "UI/Sonner",
  component: Toaster,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof Toaster>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Basic toast notification.
 */
export const Default: Story = {
  render: () => (
    <>
      <Toaster />
      <Button onClick={() => toast("Event has been created")}>
        Show Toast
      </Button>
    </>
  ),
};

/**
 * Success toast notification.
 */
export const Success: Story = {
  render: () => (
    <>
      <Toaster />
      <div className="flex gap-2">
        <Button onClick={() => toast.success("Event created successfully")}>
          Success Toast
        </Button>
      </div>
    </>
  ),
};

/**
 * Error toast notification.
 */
export const Error: Story = {
  render: () => (
    <>
      <Toaster />
      <Button
        onClick={() => toast.error("Event could not be created")}
        variant="destructive"
      >
        Error Toast
      </Button>
    </>
  ),
};

/**
 * All toast types.
 */
export const AllTypes: Story = {
  render: () => (
    <>
      <Toaster />
      <div className="flex flex-col gap-2">
        <Button onClick={() => toast("Default message")}>Default</Button>
        <Button onClick={() => toast.success("Success message")}>
          Success
        </Button>
        <Button onClick={() => toast.error("Error message")}>Error</Button>
        <Button onClick={() => toast.info("Info message")}>Info</Button>
        <Button onClick={() => toast.warning("Warning message")}>
          Warning
        </Button>
      </div>
    </>
  ),
};

/**
 * Toast with action button.
 */
export const WithAction: Story = {
  render: () => (
    <>
      <Toaster />
      <Button
        onClick={() =>
          toast("Event has been created", {
            action: {
              label: "Undo",
              onClick: () => console.log("Undo"),
            },
          })
        }
      >
        Toast with Action
      </Button>
    </>
  ),
};

/**
 * Toast with promise (loading state).
 */
export const WithPromise: Story = {
  render: () => (
    <>
      <Toaster />
      <Button
        onClick={() =>
          toast.promise(
            new Promise((resolve) => setTimeout(() => resolve("Done!"), 2000)),
            {
              loading: "Loading...",
              success: "Data loaded successfully",
              error: "Error loading data",
            },
          )
        }
      >
        Promise Toast
      </Button>
    </>
  ),
};

/**
 * Toast with rich description.
 */
export const WithDescription: Story = {
  render: () => (
    <>
      <Toaster />
      <Button
        onClick={() =>
          toast("Event created", {
            description: "Monday, January 1st at 12:00 PM",
          })
        }
      >
        Toast with Description
      </Button>
    </>
  ),
};

/**
 * Dismissible toast.
 */
export const Dismissible: Story = {
  render: () => (
    <>
      <Toaster />
      <Button
        onClick={() =>
          toast("This toast can be dismissed", {
            dismissible: true,
          })
        }
      >
        Dismissible Toast
      </Button>
    </>
  ),
};

/**
 * Multiple toast examples.
 */
export const MultipleToasts: Story = {
  render: () => (
    <>
      <Toaster />
      <div className="flex flex-col gap-2">
        <Button
          onClick={() => {
            toast.success("First toast");
            setTimeout(() => toast.info("Second toast"), 500);
            setTimeout(() => toast.warning("Third toast"), 1000);
          }}
        >
          Show Multiple
        </Button>
      </div>
    </>
  ),
};

/**
 * Toast with custom duration.
 */
export const CustomDuration: Story = {
  render: () => (
    <>
      <Toaster />
      <Button
        onClick={() =>
          toast("This toast will close in 10 seconds", {
            duration: 10000,
          })
        }
      >
        Long Duration Toast
      </Button>
    </>
  ),
};
