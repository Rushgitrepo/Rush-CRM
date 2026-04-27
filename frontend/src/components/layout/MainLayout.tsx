import { useState, useEffect } from "react";
import { Outlet } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { TopBar } from "./Header";
import { TelephonyOverlay } from "@/components/telephony/TelephonyProvider";
import { SoftphoneProvider } from "@/contexts/SoftphoneContext";
import { VideoCallProvider } from "@/contexts/VideoCallContext";
import VideoCallOverlay from "@/components/collaboration/VideoCallOverlay";
import { useRealtime } from "@/hooks/useRealtime";

export function MainLayout() {
  // Keep app-level socket alive on all protected pages.
  useRealtime();

  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem('sidebar-width');
    return saved ? parseInt(saved, 10) : 256;
  });

  const handleSidebarWidthChange = (width: number) => {
    setSidebarWidth(width);
    localStorage.setItem('sidebar-width', width.toString());
  };

  return (
    <SoftphoneProvider>
      <VideoCallProvider>
        <div className="min-h-screen bg-background">
          <AppSidebar width={sidebarWidth} onWidthChange={handleSidebarWidthChange} />
          <div style={{ paddingLeft: `${sidebarWidth}px` }}>
            <TopBar />
            <main className="p-6">
              <Outlet />
            </main>
          </div>
          <TelephonyOverlay />
          <VideoCallOverlay />
        </div>
      </VideoCallProvider>
    </SoftphoneProvider>
  );
}

