"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Bell, Moon, Search, Sun, User, X, MessageSquare, Users, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useTheme } from "next-themes";
import { Badge } from "@/components/ui/badge";
import { useRouter, usePathname } from "next/navigation";

interface SearchResult {
  type: "conversation" | "customer" | "tenant";
  id: string;
  title: string;
  subtitle: string;
}

export function Header() {
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Close results on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Keyboard shortcut ⌘K
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        const input = searchRef.current?.querySelector("input");
        input?.focus();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const performSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    try {
      const res = await fetch(`/api/conversations?search=${encodeURIComponent(query)}`);
      const data = await res.json();
      const conversations = data.conversations || [];

      const results: SearchResult[] = [];
      const seenCustomers = new Set<string>();
      const seenTenants = new Set<string>();

      for (const conv of conversations) {
        const customer = conv.customer;
        const tenant = customer?.customer_channels?.[0]?.channel_account?.tenant;

        // Add conversation result
        results.push({
          type: "conversation",
          id: conv.id,
          title: customer?.name || "Unknown",
          subtitle: conv.last_message_preview?.slice(0, 50) || "대화",
        });

        // Add customer result (deduplicate)
        if (customer?.id && !seenCustomers.has(customer.id)) {
          seenCustomers.add(customer.id);
          const customerName = customer.name || "Unknown";
          if (customerName.toLowerCase().includes(query.toLowerCase())) {
            results.push({
              type: "customer",
              id: customer.id,
              title: customerName,
              subtitle: `${customer.country || ""} · ${customer.language || ""}`.trim(),
            });
          }
        }

        // Add tenant result (deduplicate)
        if (tenant?.id && !seenTenants.has(tenant.id)) {
          seenTenants.add(tenant.id);
          const tenantName = tenant.display_name || tenant.name || "";
          if (tenantName.toLowerCase().includes(query.toLowerCase())) {
            results.push({
              type: "tenant",
              id: tenant.id,
              title: tenantName,
              subtitle: tenant.specialty || "거래처",
            });
          }
        }
      }

      setSearchResults(results.slice(0, 10));
    } catch (err) {
      console.error("Search failed:", err);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setShowResults(true);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => performSearch(value), 300);
  };

  const handleResultClick = (result: SearchResult) => {
    setShowResults(false);
    setSearchQuery("");
    // Navigate to inbox for conversation/customer results, tenants page for tenant
    if (result.type === "tenant") {
      router.push("/tenants");
    } else {
      // For conversations and customers, navigate to inbox
      if (pathname !== "/inbox") {
        router.push("/inbox");
      }
      // Dispatch a custom event so inbox can select the conversation
      window.dispatchEvent(new CustomEvent("select-conversation", { detail: { id: result.id, type: result.type } }));
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "conversation": return <MessageSquare className="h-3.5 w-3.5 text-blue-500" />;
      case "customer": return <Users className="h-3.5 w-3.5 text-green-500" />;
      case "tenant": return <Building2 className="h-3.5 w-3.5 text-violet-500" />;
      default: return <Search className="h-3.5 w-3.5" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "conversation": return "대화";
      case "customer": return "고객";
      case "tenant": return "거래처";
      default: return "";
    }
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/80 backdrop-blur-sm px-6">
      {/* Search */}
      <div className="flex items-center gap-4 flex-1 max-w-xl" ref={searchRef}>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="대화, 고객, 거래처 검색... (⌘K)"
            className="pl-9 pr-8 bg-muted/50 border-0 focus-visible:ring-1"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            onFocus={() => searchQuery.trim() && setShowResults(true)}
          />
          {searchQuery && (
            <button
              onClick={() => { setSearchQuery(""); setSearchResults([]); setShowResults(false); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}

          {/* Search Results Dropdown */}
          {showResults && (searchQuery.trim() || searchResults.length > 0) && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg z-50 overflow-hidden">
              {isSearching ? (
                <div className="p-4 text-center text-xs text-muted-foreground">
                  검색 중...
                </div>
              ) : searchResults.length === 0 ? (
                <div className="p-4 text-center text-xs text-muted-foreground">
                  {searchQuery.trim() ? "검색 결과가 없습니다" : "검색어를 입력하세요"}
                </div>
              ) : (
                <div className="max-h-80 overflow-y-auto py-1">
                  {searchResults.map((result, idx) => (
                    <button
                      key={`${result.type}-${result.id}-${idx}`}
                      onClick={() => handleResultClick(result)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50 text-left transition-colors"
                    >
                      {getTypeIcon(result.type)}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{result.title}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{result.subtitle}</p>
                      </div>
                      <Badge variant="secondary" className="text-[9px] h-4 rounded-md shrink-0">
                        {getTypeLabel(result.type)}
                      </Badge>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right Side */}
      <div className="flex items-center gap-2">
        {/* Theme Toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="h-9 w-9"
        >
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">테마 변경</span>
        </Button>

        {/* Notifications */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9 relative">
              <Bell className="h-4 w-4" />
              <Badge
                variant="destructive"
                className="absolute -right-1 -top-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-[10px]"
              >
                12
              </Badge>
              <span className="sr-only">알림</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel className="flex items-center justify-between">
              <span>알림</span>
              <Button variant="ghost" size="sm" className="h-auto p-0 text-xs text-primary">
                모두 읽음
              </Button>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <div className="max-h-80 overflow-y-auto">
              <DropdownMenuItem className="flex flex-col items-start gap-1 p-3 cursor-pointer">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-destructive" />
                  <span className="font-medium text-sm">새 에스컬레이션</span>
                </div>
                <p className="text-xs text-muted-foreground pl-4">
                  힐링안과 LINE에서 긴급 문의가 접수되었습니다
                </p>
                <span className="text-xs text-muted-foreground pl-4">2분 전</span>
              </DropdownMenuItem>
              <DropdownMenuItem className="flex flex-col items-start gap-1 p-3 cursor-pointer">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-primary" />
                  <span className="font-medium text-sm">AI 학습 완료</span>
                </div>
                <p className="text-xs text-muted-foreground pl-4">
                  스마일치과 지식베이스가 업데이트되었습니다
                </p>
                <span className="text-xs text-muted-foreground pl-4">15분 전</span>
              </DropdownMenuItem>
              <DropdownMenuItem className="flex flex-col items-start gap-1 p-3 cursor-pointer">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-green-500" />
                  <span className="font-medium text-sm">예약 확정</span>
                </div>
                <p className="text-xs text-muted-foreground pl-4">
                  김환자님 예약이 CRM에 등록되었습니다
                </p>
                <span className="text-xs text-muted-foreground pl-4">1시간 전</span>
              </DropdownMenuItem>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="justify-center text-primary">
              모든 알림 보기
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-9 gap-2 px-2">
              <Avatar className="h-7 w-7">
                <AvatarImage src="/avatars/admin.png" alt="Admin" />
                <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                  AD
                </AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium hidden sm:inline-block">관리자</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col">
                <span>관리자</span>
                <span className="text-xs font-normal text-muted-foreground">
                  admin@company.com
                </span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <User className="mr-2 h-4 w-4" />
              프로필 설정
            </DropdownMenuItem>
            <DropdownMenuItem>
              팀 관리
            </DropdownMenuItem>
            <DropdownMenuItem>
              청구 및 요금제
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive">
              로그아웃
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
