import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UsersTab } from "./UsersTab";
import { BoardMembersTab } from "./BoardMembersTab";
import { useAuth } from "@/hooks/useAuth";

type UserSubTab = "users" | "board-members";

export function UsersSection() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();

  // Security: Ensure only admins can access this page
  if (user?.role !== "admin") {
    return (
      <div className="bg-[hsl(var(--status-error-bg))] border border-[hsl(var(--status-error-fg))] text-[hsl(var(--status-error-fg))] p-4 rounded-lg">
        Access denied. Admin privileges required.
      </div>
    );
  }
  const tabParam = searchParams.get("tab");
  const initialTab = tabParam === "board-members" ? "board-members" : "users";
  const [activeSubTab, setActiveSubTab] = useState<UserSubTab>(initialTab);

  useEffect(() => {
    if (tabParam === "board-members") {
      setActiveSubTab("board-members");
    }
  }, [tabParam]);

  return (
    <Tabs
      value={activeSubTab}
      onValueChange={(v) => setActiveSubTab(v as UserSubTab)}
      className="space-y-6"
    >
      <TabsList className="grid w-full grid-cols-2 lg:w-auto">
        <TabsTrigger value="users">Users</TabsTrigger>
        <TabsTrigger value="board-members">Board Members</TabsTrigger>
      </TabsList>

      <TabsContent value="users" className="space-y-6">
        <UsersTab />
      </TabsContent>

      <TabsContent value="board-members" className="space-y-6">
        <BoardMembersTab amenityTypes={[]} />
      </TabsContent>
    </Tabs>
  );
}
