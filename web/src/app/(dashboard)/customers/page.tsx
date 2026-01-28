"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  Search,
  Filter,
  RefreshCw,
  Download,
  UserPlus,
  MessageCircle,
  Calendar,
  Tag,
  MapPin,
  Languages,
  Heart,
  Zap,
  Phone,
  FileText,
  ArrowUpDown,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

// Types
interface CustomerChannel {
  id: string;
  channel_user_id: string;
  channel_username: string | null;
  channel_account: {
    id: string;
    channel_type: string;
    account_name: string;
  };
}

interface Customer {
  id: string;
  name: string;
  country: string | null;
  language: string | null;
  profile_image_url: string | null;
  tags: string[];
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
  customer_channels: CustomerChannel[];
  stats: {
    totalConversations: number;
    totalMessages: number;
    inboundMessages: number;
    outboundMessages: number;
    firstContact: string;
    lastContact: string;
  };
  consultationTag: string | null;
  customerTags: string[];
  typeTags: string[];
  interestedProcedures: string[];
  concerns: string[];
  memo: string;
  bookingStatus: string;
}

// Channel config
const getChannelConfig = (type: string) => {
  const configs: Record<string, { label: string; bg: string; text: string }> = {
    line: { label: "LINE", bg: "bg-green-500/10", text: "text-green-600 dark:text-green-400" },
    whatsapp: { label: "WhatsApp", bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400" },
    facebook: { label: "Messenger", bg: "bg-blue-500/10", text: "text-blue-600 dark:text-blue-400" },
    instagram: { label: "Instagram", bg: "bg-pink-500/10", text: "text-pink-600 dark:text-pink-400" },
    kakao: { label: "카카오톡", bg: "bg-yellow-500/10", text: "text-yellow-600 dark:text-yellow-400" },
    wechat: { label: "WeChat", bg: "bg-teal-500/10", text: "text-teal-600 dark:text-teal-400" },
  };
  return configs[type] || { label: type.toUpperCase(), bg: "bg-muted", text: "text-muted-foreground" };
};

// Consultation tag config
const consultationTagConfig: Record<string, { label: string; color: string }> = {
  prospect: { label: "가망", color: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20" },
  potential: { label: "잠재", color: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
  first_booking: { label: "1차예약", color: "bg-purple-500/10 text-purple-600 border-purple-500/20" },
  confirmed: { label: "확정예약", color: "bg-green-500/10 text-green-600 border-green-500/20" },
  completed: { label: "시술완료", color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
  cancelled: { label: "취소", color: "bg-red-500/10 text-red-600 border-red-500/20" },
};

// Booking status config
const bookingStatusConfig: Record<string, { label: string; color: string }> = {
  none: { label: "미예약", color: "bg-muted/50 text-muted-foreground" },
  pending: { label: "예약대기", color: "bg-yellow-500/10 text-yellow-600" },
  confirmed: { label: "예약확정", color: "bg-green-500/10 text-green-600" },
  completed: { label: "시술완료", color: "bg-emerald-500/10 text-emerald-600" },
  cancelled: { label: "예약취소", color: "bg-red-500/10 text-red-600" },
};

const smoothEase = [0.22, 1, 0.36, 1];

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState<string>("all");
  const [sortField, setSortField] = useState<"name" | "created_at" | "last_contact">("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Fetch customers
  const fetchCustomers = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.append("search", searchQuery);
      if (selectedTag && selectedTag !== "all") params.append("tag", selectedTag);

      const res = await fetch(`/api/customers?${params.toString()}`);
      const data = await res.json();
      setCustomers(data.customers || []);
    } catch (error) {
      console.error("Failed to fetch customers:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, [searchQuery, selectedTag]);

  // Sort customers
  const sortedCustomers = [...customers].sort((a, b) => {
    let aVal: any, bVal: any;
    if (sortField === "name") {
      aVal = a.name || "";
      bVal = b.name || "";
    } else if (sortField === "created_at") {
      aVal = new Date(a.created_at).getTime();
      bVal = new Date(b.created_at).getTime();
    } else if (sortField === "last_contact") {
      aVal = new Date(a.stats.lastContact).getTime();
      bVal = new Date(b.stats.lastContact).getTime();
    }
    if (sortOrder === "asc") return aVal > bVal ? 1 : -1;
    return aVal < bVal ? 1 : -1;
  });

  // Extract all unique tags
  const allTags = Array.from(new Set(customers.flatMap(c => c.tags || [])));

  return (
    <div className="flex-1 space-y-4 p-4 md:p-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: smoothEase }}
        className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              고객 관리
            </h1>
            <p className="text-sm text-muted-foreground">
              {customers.length}명의 고객이 등록되어 있습니다
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchCustomers} disabled={isLoading}>
            <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
            새로고침
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            내보내기
          </Button>
          <Button size="sm" className="bg-gradient-to-r from-blue-600 to-indigo-600">
            <UserPlus className="h-4 w-4 mr-2" />
            고객 추가
          </Button>
        </div>
      </motion.div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1, ease: smoothEase }}
        className="flex flex-col gap-3 md:flex-row"
      >
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="고객 이름, 국가, 관심시술, 고민 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={selectedTag} onValueChange={setSelectedTag}>
          <SelectTrigger className="w-full md:w-48">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="태그 필터" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 태그</SelectItem>
            <Separator className="my-1" />
            {allTags.slice(0, 20).map((tag) => (
              <SelectItem key={tag} value={tag}>
                {tag}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={sortField} onValueChange={(v: any) => setSortField(v)}>
          <SelectTrigger className="w-full md:w-40">
            <ArrowUpDown className="h-4 w-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="created_at">가입일</SelectItem>
            <SelectItem value="last_contact">최근 접촉</SelectItem>
            <SelectItem value="name">이름</SelectItem>
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          size="icon"
          onClick={() => setSortOrder(o => o === "asc" ? "desc" : "asc")}
        >
          <ArrowUpDown className="h-4 w-4" />
        </Button>
      </motion.div>

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2, ease: smoothEase }}
        className="rounded-2xl border bg-card/80 backdrop-blur-sm overflow-hidden card-3d"
      >
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>고객</TableHead>
              <TableHead>위치 / 언어</TableHead>
              <TableHead>채널</TableHead>
              <TableHead>상담 상태</TableHead>
              <TableHead>예약 상태</TableHead>
              <TableHead className="text-center">대화</TableHead>
              <TableHead className="text-center">메시지</TableHead>
              <TableHead>관심시술</TableHead>
              <TableHead>고민</TableHead>
              <TableHead>첫 접촉</TableHead>
              <TableHead>최근 접촉</TableHead>
              <TableHead>메모</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <AnimatePresence mode="popLayout">
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={12} className="h-40 text-center">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">고객 정보를 불러오는 중...</p>
                  </TableCell>
                </TableRow>
              ) : sortedCustomers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={12} className="h-40 text-center">
                    <Users className="h-12 w-12 mx-auto mb-2 text-muted-foreground opacity-20" />
                    <p className="text-sm text-muted-foreground">등록된 고객이 없습니다</p>
                  </TableCell>
                </TableRow>
              ) : (
                sortedCustomers.map((customer, idx) => (
                  <motion.tr
                    key={customer.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.3, delay: idx * 0.02, ease: smoothEase }}
                    className="group hover:bg-muted/30 cursor-pointer"
                  >
                    {/* Customer Name + Avatar */}
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9 border-2 border-background">
                          {customer.profile_image_url && (
                            <AvatarImage src={customer.profile_image_url} alt={customer.name} />
                          )}
                          <AvatarFallback className="bg-gradient-to-br from-blue-500/20 to-indigo-500/20 text-primary text-sm font-medium">
                            {customer.name.slice(0, 1)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{customer.name}</p>
                          <p className="text-xs text-muted-foreground">ID: {customer.id.slice(0, 8)}</p>
                        </div>
                      </div>
                    </TableCell>

                    {/* Location / Language */}
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5 text-xs">
                          <MapPin className="h-3 w-3 text-muted-foreground" />
                          <span>{customer.country || "—"}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Languages className="h-3 w-3" />
                          <span>{customer.language?.toUpperCase() || "—"}</span>
                        </div>
                      </div>
                    </TableCell>

                    {/* Channels */}
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {customer.customer_channels.slice(0, 2).map((ch, i) => {
                          const config = getChannelConfig(ch.channel_account.channel_type);
                          return (
                            <Badge key={i} variant="outline" className={cn("text-[10px] px-1.5 py-0.5", config.bg, config.text)}>
                              {config.label}
                            </Badge>
                          );
                        })}
                        {customer.customer_channels.length > 2 && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0.5">
                            +{customer.customer_channels.length - 2}
                          </Badge>
                        )}
                      </div>
                    </TableCell>

                    {/* Consultation Tag */}
                    <TableCell>
                      {customer.consultationTag && consultationTagConfig[customer.consultationTag] ? (
                        <Badge variant="outline" className={cn("text-xs", consultationTagConfig[customer.consultationTag].color)}>
                          {consultationTagConfig[customer.consultationTag].label}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>

                    {/* Booking Status */}
                    <TableCell>
                      {customer.bookingStatus && bookingStatusConfig[customer.bookingStatus] ? (
                        <Badge className={cn("text-xs", bookingStatusConfig[customer.bookingStatus].color)}>
                          {bookingStatusConfig[customer.bookingStatus].label}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>

                    {/* Conversations */}
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <MessageCircle className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="font-medium">{customer.stats.totalConversations}</span>
                      </div>
                    </TableCell>

                    {/* Messages */}
                    <TableCell className="text-center">
                      <div className="flex flex-col gap-0.5 items-center text-xs">
                        <span className="text-blue-600 dark:text-blue-400">↓{customer.stats.inboundMessages}</span>
                        <span className="text-green-600 dark:text-green-400">↑{customer.stats.outboundMessages}</span>
                      </div>
                    </TableCell>

                    {/* Interested Procedures */}
                    <TableCell>
                      <div className="flex flex-wrap gap-1 max-w-32">
                        {customer.interestedProcedures.slice(0, 2).map((proc, i) => (
                          <Badge key={i} variant="secondary" className="text-[10px] px-1.5 py-0.5 bg-violet-500/10 text-violet-600 border-violet-500/20">
                            {proc}
                          </Badge>
                        ))}
                        {customer.interestedProcedures.length > 2 && (
                          <span className="text-[10px] text-muted-foreground">+{customer.interestedProcedures.length - 2}</span>
                        )}
                        {customer.interestedProcedures.length === 0 && (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </div>
                    </TableCell>

                    {/* Concerns */}
                    <TableCell>
                      <div className="flex flex-wrap gap-1 max-w-28">
                        {customer.concerns.slice(0, 2).map((concern, i) => (
                          <Badge key={i} variant="secondary" className="text-[10px] px-1.5 py-0.5 bg-amber-500/10 text-amber-600 border-amber-500/20">
                            {concern}
                          </Badge>
                        ))}
                        {customer.concerns.length > 2 && (
                          <span className="text-[10px] text-muted-foreground">+{customer.concerns.length - 2}</span>
                        )}
                        {customer.concerns.length === 0 && (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </div>
                    </TableCell>

                    {/* First Contact */}
                    <TableCell>
                      <div className="text-xs text-muted-foreground">
                        {new Date(customer.stats.firstContact).toLocaleDateString("ko-KR", {
                          month: "short",
                          day: "numeric",
                        })}
                      </div>
                    </TableCell>

                    {/* Last Contact */}
                    <TableCell>
                      <div className="text-xs font-medium">
                        {new Date(customer.stats.lastContact).toLocaleDateString("ko-KR", {
                          month: "short",
                          day: "numeric",
                        })}
                      </div>
                    </TableCell>

                    {/* Memo */}
                    <TableCell>
                      <div className="text-xs text-muted-foreground max-w-32 truncate" title={customer.memo}>
                        {customer.memo || "—"}
                      </div>
                    </TableCell>
                  </motion.tr>
                ))
              )}
            </AnimatePresence>
          </TableBody>
        </Table>
      </motion.div>

      {/* Stats Footer */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3, ease: smoothEase }}
        className="grid grid-cols-2 md:grid-cols-4 gap-3"
      >
        <div className="p-3 rounded-xl bg-card/80 backdrop-blur-sm border">
          <p className="text-xs text-muted-foreground mb-1">총 고객 수</p>
          <p className="text-2xl font-bold">{customers.length}</p>
        </div>
        <div className="p-3 rounded-xl bg-card/80 backdrop-blur-sm border">
          <p className="text-xs text-muted-foreground mb-1">총 대화</p>
          <p className="text-2xl font-bold">
            {customers.reduce((sum, c) => sum + c.stats.totalConversations, 0)}
          </p>
        </div>
        <div className="p-3 rounded-xl bg-card/80 backdrop-blur-sm border">
          <p className="text-xs text-muted-foreground mb-1">총 메시지</p>
          <p className="text-2xl font-bold">
            {customers.reduce((sum, c) => sum + c.stats.totalMessages, 0)}
          </p>
        </div>
        <div className="p-3 rounded-xl bg-card/80 backdrop-blur-sm border">
          <p className="text-xs text-muted-foreground mb-1">예약 확정</p>
          <p className="text-2xl font-bold text-green-600">
            {customers.filter(c => c.bookingStatus === "confirmed" || c.bookingStatus === "completed").length}
          </p>
        </div>
      </motion.div>
    </div>
  );
}
