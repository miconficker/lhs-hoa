import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Trees, Building2, Droplets } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { logger } from "@/lib/logger";

interface CommunityLot {
  lot_id: string;
  block?: string;
  lot?: string;
  lot_type: string;
  lot_label?: string;
  lot_description?: string;
  address: string;
}

export function CommonAreasPage() {
  const { user } = useAuth();
  const [lots, setLots] = useState<CommunityLot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCommonLots();
  }, []);

  async function loadCommonLots() {
    setLoading(true);
    try {
      const result = await api.admin.getLotsWithOwnership();
      if (result.data?.lots) {
        // Filter to only community/utility/open_space
        const commonLots = result.data.lots.filter(
          (lot) =>
            lot.lot_type === "community" ||
            lot.lot_type === "utility" ||
            lot.lot_type === "open_space",
        );
        setLots(commonLots as CommunityLot[]);
      }
    } catch (error) {
      logger.error("Error loading common lots", error, {
        component: "CommonAreasPage",
      });
    }
    setLoading(false);
  }

  if (user?.role !== "admin") {
    return (
      <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 p-4 rounded-lg">
        Access denied. Admin privileges required.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  const getLotIcon = (lotType: string) => {
    switch (lotType) {
      case "community":
        return <Trees className="w-5 h-5 text-green-600" />;
      case "utility":
        return <Building2 className="w-5 h-5 text-muted-foreground" />;
      case "open_space":
        return <Droplets className="w-5 h-5 text-blue-600" />;
      default:
        return <Trees className="w-5 h-5 text-muted-foreground" />;
    }
  };

  const getLotTypeBadge = (lotType: string) => {
    switch (lotType) {
      case "community":
        return "bg-green-100 text-green-700";
      case "utility":
        return "bg-gray-100 text-gray-700";
      case "open_space":
        return "bg-blue-100 text-blue-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-card-foreground">
            Common Areas
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage HOA-owned community areas, utilities, and open spaces
          </p>
        </div>
        <div className="text-sm text-muted-foreground">
          {lots.length} common area(s)
        </div>
      </div>

      <div className="bg-card rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-muted">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                  Location
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                  Label
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                  Description
                </th>
              </tr>
            </thead>
            <tbody className="bg-card divide-y divide-border">
              {lots.map((lot) => (
                <tr key={lot.lot_id}>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      {getLotIcon(lot.lot_type)}
                      <div>
                        <div className="text-sm font-medium text-card-foreground">
                          {lot.address}
                        </div>
                        {lot.block && lot.lot && (
                          <div className="text-xs text-muted-foreground">
                            Block {lot.block}, Lot {lot.lot}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded-full ${getLotTypeBadge(
                        lot.lot_type,
                      )}`}
                    >
                      {lot.lot_type.charAt(0).toUpperCase() +
                        lot.lot_type.slice(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-muted-foreground">
                    {lot.lot_label || (
                      <span className="text-muted-foreground italic">
                        Not labeled
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-muted-foreground">
                    {lot.lot_description || (
                      <span className="text-muted-foreground italic">
                        No description
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {lots.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center">
                      <Trees className="w-12 h-12 text-muted-foreground mb-3" />
                      <p className="text-sm text-muted-foreground">
                        No common areas found
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Community, utility, and open space lots will appear here
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Info Card */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <div className="flex items-start gap-3">
          <Trees className="w-6 h-6 text-blue-600 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-blue-900">
              About Common Areas
            </h3>
            <p className="text-sm text-blue-700 mt-1">
              Common areas are HOA-owned properties such as parks, utilities,
              and open spaces. These lots don't pay dues and don't have voting
              rights. Use the Lot Management page to assign labels and
              descriptions to these areas.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
