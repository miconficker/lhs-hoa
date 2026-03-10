import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UsersTab } from "./UsersTab";
import { BoardMembersTab } from "./BoardMembersTab";

type UserSubTab = "users" | "board-members";

export function UsersSection() {
  const [searchParams] = useSearchParams();
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
