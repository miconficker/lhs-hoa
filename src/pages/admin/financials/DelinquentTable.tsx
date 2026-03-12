// src/pages/admin/financials/DelinquentTable.tsx
import { useState } from "react";
import type { DelinquentMember } from "@/types";
import { Calendar, DollarSign } from "lucide-react";
import { DelinquentActions } from "./DelinquentActions";
import { cn } from "@/lib/utils";

interface DelinquentTableProps {
  delinquents: DelinquentMember[];
  loading: boolean;
  onRefresh: () => void;
}

export function DelinquentTable({
  delinquents,
  loading,
  onRefresh,
}: DelinquentTableProps) {
  const [filter, setFilter] = useState<"all" | "automatic" | "manual">("all");
  const [search, setSearch] = useState("");

  const filteredDelinquents = delinquents.filter((d) => {
    const matchesFilter = filter === "all" || d.delinquency_type === filter;
    const matchesSearch =
      !search ||
      d.member.name.toLowerCase().includes(search.toLowerCase()) ||
      `${d.block}-${d.lot}`.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="bg-card rounded-lg border overflow-hidden">
      {/* Filters */}
      <div className="p-4 border-b flex items-center gap-4">
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as any)}
          className="px-3 py-2 border rounded-lg text-sm bg-background"
        >
          <option value="all">All Types</option>
          <option value="automatic">Automatic</option>
          <option value="manual">Manual</option>
        </select>

        <input
          type="text"
          placeholder="Search by name or lot..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-3 py-2 border rounded-lg text-sm bg-background"
        />
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-muted">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                Lot
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                Member
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                Amount Due
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-card divide-y divide-border">
            {loading ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-6 py-12 text-center text-muted-foreground"
                >
                  Loading...
                </td>
              </tr>
            ) : filteredDelinquents.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-6 py-12 text-center text-muted-foreground"
                >
                  {search || filter !== "all"
                    ? "No delinquents match your filters"
                    : "No delinquent members found"}
                </td>
              </tr>
            ) : (
              filteredDelinquents.map((delinquent) => (
                <tr
                  key={delinquent.lot_member_id}
                  className="hover:bg-muted/50"
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-medium text-card-foreground">
                      {delinquent.block}-{delinquent.lot}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {delinquent.lot_size_sqm} sqm
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-card-foreground">
                      {delinquent.member.name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {delinquent.member.email}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={cn(
                        "px-2 py-1 text-xs font-medium rounded-full",
                        delinquent.delinquency_type === "manual"
                          ? "bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400"
                          : "bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400",
                      )}
                    >
                      {delinquent.delinquency_type === "manual"
                        ? "Manual"
                        : "Automatic"}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {delinquent.delinquency_type === "automatic" &&
                    delinquent.days_overdue !== null ? (
                      <div className="flex items-center gap-1 text-sm text-red-600 dark:text-red-400">
                        <Calendar className="w-3 h-3" />
                        {delinquent.days_overdue} days overdue
                      </div>
                    ) : delinquent.marked_at ? (
                      <div className="text-xs text-muted-foreground">
                        {new Date(delinquent.marked_at).toLocaleDateString()}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {delinquent.amount_due > 0 ? (
                      <div className="flex items-center gap-1 text-sm font-medium text-card-foreground">
                        <DollarSign className="w-3 h-3" />
                        {delinquent.amount_due.toLocaleString()}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                    {delinquent.unpaid_periods.length > 0 && (
                      <div className="text-xs text-muted-foreground">
                        {delinquent.unpaid_periods.join(", ")}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <DelinquentActions
                      delinquent={delinquent}
                      onRefresh={onRefresh}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
