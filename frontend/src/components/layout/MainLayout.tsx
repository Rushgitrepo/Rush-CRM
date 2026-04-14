import { Outlet } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { TopBar } from "./Header";
import { TelephonyOverlay } from "@/components/telephony/TelephonyProvider";
import { SoftphoneProvider } from "@/contexts/SoftphoneContext";
import { useRealtime } from "@/hooks/useRealtime";

export function MainLayout() {
  // Keep app-level socket alive on all protected pages.
  useRealtime();

  return (
    <SoftphoneProvider>
      <div className="min-h-screen bg-background">
        <AppSidebar />
        <div className="pl-64">
          <TopBar />
          <main className="p-6">
            <Outlet />
          </main>
        </div>
        <TelephonyOverlay />
      </div>
    </SoftphoneProvider>
  );
}
