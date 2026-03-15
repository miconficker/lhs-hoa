import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface PopularSlotsChartProps {
  data: Array<{ slot: string; count: number; percentage: number }>;
}

const SLOT_LABELS: Record<string, string> = {
  AM: "Morning",
  PM: "Afternoon",
  FULL_DAY: "Full Day",
};

export function PopularSlotsChart({ data }: PopularSlotsChartProps) {
  const chartData = data.map((d) => ({
    name: SLOT_LABELS[d.slot] || d.slot,
    count: d.count,
    percentage: d.percentage,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="w-5 h-5" />
          Popular Time Slots
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
              width={100}
              className="text-xs"
            />
            <Tooltip
              formatter={(value: any, name: any) => [
                value,
                name === "count" ? "Bookings" : name,
              ]}
              labelStyle={{ color: "hsl(var(--background))" }}
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
              }}
            />
            <Bar
              dataKey="count"
              fill="hsl(var(--primary))"
              radius={[0, 4, 4, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
