import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";
import { useEffect, useState } from "react";

interface RequestData {
  name: string;
  value: number;
  color: string;
}

interface RequestStatusChartProps {
  data?: RequestData[];
  height?: number;
}

interface ChartColors {
  tooltipBg: string;
  tooltipBorder: string;
  tooltipText: string;
  labelText: string;
}

// Theme-aware colors for chart elements
const getChartColors = (): ChartColors => {
  const isDark = document.documentElement.classList.contains("dark");
  return {
    tooltipBg: isDark ? "hsl(220 30% 15%)" : "white",
    tooltipBorder: isDark ? "hsl(217 32% 20%)" : "#e5e7eb",
    tooltipText: isDark ? "#f3f4f6" : "#374151",
    labelText: "white",
  };
};

export function RequestStatusChart({
  data,
  height = 300,
}: RequestStatusChartProps) {
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
          No request data available
        </p>
      </div>
    );
  }
  const RADIAN = Math.PI / 180;
  const renderCustomizedLabel = ({
    cx,
    cy,
    midAngle,
    innerRadius,
    outerRadius,
    percent,
  }: any) => {
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text
        x={x}
        y={y}
        fill={colors.labelText}
        textAnchor={x > cx ? "start" : "end"}
        dominantBaseline="central"
        fontSize={12}
        fontWeight="bold"
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={renderCustomizedLabel}
            outerRadius={80}
            fill="#8884d8"
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: colors.tooltipBg,
              border: `1px solid ${colors.tooltipBorder}`,
              borderRadius: "8px",
              color: colors.tooltipText,
            }}
          />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
      <p className="text-sm text-muted-foreground text-center mt-2">
        Service requests by status
      </p>
    </div>
  );
}
