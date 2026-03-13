import {
  Bar,
  BarChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";
import { useEffect, useState } from "react";

interface PaymentData {
  month: string;
  paid: number;
  pending: number;
  failed: number;
}

interface PaymentChartProps {
  data?: PaymentData[];
  height?: number;
}

interface ChartColors {
  paid: string;
  pending: string;
  failed: string;
  axis: string;
  tooltipBg: string;
  tooltipBorder: string;
  tooltipText: string;
}

// Theme-aware colors using CSS variables
const getChartColors = (): ChartColors => {
  const isDark = document.documentElement.classList.contains("dark");
  return {
    paid: isDark ? "hsl(142 80% 60%)" : "#10b981",
    pending: isDark ? "hsl(48 90% 60%)" : "#f59e0b",
    failed: isDark ? "hsl(0 80% 60%)" : "#ef4444",
    axis: isDark ? "#9ca3af" : "#6b7280",
    tooltipBg: isDark ? "hsl(220 30% 15%)" : "white",
    tooltipBorder: isDark ? "hsl(217 32% 20%)" : "#e5e7eb",
    tooltipText: isDark ? "#f3f4f6" : "#374151",
  };
};

export function PaymentChart({ data, height = 300 }: PaymentChartProps) {
  const [colors, setColors] = useState<ChartColors>(getChartColors);

  // Update colors when theme changes
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setColors(getChartColors());
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);

  // Don't show chart if no data available
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full min-h-[200px]">
        <p className="text-sm text-muted-foreground">
          No payment data available
        </p>
      </div>
    );
  }
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={data}
          margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
        >
          <XAxis
            dataKey="month"
            stroke={colors.axis}
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            stroke={colors.axis}
            fontSize={12}
            tickLine={false}
            axisLine={false}
            tickFormatter={formatCurrency}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: colors.tooltipBg,
              border: `1px solid ${colors.tooltipBorder}`,
              borderRadius: "8px",
              color: colors.tooltipText,
            }}
            formatter={(value) => [
              formatCurrency(
                typeof value === "number"
                  ? value
                  : parseFloat(String(value ?? 0)),
              ),
              "",
            ]}
            labelStyle={{ color: colors.tooltipText }}
          />
          <Legend />
          <Bar
            dataKey="paid"
            name="Paid"
            fill={colors.paid}
            radius={[4, 4, 0, 0]}
          />
          <Bar
            dataKey="pending"
            name="Pending"
            fill={colors.pending}
            radius={[4, 4, 0, 0]}
          />
          <Bar
            dataKey="failed"
            name="Failed"
            fill={colors.failed}
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
      <p className="text-sm text-muted-foreground text-center mt-2">
        Monthly payment collection summary (last 6 months)
      </p>
    </div>
  );
}
