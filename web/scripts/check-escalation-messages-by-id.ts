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

  const { data: escalations } = await (supabase as any)
    .from("escalations")
    .select("id, message_id, created_at, reason")
    .order("created_at", { ascending: false })
    .limit(5);

  console.log("\n=== Escalation Messages ===\n");

  for (const esc of escalations || []) {
    console.log(`\nEscalation: ${esc.id.substring(0, 8)}...`);
    console.log(`Created: ${esc.created_at}`);
    console.log(`Reason: ${esc.reason}`);

    // Get the message that triggered this escalation
    const { data: message } = await (supabase as any)
      .from("messages")
      .select("content, translated_content, original_language, sender_type, created_at")
      .eq("id", esc.message_id)
      .single();

    if (message) {
      console.log(`Message (${message.sender_type}, ${message.original_language}):`);
      console.log(`  Content: ${message.content?.substring(0, 100)}`);
      console.log(`  Translated: ${message.translated_content?.substring(0, 100) || "N/A"}`);
    } else {
      console.log(`  ❌ Message not found`);
    }
  }
}

checkMessages().catch(console.error);
