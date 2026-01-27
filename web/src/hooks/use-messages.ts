"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { MessageDirection, MessageContentType } from "@/lib/supabase/types";

// Types
export interface MessageItem {
  id: string;
  conversation_id: string;
  customer_channel_id: string | null;
  direction: MessageDirection;
  sender_type: "customer" | "agent" | "ai" | "system";
  content_type: MessageContentType;
  content: string;
  media_url: string | null;
  original_language: string | null;
  translated_content: string | null;
  translated_language: string | null;
  status: string;
  ai_confidence: number | null;
  ai_model: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface InternalNoteItem {
  id: string;
  conversation_id: string;
  author_id: string;
  content: string;
  mentioned_users: string[];
  created_at: string;
  author?: {
    id: string;
    name: string;
    avatar_url: string | null;
  };
}

// 통합 메시지 타입 (메시지 + 내부 노트)
export interface UnifiedMessageItem {
  id: string;
  type: "message" | "internal_note";
  content: string;
  translatedContent?: string | null;
  senderType: "customer" | "agent" | "ai" | "system" | "internal_note";
  createdAt: string;
  aiConfidence?: number | null;
  aiModel?: string | null;
  originalLanguage?: string | null;
  author?: string;
  mentions?: string[];
  sources?: string[];
}

// 메시지 목록 조회 훅
export function useMessages(conversationId: string | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["messages", conversationId],
    queryFn: async () => {
      if (!conversationId) return [];

      const { data, error } = await (supabase.from("messages") as any)
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return (data || []) as MessageItem[];
    },
    enabled: !!conversationId,
  });
}

// 내부 노트 목록 조회 훅
export function useInternalNotes(conversationId: string | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["internal_notes", conversationId],
    queryFn: async () => {
      if (!conversationId) return [];

      const { data, error } = await (supabase.from("internal_notes") as any)
        .select(`
          *,
          author:users!author_id(id, name, avatar_url)
        `)
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return (data || []) as InternalNoteItem[];
    },
    enabled: !!conversationId,
  });
}

// 통합 메시지 (메시지 + 내부 노트) 훅
export function useUnifiedMessages(conversationId: string | undefined) {
  const { data: messages, isLoading: messagesLoading } = useMessages(conversationId);
  const { data: internalNotes, isLoading: notesLoading } = useInternalNotes(conversationId);

  const unifiedMessages: UnifiedMessageItem[] = [];

  // 메시지 변환
  if (messages) {
    messages.forEach((msg) => {
      unifiedMessages.push({
        id: msg.id,
        type: "message",
        content: msg.content,
        translatedContent: msg.translated_content,
        senderType: msg.sender_type,
        createdAt: msg.created_at,
        aiConfidence: msg.ai_confidence,
        aiModel: msg.ai_model,
        originalLanguage: msg.original_language,
      });
    });
  }

  // 내부 노트 변환
  if (internalNotes) {
    internalNotes.forEach((note) => {
      unifiedMessages.push({
        id: note.id,
        type: "internal_note",
        content: note.content,
        senderType: "internal_note",
        createdAt: note.created_at,
        author: note.author?.name || "알 수 없음",
        mentions: note.mentioned_users,
      });
    });
  }

  // 시간순 정렬
  unifiedMessages.sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  return {
    data: unifiedMessages,
    isLoading: messagesLoading || notesLoading,
  };
}

// 실시간 메시지 구독 훅
export function useMessagesRealtime(
  conversationId: string | undefined,
  onNewMessage: (message: MessageItem) => void
) {
  const supabase = createClient();

  useEffect(() => {
    if (!conversationId) return;

    const channel = (supabase as any)
      .channel(`messages:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload: any) => {
          onNewMessage(payload.new as MessageItem);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, onNewMessage, supabase]);
}

// 메시지 전송 훅
export function useSendMessage() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async ({
      conversationId,
      content,
      senderType = "agent",
      translatedContent,
      translatedLanguage,
    }: {
      conversationId: string;
      content: string;
      senderType?: "agent" | "ai" | "system";
      translatedContent?: string;
      translatedLanguage?: string;
    }) => {
      const { data, error } = await (supabase.from("messages") as any)
        .insert({
          conversation_id: conversationId,
          direction: "outbound",
          sender_type: senderType,
          content_type: "text",
          content,
          translated_content: translatedContent,
          translated_language: translatedLanguage,
          status: "sent",
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["messages", variables.conversationId],
      });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
  });
}

// 내부 노트 작성 훅
export function useCreateInternalNote() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async ({
      conversationId,
      authorId,
      content,
      mentionedUsers = [],
    }: {
      conversationId: string;
      authorId: string;
      content: string;
      mentionedUsers?: string[];
    }) => {
      const { data, error } = await (supabase.from("internal_notes") as any)
        .insert({
          conversation_id: conversationId,
          author_id: authorId,
          content,
          mentioned_users: mentionedUsers,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["internal_notes", variables.conversationId],
      });
    },
  });
}

// 시간 포맷 함수
export function formatMessageTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffDays = Math.floor(
    (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffDays === 0) {
    return date.toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } else if (diffDays === 1) {
    return "어제";
  } else if (diffDays < 7) {
    return `${diffDays}일 전`;
  } else {
    return date.toLocaleDateString("ko-KR", {
      month: "short",
      day: "numeric",
    });
  }
}
