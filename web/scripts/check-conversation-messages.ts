import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

import { createClient } from "@supabase/supabase-js";

async function checkMessages() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("Missing env vars");
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Get recent escalations
  const { data: escalations } = await (supabase as any)
    .from("escalations")
    .select("id, conversation_id, created_at")
    .order("created_at", { ascending: false })
    .limit(5);

  console.log("\n=== Recent Escalations ===\n");

  for (const esc of escalations || []) {
    console.log(`\nEscalation: ${esc.id}`);
    console.log(`Conversation: ${esc.conversation_id}`);
    console.log(`Created: ${esc.created_at}`);

    // Get all customer messages for this conversation
    const { data: messages } = await (supabase as any)
      .from("messages")
      .select("created_at, content, direction, sender_type")
      .eq("conversation_id", esc.conversation_id)
      .eq("direction", "inbound")
      .neq("sender_type", "internal_note")
      .neq("sender_type", "system")
      .neq("sender_type", "agent")
      .neq("sender_type", "ai")
      .order("created_at", { ascending: true })
      .limit(5);

    console.log("Customer messages:");
    (messages || []).forEach((msg: any, idx: number) => {
      console.log(`  ${idx + 1}. [${msg.created_at}] ${msg.content?.substring(0, 100)}`);
    });
  }
}

checkMessages().catch(console.error);
