import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface CustomerTypeChartProps {
  data: Array<{
    type: "resident" | "external";
    count: number;
    revenue: number;
    percentage: number;
  }>;
}

const COLORS = {
  resident: "hsl(142, 76%, 36%)",
  external: "hsl(199, 89%, 48%)",
};

export function CustomerTypeChart({ data }: CustomerTypeChartProps) {
  const chartData = data.map((d) => ({
    name: d.type === "resident" ? "Residents" : "External Guests",
    value: d.count,
    revenue: d.revenue,
    percentage: d.percentage,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="w-5 h-5" />
          Customer Type Breakdown
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percentage }: any) => `${name}: ${percentage}%`}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
            >
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={
                    entry.name.includes("Resident")
                      ? COLORS.resident
                      : COLORS.external
                  }
                />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: any, name: any, props: any) => [
                `${value} bookings`,
                props.payload.revenue
                  ? `Revenue: ₱${props.payload.revenue.toLocaleString()}`
                  : name,
              ]}
              labelStyle={{ color: "hsl(var(--background))" }}
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
