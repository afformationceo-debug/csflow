"use client";

import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { usePathname } from "next/navigation";
import { useState } from "react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const pathname = usePathname();
  const isInbox = pathname === "/inbox";

  return (
    <div className="min-h-screen bg-background">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      <div
        className="transition-all duration-200 flex flex-col h-screen"
        style={{ marginLeft: sidebarCollapsed ? 72 : 256 }}
      >
        <Header />
        <main className={isInbox ? "flex-1 overflow-hidden p-3" : "p-6"}>
          {children}
        </main>
      </div>
    </div>
  );
}
