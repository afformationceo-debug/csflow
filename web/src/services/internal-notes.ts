import { createClient } from "@/lib/supabase/client";
import { createServiceClient } from "@/lib/supabase/server";

export interface InternalNote {
  id: string;
  conversation_id: string;
  author_id: string;
  content: string;
  mentioned_users: string[];
  created_at: string;
}

export interface InternalNoteWithAuthor extends InternalNote {
  author?: {
    id: string;
    name: string;
    avatar_url: string | null;
  };
}

// Client-side service
export const internalNoteService = {
  async getNotes(conversationId: string): Promise<InternalNoteWithAuthor[]> {
    const supabase = createClient();

    const { data, error } = await (supabase
      .from("internal_notes") as any)
      .select(`
        *,
        author:users!author_id(id, name, avatar_url)
      `)
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (error) throw error;

    return (data as unknown as InternalNoteWithAuthor[]) || [];
  },

  async createNote(data: {
    conversationId: string;
    authorId: string;
    content: string;
    mentionedUsers?: string[];
  }): Promise<InternalNote> {
    const supabase = createClient();

    const { data: note, error } = await (supabase
      .from("internal_notes") as any)
      .insert({
        conversation_id: data.conversationId,
        author_id: data.authorId,
        content: data.content,
        mentioned_users: data.mentionedUsers || [],
      })
      .select()
      .single();

    if (error) throw error;

    return note;
  },

  async deleteNote(noteId: string): Promise<void> {
    const supabase = createClient();

    const { error } = await (supabase
      .from("internal_notes") as any)
      .delete()
      .eq("id", noteId);

    if (error) throw error;
  },

  // Real-time subscription for internal notes
  subscribeToNotes(
    conversationId: string,
    callback: (payload: {
      eventType: "INSERT" | "UPDATE" | "DELETE";
      new: InternalNote;
      old: InternalNote;
    }) => void
  ) {
    const supabase = createClient();

    return (supabase as any)
      .channel(`internal_notes:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "internal_notes",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          callback({
            eventType: payload.eventType as "INSERT" | "UPDATE" | "DELETE",
            new: payload.new as InternalNote,
            old: payload.old as InternalNote,
          });
        }
      )
      .subscribe();
  },
};

// Server-side service
export const serverInternalNoteService = {
  async createNote(data: {
    conversationId: string;
    authorId: string;
    content: string;
    mentionedUsers?: string[];
  }): Promise<InternalNote> {
    const supabase = await createServiceClient();

    const { data: note, error } = await (supabase
      .from("internal_notes") as any)
      .insert({
        conversation_id: data.conversationId,
        author_id: data.authorId,
        content: data.content,
        mentioned_users: data.mentionedUsers || [],
      })
      .select()
      .single();

    if (error) throw error;

    return note;
  },
};
