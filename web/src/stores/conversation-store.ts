import { create } from "zustand";
import { Conversation, Message, Customer } from "@/lib/supabase/types";
import { conversationService, ConversationWithDetails } from "@/services/conversations";
import { messageService, MessageWithChannel } from "@/services/messages";
import { customerService, CustomerWithChannels } from "@/services/customers";

interface ConversationState {
  // List state
  conversations: ConversationWithDetails[];
  isLoadingList: boolean;
  listError: string | null;

  // Selected conversation state
  selectedConversationId: string | null;
  selectedConversation: ConversationWithDetails | null;
  isLoadingConversation: boolean;

  // Messages state
  messages: MessageWithChannel[];
  isLoadingMessages: boolean;
  isSendingMessage: boolean;

  // Customer state
  selectedCustomer: CustomerWithChannels | null;
  isLoadingCustomer: boolean;

  // Filters
  filters: {
    status?: string;
    channelType?: string;
    search?: string;
  };

  // Actions
  fetchConversations: (tenantId?: string) => Promise<void>;
  selectConversation: (conversationId: string) => Promise<void>;
  clearSelection: () => void;
  sendMessage: (content: string) => Promise<void>;
  markAsRead: () => Promise<void>;
  resolveConversation: () => Promise<void>;
  setFilters: (filters: ConversationState["filters"]) => void;

  // Real-time updates
  addMessage: (message: Message) => void;
  updateConversation: (conversation: Conversation) => void;
}

export const useConversationStore = create<ConversationState>((set, get) => ({
  // Initial state
  conversations: [],
  isLoadingList: false,
  listError: null,
  selectedConversationId: null,
  selectedConversation: null,
  isLoadingConversation: false,
  messages: [],
  isLoadingMessages: false,
  isSendingMessage: false,
  selectedCustomer: null,
  isLoadingCustomer: false,
  filters: {},

  // Fetch conversations list
  fetchConversations: async (tenantId) => {
    set({ isLoadingList: true, listError: null });

    try {
      const { filters } = get();
      const conversations = await conversationService.getConversations({
        tenantId,
        status: filters.status as "active" | "waiting" | "resolved" | "escalated" | undefined,
        search: filters.search,
        limit: 50,
      });

      set({ conversations, isLoadingList: false });
    } catch (error) {
      set({
        listError: error instanceof Error ? error.message : "Failed to load conversations",
        isLoadingList: false,
      });
    }
  },

  // Select a conversation and load its details
  selectConversation: async (conversationId) => {
    set({
      selectedConversationId: conversationId,
      isLoadingConversation: true,
      isLoadingMessages: true,
      isLoadingCustomer: true,
    });

    try {
      // Load conversation, messages, and customer in parallel
      const [conversation, messages] = await Promise.all([
        conversationService.getConversation(conversationId),
        messageService.getMessages({ conversationId, limit: 50 }),
      ]);

      set({
        selectedConversation: conversation,
        messages,
        isLoadingConversation: false,
        isLoadingMessages: false,
      });

      // Load customer details
      if (conversation?.customer?.id) {
        const customer = await customerService.getCustomer(conversation.customer.id);
        set({ selectedCustomer: customer, isLoadingCustomer: false });
      } else {
        set({ selectedCustomer: null, isLoadingCustomer: false });
      }

      // Mark as read
      await conversationService.markAsRead(conversationId);
    } catch (error) {
      console.error("Failed to load conversation:", error);
      set({
        isLoadingConversation: false,
        isLoadingMessages: false,
        isLoadingCustomer: false,
      });
    }
  },

  // Clear selection
  clearSelection: () => {
    set({
      selectedConversationId: null,
      selectedConversation: null,
      messages: [],
      selectedCustomer: null,
    });
  },

  // Send message
  sendMessage: async (content) => {
    const { selectedConversationId } = get();
    if (!selectedConversationId) return;

    set({ isSendingMessage: true });

    try {
      const message = await messageService.sendMessage({
        conversationId: selectedConversationId,
        content,
      });

      // Optimistically add message to list
      set((state) => ({
        messages: [...state.messages, message as MessageWithChannel],
        isSendingMessage: false,
      }));
    } catch (error) {
      console.error("Failed to send message:", error);
      set({ isSendingMessage: false });
    }
  },

  // Mark conversation as read
  markAsRead: async () => {
    const { selectedConversationId } = get();
    if (!selectedConversationId) return;

    try {
      await conversationService.markAsRead(selectedConversationId);

      // Update local state
      set((state) => ({
        conversations: state.conversations.map((c) =>
          c.id === selectedConversationId ? { ...c, unread_count: 0 } : c
        ),
        selectedConversation: state.selectedConversation
          ? { ...state.selectedConversation, unread_count: 0 }
          : null,
      }));
    } catch (error) {
      console.error("Failed to mark as read:", error);
    }
  },

  // Resolve conversation
  resolveConversation: async () => {
    const { selectedConversationId } = get();
    if (!selectedConversationId) return;

    try {
      await conversationService.resolveConversation(selectedConversationId);

      // Update local state
      set((state) => ({
        conversations: state.conversations.map((c) =>
          c.id === selectedConversationId ? { ...c, status: "resolved" } : c
        ),
        selectedConversation: state.selectedConversation
          ? { ...state.selectedConversation, status: "resolved" }
          : null,
      }));
    } catch (error) {
      console.error("Failed to resolve conversation:", error);
    }
  },

  // Set filters
  setFilters: (filters) => {
    set({ filters });
    // Refetch with new filters
    get().fetchConversations();
  },

  // Real-time: Add new message
  addMessage: (message) => {
    const { selectedConversationId } = get();

    if (message.conversation_id === selectedConversationId) {
      set((state) => ({
        messages: [...state.messages, message as MessageWithChannel],
      }));
    }

    // Update conversation in list
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === message.conversation_id
          ? {
              ...c,
              last_message_at: message.created_at,
              last_message_preview: message.content.slice(0, 100),
              unread_count:
                message.direction === "inbound" ? c.unread_count + 1 : c.unread_count,
            }
          : c
      ),
    }));
  },

  // Real-time: Update conversation
  updateConversation: (conversation) => {
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === conversation.id ? { ...c, ...conversation } : c
      ),
      selectedConversation:
        state.selectedConversationId === conversation.id
          ? { ...state.selectedConversation!, ...conversation }
          : state.selectedConversation,
    }));
  },
}));
