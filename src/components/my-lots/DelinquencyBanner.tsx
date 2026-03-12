// src/components/my-lots/DelinquencyBanner.tsx
import { AlertTriangle, CreditCard, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DelinquencyStatus } from "@/types";

interface DelinquencyBannerProps {
  status: DelinquencyStatus;
}

export function DelinquencyBanner({ status }: DelinquencyBannerProps) {
  if (!status.is_delinquent) {
    return null;
  }

  return (
    <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-6">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-6 h-6 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-orange-900 dark:text-orange-100">
            DELINQUENCY NOTICE
          </h3>
          <p className="text-sm text-orange-700 dark:text-orange-300 mt-2">
            Your account is currently delinquent. This means:
          </p>
          <ul className="list-disc list-inside text-sm text-orange-700 dark:text-orange-300 mt-1 space-y-1">
            <li>Voting rights are suspended</li>
            <li>You may not be eligible for certain services</li>
          </ul>

          {status.total_due > 0 && (
            <div className="mt-4 p-3 bg-white dark:bg-orange-900/10 rounded-lg">
              <p className="text-sm font-medium text-orange-900 dark:text-orange-100">
                Total Amount Due: ₱{status.total_due.toLocaleString()}
              </p>
              {status.unpaid_periods.length > 0 && (
                <p className="text-xs text-orange-700 dark:text-orange-300 mt-1">
                  Periods: {status.unpaid_periods.join(", ")}
                </p>
              )}
            </div>
          )}

          <div className="flex gap-3 mt-4">
            <Button
              size="sm"
              onClick={() => (window.location.href = "/payments")}
              className="bg-orange-600 hover:bg-orange-700"
            >
              <CreditCard className="w-4 h-4 mr-2" />
              Pay Now
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => (window.location.href = "/messages?compose=true")}
            >
              <Mail className="w-4 h-4 mr-2" />
              Contact Us
            </Button>
          </div>

          {status.reason && (
            <p className="text-xs text-orange-600 dark:text-orange-400 mt-3">
              Reason: {status.reason}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
