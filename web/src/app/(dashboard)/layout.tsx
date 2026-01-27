"use client";

import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { useState } from "react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div
        className="transition-all duration-200"
        style={{ marginLeft: sidebarCollapsed ? 72 : 256 }}
      >
        <Header />
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
