import { toast } from "sonner";
import { messages } from "./content/messages";

export const notify = {
  success: (message: string) => toast.success(message),
  error: (message: string) => toast.error(message),
  warning: (message: string) => toast.warning(message),
  info: (message: string) => toast.info(message),

  // Pre-defined messages
  loginSuccess: () => toast.success(messages.loginSuccess),
  loginError: () => toast.error(messages.loginError),
  requestSubmitted: () => toast.success(messages.requestSubmitted),
  paymentSubmitted: () => toast.success(messages.paymentSubmitted),
  saved: () => toast.success(messages.saved),
};
