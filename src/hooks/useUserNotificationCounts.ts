import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export interface UserNotificationCounts {
  unreadNotifications: number;
  unreadMessages: number;
}

export function useUserNotificationCounts() {
  const [counts, setCounts] = useState<UserNotificationCounts>({
    unreadNotifications: 0,
    unreadMessages: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchCounts() {
      try {
        // Fetch all counts in parallel
        const [notificationsResult, messagesResult] = await Promise.allSettled([
          api.notifications.list({ limit: 1 }),
          api.messages.getThreads(100, 0),
        ]);

        let unreadNotifications = 0;
        let unreadMessages = 0;

        if (
          notificationsResult.status === "fulfilled" &&
          notificationsResult.value.data
        ) {
          unreadNotifications =
            notificationsResult.value.data.unread_count ??
            notificationsResult.value.data.notifications?.length ??
            0;
        }

        if (
          messagesResult.status === "fulfilled" &&
          messagesResult.value.data
        ) {
          // Count unread messages (threads with unread messages)
          const threads = messagesResult.value.data.threads || [];
          unreadMessages = threads.filter(
            (thread) => thread.unread_count && thread.unread_count > 0,
          ).length;
        }

        setCounts({
          unreadNotifications,
          unreadMessages,
        });
      } catch (error) {
        console.error("Failed to fetch notification counts:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchCounts();

    // Refresh counts every 30 seconds
    const interval = setInterval(fetchCounts, 30000);
    return () => clearInterval(interval);
  }, []);

  return { counts, isLoading };
}
