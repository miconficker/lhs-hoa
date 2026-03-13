import { useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Download, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";

interface QRCodeDisplayProps {
  value: string;
  title?: string;
  description?: string;
  size?: number;
  showDownload?: boolean;
  className?: string;
}

export function QRCodeDisplay({
  value,
  title = "Quick Status Check",
  description = "Scan this QR code to check your booking status anytime",
  size = 200,
  showDownload = true,
  className = "",
}: QRCodeDisplayProps) {
  const qrRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    try {
      setDownloading(true);

      // Find the canvas element created by qrcode.react
      const canvas = qrRef.current?.querySelector("canvas");
      if (!canvas) {
        toast.error("Could not generate QR code image");
        return;
      }

      // Convert canvas to blob
      canvas.toBlob((blob) => {
        if (!blob) {
          toast.error("Could not generate QR code image");
          setDownloading(false);
          return;
        }

        // Create download link
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `booking-status-qr-${Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        toast.success("QR code downloaded");
        setDownloading(false);
      }, "image/png");
    } catch (error) {
      console.error("Error downloading QR code:", error);
      toast.error("Failed to download QR code");
      setDownloading(false);
    }
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <QrCode className="w-5 h-5" />
          {title}
        </CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center gap-4">
          {/* QR Code Container */}
          <div
            ref={qrRef}
            className="bg-white p-4 rounded-lg shadow-inner border"
            style={{ width: size + 32, height: size + 32 }}
          >
            <QRCodeSVG
              value={value}
              size={size}
              level="M"
              includeMargin={false}
              fgColor="#000000"
              bgColor="#ffffff"
            />
          </div>

          {/* URL Display */}
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-1">Status URL:</p>
            <p className="text-xs font-mono break-all bg-muted px-2 py-1 rounded">
              {value}
            </p>
          </div>

          {/* Download Button */}
          {showDownload && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownload}
              disabled={downloading}
              className="w-full"
            >
              <Download className="w-4 h-4 mr-2" />
              {downloading ? "Downloading..." : "Download QR Code"}
            </Button>
          )}

          {/* Instructions */}
          <div className="text-xs text-muted-foreground text-center space-y-1">
            <p>• Scan with your phone camera or any QR code reader</p>
            <p>• Bookmark the page for quick access later</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface CompactQRCodeProps {
  value: string;
  size?: number;
  className?: string;
}

/**
 * Compact version for displaying QR code in smaller spaces
 */
export function CompactQRCode({
  value,
  size = 120,
  className = "",
}: CompactQRCodeProps) {
  return (
    <div className={`flex flex-col items-center gap-2 ${className}`}>
      <div
        className="bg-white p-2 rounded shadow-sm border"
        style={{ width: size + 16, height: size + 16 }}
      >
        <QRCodeSVG
          value={value}
          size={size}
          level="M"
          includeMargin={false}
          fgColor="#000000"
          bgColor="#ffffff"
        />
      </div>
      <p className="text-xs text-muted-foreground">Scan to check status</p>
    </div>
  );
}
