import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Home } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface PopularAmenitiesChartProps {
  data: Array<{ amenity: string; revenue: number; bookings: number }>;
}

const AMENITY_LABELS: Record<string, string> = {
  clubhouse: "Clubhouse",
  pool: "Swimming Pool",
  "basketball-court": "Basketball Court",
  "tennis-court": "Tennis Court",
};

export function PopularAmenitiesChart({ data }: PopularAmenitiesChartProps) {
  const chartData = data
    .map((d) => ({
      name: AMENITY_LABELS[d.amenity] || d.amenity,
      bookings: d.bookings,
      revenue: d.revenue,
    }))
    .sort((a, b) => b.bookings - a.bookings);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Home className="w-5 h-5" />
          Popular Amenities
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis type="number" className="text-xs" />
            <YAxis
              dataKey="name"
              type="category"
              width={120}
              className="text-xs"
            />
            <Tooltip
              formatter={(value: any, name: any, props: any) => [
                value,
                name === "revenue"
                  ? `Revenue: ₱${props.payload?.revenue?.toLocaleString() || 0}`
                  : "Bookings",
              ]}
              labelStyle={{ color: "hsl(var(--background))" }}
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
              }}
            />
            <Bar
              dataKey="bookings"
              fill="hsl(var(--primary))"
              radius={[0, 4, 4, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
