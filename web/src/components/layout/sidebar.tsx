"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  MessageSquare,
  Radio,
  Building2,
  BookOpen,
  Users,
  UserCircle,
  AlertTriangle,
  BarChart3,
  Settings,
  Sparkles,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const navigation = [
  {
    name: "대시보드",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    name: "통합 인박스",
    href: "/inbox",
    icon: MessageSquare,
    badge: 23,
  },
  {
    name: "고객 관리",
    href: "/customers",
    icon: UserCircle,
  },
  {
    name: "채널 관리",
    href: "/channels",
    icon: Radio,
  },
  {
    name: "거래처 관리",
    href: "/tenants",
    icon: Building2,
  },
  {
    name: "지식베이스",
    href: "/knowledge",
    icon: BookOpen,
  },
  {
    name: "담당자 관리",
    href: "/team",
    icon: Users,
  },
  {
    name: "에스컬레이션",
    href: "/escalations",
    icon: AlertTriangle,
    badge: 5,
    urgent: true,
  },
  {
    name: "분석/리포트",
    href: "/analytics",
    icon: BarChart3,
  },
  {
    name: "설정",
    href: "/settings",
    icon: Settings,
  },
];

export function Sidebar({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  const pathname = usePathname();

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 72 : 256 }}
      transition={{ duration: 0.2, ease: "easeInOut" }}
      className="fixed left-0 top-0 z-40 h-screen border-r border-border bg-sidebar"
    >
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex h-16 items-center justify-between px-4 border-b border-border">
          <AnimatePresence mode="wait">
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-2"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                  <Sparkles className="h-5 w-5 text-primary-foreground" />
                </div>
                <span className="font-semibold text-lg gradient-text">
                  CS Command
                </span>
              </motion.div>
            )}
          </AnimatePresence>
          {collapsed && (
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary mx-auto">
              <Sparkles className="h-5 w-5 text-primary-foreground" />
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3">
          <ul className="space-y-1">
            {navigation.map((item) => {
              const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
              return (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                      "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                      isActive
                        ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                        : "text-sidebar-foreground/70"
                    )}
                  >
                    <item.icon
                      className={cn(
                        "h-5 w-5 flex-shrink-0 transition-colors",
                        isActive ? "text-primary" : ""
                      )}
                    />
                    <AnimatePresence mode="wait">
                      {!collapsed && (
                        <motion.span
                          initial={{ opacity: 0, width: 0 }}
                          animate={{ opacity: 1, width: "auto" }}
                          exit={{ opacity: 0, width: 0 }}
                          className="flex-1 truncate"
                        >
                          {item.name}
                        </motion.span>
                      )}
                    </AnimatePresence>
                    {!collapsed && item.badge && (
                      <span
                        className={cn(
                          "flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-medium",
                          item.urgent
                            ? "bg-destructive text-destructive-foreground status-urgent-pulse"
                            : "bg-primary/10 text-primary"
                        )}
                      >
                        {item.badge}
                      </span>
                    )}
                    {collapsed && item.badge && (
                      <span
                        className={cn(
                          "absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full text-[10px] font-medium",
                          item.urgent
                            ? "bg-destructive text-destructive-foreground"
                            : "bg-primary text-primary-foreground"
                        )}
                      >
                        {item.badge > 9 ? "9+" : item.badge}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Collapse Toggle */}
        <div className="border-t border-border p-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggle}
            className="w-full justify-center"
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <>
                <ChevronLeft className="h-4 w-4 mr-2" />
                <span>접기</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </motion.aside>
  );
}
