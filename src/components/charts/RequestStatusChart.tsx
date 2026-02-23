import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";

interface RequestData {
  name: string;
  value: number;
  color: string;
}

interface RequestStatusChartProps {
  data?: RequestData[];
  height?: number;
}

// Default mock data for visualization
const defaultData: RequestData[] = [
  { name: "Pending", value: 12, color: "#f59e0b" }, // amber-500
  { name: "In Progress", value: 8, color: "#3b82f6" }, // blue-500
  { name: "Completed", value: 45, color: "#10b981" }, // green-500
  { name: "Rejected", value: 3, color: "#ef4444" }, // red-500
];

export function RequestStatusChart({
  data = defaultData,
  height = 300,
}: RequestStatusChartProps) {
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
        fill="white"
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
              backgroundColor: "white",
              border: "1px solid #e5e7eb",
              borderRadius: "8px",
            }}
          />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
      <p className="text-sm text-gray-500 text-center mt-2">
        Service requests by status
      </p>
    </div>
  );
}
