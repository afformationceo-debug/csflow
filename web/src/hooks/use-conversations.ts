"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  ConversationStatus,
  ChannelType,
  ConsultationTag,
} from "@/lib/supabase/types";

// Types
export interface ConversationListItem {
  id: string;
  customer_id: string;
  tenant_id: string;
  status: ConversationStatus;
  priority: string;
  assigned_to: string | null;
  ai_enabled: boolean;
  unread_count: number;
  last_message_at: string | null;
  last_message_preview: string | null;
  created_at: string;
  updated_at: string;
  customer: {
    id: string;
    name: string | null;
    country: string | null;
    language: string | null;
    tags: string[];
    is_vip: boolean;
    profile_image_url: string | null;
  };
  channel_info?: {
    channel_type: ChannelType;
    account_name: string;
  };
  tenant?: {
    id: string;
    name: string;
  };
}

export interface ConversationFilters {
  tenantId?: string;
  status?: ConversationStatus | ConversationStatus[];
  channelType?: ChannelType;
  consultationTag?: ConsultationTag;
  assignedTo?: string;
  search?: string;
}

// 대화 목록 조회 훅
export function useConversations(filters: ConversationFilters = {}) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["conversations", filters],
    queryFn: async () => {
      let query = (supabase.from("conversations") as any)
        .select(`
          *,
          customer:customers(
            id, name, country, language, tags, is_vip, profile_image_url
          ),
          tenant:tenants(id, name)
        `)
        .order("last_message_at", { ascending: false, nullsFirst: false });

      if (filters.tenantId) {
        query = query.eq("tenant_id", filters.tenantId);
      }

      if (filters.status) {
        if (Array.isArray(filters.status)) {
          query = query.in("status", filters.status);
        } else {
          query = query.eq("status", filters.status);
        }
      }

      if (filters.assignedTo) {
        query = query.eq("assigned_to", filters.assignedTo);
      }

      if (filters.search) {
        query = query.or(
          `last_message_preview.ilike.%${filters.search}%`
        );
      }

      const { data, error } = await query;

      if (error) throw error;

      // 상담 태그 필터링 (클라이언트 측)
      let conversations = (data || []) as ConversationListItem[];

      if (filters.consultationTag) {
        conversations = conversations.filter((conv) =>
          conv.customer?.tags?.includes(filters.consultationTag!)
        );
      }

      return conversations;
    },
    refetchInterval: 30000, // 30초마다 자동 새로고침
  });
}

// 실시간 대화 구독 훅
export function useConversationsRealtime(
  tenantId: string | undefined,
  onUpdate: (payload: any) => void
) {
  const supabase = createClient();

  useEffect(() => {
    if (!tenantId) return;

    const channel = (supabase as any)
      .channel(`conversations:${tenantId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "conversations",
          filter: `tenant_id=eq.${tenantId}`,
        },
        (payload: any) => {
          onUpdate(payload);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId, onUpdate, supabase]);
}

// 대화 상태 업데이트 훅
export function useUpdateConversation() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<{
        status: ConversationStatus;
        assigned_to: string | null;
        ai_enabled: boolean;
        unread_count: number;
      }>;
    }) => {
      const { data, error } = await (supabase.from("conversations") as any)
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
  });
}

// 대화 읽음 처리 훅
export function useMarkAsRead() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async (conversationId: string) => {
      const { error } = await (supabase.from("conversations") as any)
        .update({ unread_count: 0 })
        .eq("id", conversationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
  });
}

// 대기 시간 계산 함수
export function calculateWaitTime(lastMessageAt: string | null): string {
  if (!lastMessageAt) return "-";

  const now = new Date();
  const lastMessage = new Date(lastMessageAt);
  const diffMs = now.getTime() - lastMessage.getTime();

  const minutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}일 ${hours % 24}시간`;
  } else if (hours > 0) {
    return `${hours}시간 ${minutes % 60}분`;
  } else if (minutes > 0) {
    return `${minutes}분`;
  } else {
    return "방금";
  }
}

// 대기 시간 업데이트 훅 (1분마다 업데이트)
export function useWaitTimeUpdater() {
  const [, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setTick((t) => t + 1);
    }, 60000); // 1분마다 업데이트

    return () => clearInterval(interval);
  }, []);
}
