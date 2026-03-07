import type { Meta, StoryObj } from "@storybook/react";
import {
  Sheet,
  SheetPortal,
  SheetOverlay,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
} from "./sheet";
import { Button } from "./button";

/**
 * Sheet component stories demonstrating slide-over panels.
 */
const meta = {
  title: "UI/Sheet",
  component: SheetContent,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    side: {
      control: "select",
      options: ["left", "right", "top", "bottom"],
      description: "Side of the screen where sheet appears",
    },
  },
} satisfies Meta<typeof SheetContent>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * A basic sheet sliding from the right.
 */
export const Default: Story = {
  render: () => (
    <Sheet>
      <SheetTrigger asChild>
        <Button>Open Sheet</Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Are you sure?</SheetTitle>
          <SheetDescription>
            This action cannot be undone. Are you sure you want to continue?
          </SheetDescription>
        </SheetHeader>
        <div className="py-4">
          <p>This is the sheet content.</p>
        </div>
      </SheetContent>
    </Sheet>
  ),
};

/**
 * Sheet from the left side.
 */
export const LeftSide: Story = {
  render: () => (
    <Sheet>
      <SheetTrigger asChild>
        <Button>Open Left Sheet</Button>
      </SheetTrigger>
      <SheetContent side="left">
        <SheetHeader>
          <SheetTitle>Left Sheet</SheetTitle>
          <SheetDescription>
            This sheet slides in from the left side of the screen.
          </SheetDescription>
        </SheetHeader>
        <div className="py-4">
          <p>Content for the left sheet panel.</p>
        </div>
      </SheetContent>
    </Sheet>
  ),
};

/**
 * Sheet from the top.
 */
export const TopSide: Story = {
  render: () => (
    <Sheet>
      <SheetTrigger asChild>
        <Button>Open Top Sheet</Button>
      </SheetTrigger>
      <SheetContent side="top">
        <SheetHeader>
          <SheetTitle>Top Sheet</SheetTitle>
          <SheetDescription>
            This sheet slides down from the top of the screen.
          </SheetDescription>
        </SheetHeader>
        <div className="py-4">
          <p>Content for the top sheet panel.</p>
        </div>
      </SheetContent>
    </Sheet>
  ),
};

/**
 * Sheet from the bottom.
 */
export const BottomSide: Story = {
  render: () => (
    <Sheet>
      <SheetTrigger asChild>
        <Button>Open Bottom Sheet</Button>
      </SheetTrigger>
      <SheetContent side="bottom">
        <SheetHeader>
          <SheetTitle>Bottom Sheet</SheetTitle>
          <SheetDescription>
            This sheet slides up from the bottom of the screen.
          </SheetDescription>
        </SheetHeader>
        <div className="py-4">
          <p>Content for the bottom sheet panel.</p>
        </div>
      </SheetContent>
    </Sheet>
  ),
};

/**
 * Sheet with form content.
 */
export const WithForm: Story = {
  render: () => (
    <Sheet>
      <SheetTrigger asChild>
        <Button>Edit Profile</Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Edit Profile</SheetTitle>
          <SheetDescription>
            Make changes to your profile here. Click save when you're done.
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label htmlFor="name" className="text-sm font-medium">
              Name
            </label>
            <input
              id="name"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              defaultValue="John Doe"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              type="email"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              defaultValue="john@example.com"
            />
          </div>
        </div>
        <SheetFooter>
          <SheetClose asChild>
            <Button variant="outline">Cancel</Button>
          </SheetClose>
          <Button>Save Changes</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  ),
};

/**
 * Sheet with long content testing scroll.
 */
export const LongContent: Story = {
  render: () => (
    <Sheet>
      <SheetTrigger asChild>
        <Button>Terms of Service</Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Terms of Service</SheetTitle>
          <SheetDescription>
            Please read and accept our terms of service
          </SheetDescription>
        </SheetHeader>
        <div className="overflow-y-auto max-h-[60vh] space-y-4 py-4">
          <p>
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do
            eiusmod tempor incididunt ut labore et dolore magna aliqua.
          </p>
          <p>
            Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris
            nisi ut aliquip ex ea commodo consequat.
          </p>
          <p>
            Duis aute irure dolor in reprehenderit in voluptate velit esse
            cillum dolore eu fugiat nulla pariatur.
          </p>
          <p>
            Excepteur sint occaecat cupidatat non proident, sunt in culpa qui
            officia deserunt mollit anim id est laborum.
          </p>
          <p>
            Sed ut perspiciatis unde omnis iste natus error sit voluptatem
            accusantium doloremque laudantium.
          </p>
          <p>
            Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut
            fugit.
          </p>
        </div>
        <SheetFooter>
          <SheetClose asChild>
            <Button variant="outline">Close</Button>
          </SheetClose>
          <Button>Accept</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  ),
};

/**
 * Navigation sheet example.
 */
export const Navigation: Story = {
  render: () => (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline">Menu</Button>
      </SheetTrigger>
      <SheetContent side="left">
        <SheetHeader>
          <SheetTitle>Navigation</SheetTitle>
        </SheetHeader>
        <nav className="space-y-4 py-4">
          <a
            href="#"
            className="block py-2 text-sm font-medium hover:underline"
          >
            Dashboard
          </a>
          <a
            href="#"
            className="block py-2 text-sm font-medium hover:underline"
          >
            Projects
          </a>
          <a
            href="#"
            className="block py-2 text-sm font-medium hover:underline"
          >
            Settings
          </a>
          <a
            href="#"
            className="block py-2 text-sm font-medium hover:underline"
          >
            Profile
          </a>
        </nav>
      </SheetContent>
    </Sheet>
  ),
};
