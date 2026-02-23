import {
  Bar,
  BarChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Cell,
} from "recharts";

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

const COLORS = {
  paid: "#10b981", // green-500
  pending: "#f59e0b", // amber-500
  failed: "#ef4444", // red-500
};

// Default mock data for visualization
const defaultData: PaymentData[] = [
  { month: "Jan", paid: 45000, pending: 5000, failed: 500 },
  { month: "Feb", paid: 52000, pending: 3000, failed: 200 },
  { month: "Mar", paid: 48000, pending: 8000, failed: 1000 },
  { month: "Apr", paid: 55000, pending: 2000, failed: 300 },
  { month: "May", paid: 60000, pending: 4000, failed: 500 },
  { month: "Jun", paid: 58000, pending: 6000, failed: 700 },
];

export function PaymentChart({
  data = defaultData,
  height = 300,
}: PaymentChartProps) {
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
            stroke="#6b7280"
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            stroke="#6b7280"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            tickFormatter={formatCurrency}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "white",
              border: "1px solid #e5e7eb",
              borderRadius: "8px",
            }}
            formatter={(value: number) => [formatCurrency(value), ""]}
            labelStyle={{ color: "#374151" }}
          />
          <Legend />
          <Bar
            dataKey="paid"
            name="Paid"
            fill={COLORS.paid}
            radius={[4, 4, 0, 0]}
          />
          <Bar
            dataKey="pending"
            name="Pending"
            fill={COLORS.pending}
            radius={[4, 4, 0, 0]}
          />
          <Bar
            dataKey="failed"
            name="Failed"
            fill={COLORS.failed}
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
      <p className="text-sm text-gray-500 text-center mt-2">
        Monthly payment collection summary (last 6 months)
      </p>
    </div>
  );
}
