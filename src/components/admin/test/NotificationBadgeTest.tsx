import { useState } from "react";
import { useAdminNotificationCounts } from "@/hooks/useAdminNotificationCounts";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import { Callout } from "@/components/ui/callout";
import { Button } from "@/components/ui/button";

/**
 * Test component to verify notification badge counts are working.
 * This shows:
 * 1. Raw API responses for each count source
 * 2. The processed counts from useAdminNotificationCounts hook
 * 3. Test buttons to create sample notifications
 */
export function NotificationBadgeTest() {
  const { user } = useAuth();
  const { counts, isLoading } = useAdminNotificationCounts();
  const [apiResults, setApiResults] = useState<{
    pendingBookings: any;
    notifications: any;
    messages: any;
    pendingMembers: any;
  }>({
    pendingBookings: null,
    notifications: null,
    messages: null,
    pendingMembers: null,
  });
  const [testResult, setTestResult] = useState<string | null>(null);

  // Fetch raw API results
  const fetchRawApiResults = async () => {
    setTestResult("Fetching...");
    try {
      const [pendingBookings, notifications, messages, pendingMembers] =
        await Promise.all([
          api.adminPublicBookings.getPending(),
          api.notifications.list({ read: false, limit: 100 }),
          api.messages.getThreads(100, 0),
          api.lotMembers.getPendingMembers().catch(() => ({ data: null })),
        ]);

      setApiResults({
        pendingBookings: pendingBookings.data,
        notifications: notifications.data,
        messages: messages.data,
        pendingMembers: pendingMembers.data,
      });
      setTestResult("Fetched successfully!");
    } catch (err) {
      setTestResult(`Error: ${err}`);
      console.error("API test error:", err);
    }
  };

  // Create a test notification
  const createTestNotification = async () => {
    if (!user?.id) {
      setTestResult("Error: Not logged in");
      return;
    }
    setTestResult("Creating test notification...");
    try {
      const response = await api.notifications.create({
        user_id: user.id,
        type: "announcement",
        title: "Test Notification",
        content: "This is a test notification to verify badges work.",
      });
      if (response.error) {
        setTestResult(`Failed: ${response.error}`);
      } else {
        setTestResult("Test notification created! Refresh counts.");
        // Refetch after a delay
        setTimeout(fetchRawApiResults, 500);
      }
    } catch (err) {
      setTestResult(`Error: ${err}`);
    }
  };

  return (
    <div className="space-y-6 p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold">Notification Badge Test</h1>

      {/* Test controls */}
      <div className="flex gap-4">
        <Button onClick={fetchRawApiResults}>Fetch API Results</Button>
        <Button variant="outline" onClick={createTestNotification}>
          Create Test Notification
        </Button>
      </div>

      {testResult && (
        <Callout variant={testResult.startsWith("Error") ? "error" : "info"}>
          {testResult}
        </Callout>
      )}

      {/* Hook Results */}
      <div className="bg-card rounded-lg border p-4 space-y-4">
        <h2 className="text-lg font-semibold">
          useAdminNotificationCounts Hook Results
        </h2>
        {isLoading ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-primary/10 rounded-lg p-4">
              <p className="text-sm text-muted-foreground">Pending Bookings</p>
              <p className="text-3xl font-bold text-primary">
                {counts.pendingBookings}
              </p>
            </div>
            <div className="bg-primary/10 rounded-lg p-4">
              <p className="text-sm text-muted-foreground">
                Unread Notifications
              </p>
              <p className="text-3xl font-bold text-primary">
                {counts.unreadNotifications}
              </p>
            </div>
            <div className="bg-primary/10 rounded-lg p-4">
              <p className="text-sm text-muted-foreground">Unread Messages</p>
              <p className="text-3xl font-bold text-primary">
                {counts.unreadMessages}
              </p>
            </div>
            <div className="bg-primary/10 rounded-lg p-4">
              <p className="text-sm text-muted-foreground">
                Household Approvals
              </p>
              <p className="text-3xl font-bold text-primary">
                {counts.pendingHouseholdApprovals}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Raw API Results */}
      <div className="bg-card rounded-lg border p-4 space-y-4">
        <h2 className="text-lg font-semibold">Raw API Responses</h2>

        {/* Pending Bookings */}
        <div>
          <h3 className="font-medium text-sm mb-2">
            api.adminPublicBookings.getPending()
          </h3>
          <pre className="bg-muted p-3 rounded text-xs overflow-auto max-h-48">
            {JSON.stringify(apiResults.pendingBookings, null, 2)}
          </pre>
          <p className="text-xs text-muted-foreground mt-1">
            Expected: Array of pending bookings | Actual count:{" "}
            {apiResults.pendingBookings?.length || 0}
          </p>
        </div>

        {/* Notifications */}
        <div>
          <h3 className="font-medium text-sm mb-2">
            api.notifications.list(&#123; read: false &#125;)
          </h3>
          <pre className="bg-muted p-3 rounded text-xs overflow-auto max-h-48">
            {JSON.stringify(apiResults.notifications, null, 2)}
          </pre>
          <p className="text-xs text-muted-foreground mt-1">
            Expected: unread_count in response | Actual count:{" "}
            {apiResults.notifications?.unread_count || 0}
          </p>
        </div>

        {/* Messages */}
        <div>
          <h3 className="font-medium text-sm mb-2">
            api.messages.getThreads()
          </h3>
          <pre className="bg-muted p-3 rounded text-xs overflow-auto max-h-48">
            {JSON.stringify(apiResults.messages, null, 2)}
          </pre>
          <p className="text-xs text-muted-foreground mt-1">
            Expected: Array of message threads | Actual count:{" "}
            {apiResults.messages?.threads?.length ||
              apiResults.messages?.length ||
              0}
          </p>
        </div>

        {/* Pending Members */}
        <div>
          <h3 className="font-medium text-sm mb-2">
            api.lotMembers.getPendingMembers()
          </h3>
          <pre className="bg-muted p-3 rounded text-xs overflow-auto max-h-48">
            {JSON.stringify(apiResults.pendingMembers, null, 2)}
          </pre>
          <p className="text-xs text-muted-foreground mt-1">
            Expected: Array of pending members | Actual count:{" "}
            {apiResults.pendingMembers?.members?.length ||
              apiResults.pendingMembers?.length ||
              0}
          </p>
        </div>
      </div>

      {/* Badge Preview */}
      <div className="bg-card rounded-lg border p-4 space-y-4">
        <h2 className="text-lg font-semibold">Badge Preview (Sidebar Style)</h2>
        <div className="space-y-2">
          {[
            { label: "All Bookings", count: counts.pendingBookings },
            {
              label: "Household Approvals",
              count: counts.pendingHouseholdApprovals,
            },
            { label: "Notifications", count: counts.unreadNotifications },
            { label: "Messages", count: counts.unreadMessages },
          ].map((item) => (
            <div
              key={item.label}
              className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-accent"
            >
              <span className="text-sm">{item.label}</span>
              {item.count > 0 && (
                <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
                  {item.count > 9 ? "9+" : item.count}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-muted rounded-lg p-4 text-sm space-y-2">
        <h3 className="font-semibold">How to use:</h3>
        <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
          <li>Click "Fetch API Results" to see raw data from each endpoint</li>
          <li>Compare the counts with what appears in the sidebar</li>
          <li>
            Click "Create Test Notification" to add a notification and verify
            the badge updates
          </li>
          <li>Check browser console for any API errors</li>
        </ol>
      </div>
    </div>
  );
}
