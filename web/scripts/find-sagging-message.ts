import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

import { createClient } from "@supabase/supabase-js";

async function findMessage() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("Missing env vars");
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log("\n🔍 Searching for 'sagging cheeks' message...\n");

  // Find message
  const { data: messages } = await (supabase as any)
    .from("messages")
    .select("*")
    .ilike("content", "%sagging%")
    .order("created_at", { ascending: false })
    .limit(5);

  if (messages && messages.length > 0) {
    console.log(`Found ${messages.length} messages:\n`);
    for (const msg of messages) {
      console.log(`Message ID: ${msg.id}`);
      console.log(`Conversation ID: ${msg.conversation_id}`);
      console.log(`Direction: ${msg.direction}`);
      console.log(`Sender Type: ${msg.sender_type}`);
      console.log(`Content: ${msg.content?.substring(0, 150)}...`);
      console.log(`Created: ${msg.created_at}`);

      // Check if there's an escalation for this message
      const { data: escalation } = await (supabase as any)
        .from("escalations")
        .select("id, created_at, reason")
        .eq("message_id", msg.id)
        .maybeSingle();

      if (escalation) {
        console.log(`✅ HAS ESCALATION: ${escalation.id}`);
      } else {
        console.log(`❌ NO ESCALATION for this message`);

        // Check conversation-level escalation
        const { data: convEscalations } = await (supabase as any)
          .from("escalations")
          .select("id, message_id, created_at, reason")
          .eq("conversation_id", msg.conversation_id)
          .order("created_at", { ascending: false })
          .limit(3);

        if (convEscalations && convEscalations.length > 0) {
          console.log(`   Conversation has ${convEscalations.length} escalations:`);
          convEscalations.forEach((e: any) => {
            console.log(`     - ${e.id} (message_id: ${e.message_id || 'null'})`);
          });
        }
      }
      console.log("---\n");
    }
  } else {
    console.log("No messages found with 'sagging'");
  }
}

findMessage().catch(console.error);
