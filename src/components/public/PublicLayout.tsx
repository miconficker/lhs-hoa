import { ReactNode } from "react";
import { PublicPageHeader, PublicPageHeaderProps } from "./PublicPageHeader";

interface PublicLayoutProps extends PublicPageHeaderProps {
  children: ReactNode;
  fullWidth?: boolean;
  containerClassName?: string;
}

export function PublicLayout({
  title,
  showBackButton = false,
  backTo = "/",
  children,
  fullWidth = false,
  containerClassName = "",
}: PublicLayoutProps) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <PublicPageHeader
        title={title}
        showBackButton={showBackButton}
        backTo={backTo}
      />
      <main className={fullWidth ? "flex-1" : "flex-1 container mx-auto px-4"}>
        <div className={containerClassName}>{children}</div>
      </main>
    </div>
  );
}
