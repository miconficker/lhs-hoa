import { useState } from "react";
import { useAdminNotificationCounts } from "@/hooks/useAdminNotificationCounts";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";

/**
 * Test page to verify notification badge counts
 */
export function NotificationBadgeTestPage() {
  const { counts, isLoading } = useAdminNotificationCounts();
  const { user } = useAuth();
  const [testResult, setTestResult] = useState<string | null>(null);
  const [apiResults, setApiResults] = useState<any>(null);

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
        setTestResult("✅ Test notification created! Check the sidebar badge.");
      }
    } catch (err: any) {
      setTestResult(`Error: ${err.message || err}`);
    }
  };

  const fetchNotificationsDirect = async () => {
    setTestResult("Fetching...");
    try {
      const response = await api.notifications.list({ limit: 10 });
      setApiResults(response);
      setTestResult(
        `✅ Found ${response.data?.notifications?.length || 0} notifications`,
      );
    } catch (err: any) {
      setTestResult(`Error: ${err.message || err}`);
    }
  };

  return (
    <div className="space-y-6 p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold">Notification Badge Test</h1>

      {testResult && (
        <div
          className={`p-4 rounded-lg border ${
            testResult.startsWith("✅")
              ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
              : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
          }`}
        >
          {testResult}
        </div>
      )}

      <div className="flex gap-4">
        <Button onClick={fetchNotificationsDirect}>Fetch Notifications</Button>
        <Button variant="outline" onClick={createTestNotification}>
          Create Test Notification
        </Button>
      </div>

      {isLoading ? (
        <p>Loading...</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-card rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">Pending Bookings</p>
            <p className="text-3xl font-bold">{counts.pendingBookings}</p>
          </div>
          <div className="bg-card rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">
              Unread Notifications
            </p>
            <p className="text-3xl font-bold">{counts.unreadNotifications}</p>
          </div>
          <div className="bg-card rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">Unread Messages</p>
            <p className="text-3xl font-bold">{counts.unreadMessages}</p>
          </div>
          <div className="bg-card rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">Household Approvals</p>
            <p className="text-3xl font-bold">
              {counts.pendingHouseholdApprovals}
            </p>
          </div>
        </div>
      )}

      {apiResults && (
        <div className="bg-card rounded-lg border p-4">
          <h3 className="font-semibold mb-2">Raw API Response:</h3>
          <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-48">
            {JSON.stringify(apiResults, null, 2)}
          </pre>
        </div>
      )}

      <div className="bg-muted rounded-lg p-4 text-sm">
        <h3 className="font-semibold mb-2">How to test:</h3>
        <ol className="list-decimal list-inside space-y-1">
          <li>
            Click "Create Test Notification" to add a notification for your
            account
          </li>
          <li>
            Look at the sidebar - you should see a badge number on the bell icon
          </li>
          <li>Click the bell to see your notification</li>
        </ol>
      </div>
    </div>
  );
}
