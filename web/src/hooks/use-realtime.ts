"use client";

import { useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useConversationStore } from "@/stores/conversation-store";
import { Conversation, Message } from "@/lib/supabase/types";
import { RealtimeChannel } from "@supabase/supabase-js";

/**
 * Hook for real-time conversation updates
 */
export function useRealtimeConversations(tenantId?: string) {
  const { updateConversation, addMessage } = useConversationStore();

  useEffect(() => {
    if (!tenantId) return;

    const supabase = createClient();
    let conversationChannel: RealtimeChannel;
    let messageChannel: RealtimeChannel;

    // Subscribe to conversation changes
    conversationChannel = supabase
      .channel(`conversations:${tenantId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "conversations",
          filter: `tenant_id=eq.${tenantId}`,
        },
        (payload) => {
          if (payload.eventType === "UPDATE" || payload.eventType === "INSERT") {
            updateConversation(payload.new as Conversation);
          }
        }
      )
      .subscribe();

    // Subscribe to message changes
    messageChannel = supabase
      .channel(`messages:${tenantId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        (payload) => {
          addMessage(payload.new as Message);
        }
      )
      .subscribe();

    return () => {
      conversationChannel?.unsubscribe();
      messageChannel?.unsubscribe();
    };
  }, [tenantId, updateConversation, addMessage]);
}

/**
 * Hook for real-time messages in a specific conversation
 */
export function useRealtimeMessages(conversationId: string | null) {
  const { addMessage } = useConversationStore();

  useEffect(() => {
    if (!conversationId) return;

    const supabase = createClient();

    const channel = supabase
      .channel(`conversation_messages:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          addMessage(payload.new as Message);
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [conversationId, addMessage]);
}

/**
 * Hook for real-time escalation updates
 */
export function useRealtimeEscalations(
  onNewEscalation?: (escalation: unknown) => void
) {
  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel("escalations")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "escalations",
        },
        (payload) => {
          onNewEscalation?.(payload.new);
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [onNewEscalation]);
}

/**
 * Hook for presence (who's online)
 */
export function usePresence(userId: string, tenantId: string) {
  useEffect(() => {
    if (!userId || !tenantId) return;

    const supabase = createClient();

    const channel = supabase.channel(`presence:${tenantId}`, {
      config: {
        presence: {
          key: userId,
        },
      },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        console.log("Presence state:", state);
      })
      .on("presence", { event: "join" }, ({ key, newPresences }) => {
        console.log("User joined:", key, newPresences);
      })
      .on("presence", { event: "leave" }, ({ key, leftPresences }) => {
        console.log("User left:", key, leftPresences);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            user_id: userId,
            online_at: new Date().toISOString(),
          });
        }
      });

    return () => {
      channel.unsubscribe();
    };
  }, [userId, tenantId]);
}
