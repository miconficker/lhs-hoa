import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export interface AdminNotificationCounts {
  pendingBookings: number;
  unreadNotifications: number;
  unreadMessages: number;
  pendingHouseholdApprovals: number;
}

export function useAdminNotificationCounts() {
  const [counts, setCounts] = useState<AdminNotificationCounts>({
    pendingBookings: 0,
    unreadNotifications: 0,
    unreadMessages: 0,
    pendingHouseholdApprovals: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchCounts() {
      try {
        // Fetch all counts in parallel
        const [
          pendingBookingsResult,
          notificationsResult,
          messagesResult,
          pendingMembersResult,
        ] = await Promise.allSettled([
          api.adminPublicBookings.getPending(),
          api.notifications.list({ read: false, limit: 1 }),
          api.messages.getThreads(100, 0),
          api.lotMembers.getPendingMembers(),
        ]);

        let pendingBookings = 0;
        let unreadNotifications = 0;
        let unreadMessages = 0;
        let pendingHouseholdApprovals = 0;

        if (
          pendingBookingsResult.status === "fulfilled" &&
          pendingBookingsResult.value.data
        ) {
          pendingBookings = pendingBookingsResult.value.data.length || 0;
        }

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

        if (
          pendingMembersResult.status === "fulfilled" &&
          pendingMembersResult.value.data
        ) {
          pendingHouseholdApprovals =
            pendingMembersResult.value.data.members?.length || 0;
        }

        setCounts({
          pendingBookings,
          unreadNotifications,
          unreadMessages,
          pendingHouseholdApprovals,
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
