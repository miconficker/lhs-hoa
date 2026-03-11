import { Outlet } from "react-router-dom";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { BottomNav } from "./BottomNav";
import { useAuth } from "@/hooks/useAuth";

export function MainLayout() {
  const { initialized } = useAuth();

  if (!initialized) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main
        id="main-content"
        className="flex-1 p-4 sm:p-6 lg:p-8 pb-20 lg:pb-8"
      >
        <Outlet />
      </main>
      <Footer />
      <BottomNav />
    </div>
  );
}
