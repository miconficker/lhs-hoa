import type { Payment } from "@/types";

export interface ExportFilters {
  start_date?: string;
  end_date?: string;
  payment_type?: string;
  status?: string;
  method?: string;
}

// Helper function to convert payments to CSV format
export function paymentsToCSV(payments: Payment[]): string {
  if (payments.length === 0) {
    return "";
  }

  // Define CSV headers
  const headers = [
    "Payment ID",
    "Household ID",
    "Amount",
    "Currency",
    "Method",
    "Status",
    "Reference Number",
    "Period",
    "Payment Type",
    "Late Fee Amount",
    "Late Fee Months",
    "Received By",
    "Created At",
    "Paid At",
  ];

  // Convert payment data to CSV rows
  const rows = payments.map((p) => [
    p.id,
    p.household_id,
    p.amount.toFixed(2),
    p.currency,
    p.method,
    p.status,
    p.reference_number || "",
    p.period,
    p.payment_category || "",
    p.late_fee_amount?.toFixed(2) || "0",
    p.late_fee_months?.toString() || "0",
    p.received_by || "",
    p.created_at,
    p.paid_at || "",
  ]);

  // Combine headers and rows
  const csvContent = [headers, ...rows]
    .map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","),
    )
    .join("\n");

  return csvContent;
}

// Helper function to trigger CSV download
export function downloadCSV(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Helper function to generate filename with timestamp
export function generateExportFilename(prefix: string): string {
  const date = new Date();
  const dateStr = date.toISOString().split("T")[0]; // YYYY-MM-DD format
  const timeParts = date.toTimeString().split(":");
  const timeStr = `${timeParts[0]}-${timeParts[1]}`; // HH-MM format
  return `${prefix}_${dateStr}_${timeStr}.csv`;
}
