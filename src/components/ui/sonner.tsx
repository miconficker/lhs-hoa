import { Toaster as Sonner } from "sonner";

export function Toaster() {
  return (
    <Sonner
      position="top-right"
      expand={false}
      richColors
      closeButton
      // Accessibility: Ensure toasts are announced to screen readers
      toastOptions={{
        ariaLive: "polite",
        ariaAtomic: true,
      }}
    />
  );
}
