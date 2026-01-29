/**
 * Debug script to check actual message structure in the database
 * for escalation customer question issue
 */

import * as dotenv from "dotenv";
import * as path from "path";

// Load .env.local file
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

import { createClient } from "@supabase/supabase-js";

async function debugMessages() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("❌ Missing Supabase environment variables");
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Problem conversation ID from API response
  const conversationId = "b269bb05-36d5-4f27-82d3-14ea48e57e86";

  console.log("\n🔍 Debugging Escalation Message Issue");
  console.log("═══════════════════════════════════════════════════════════\n");
  console.log(`📌 Conversation ID: ${conversationId}\n`);

  // Fetch ALL messages for this conversation
  const { data: messages, error } = await (supabase as any)
    .from("messages")
    .select("id, conversation_id, content, translated_content, original_language, direction, sender_type, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("❌ Error fetching messages:", error);
    return;
  }

  if (!messages || messages.length === 0) {
    console.log("⚠️  No messages found for this conversation");
    return;
  }

  console.log(`✅ Found ${messages.length} messages\n`);
  console.log("─".repeat(80));

  messages.forEach((msg: any, idx: number) => {
    console.log(`\n📧 Message ${idx + 1}:`);
    console.log(`   ID: ${msg.id}`);
    console.log(`   Created: ${msg.created_at}`);
    console.log(`   Direction: ${msg.direction}`);
    console.log(`   Sender Type: ${msg.sender_type}`);
    console.log(`   Original Language: ${msg.original_language || "N/A"}`);
    console.log(`   Content: ${msg.content?.substring(0, 100)}...`);
    console.log(`   Translated Content: ${msg.translated_content?.substring(0, 100) || "N/A"}...`);

    // Check if this would be selected as customer message
    const isCustomerMessage = (msg.direction === "inbound" || msg.sender_type === "customer")
      && msg.sender_type !== "internal_note"
      && msg.sender_type !== "system"
      && msg.sender_type !== "agent"
      && msg.sender_type !== "ai";

    if (isCustomerMessage) {
      console.log(`   ✅ THIS IS A CUSTOMER MESSAGE`);
    }
  });

  console.log("\n" + "─".repeat(80));
  console.log("\n🔍 Analysis:\n");

  // Find first customer message
  const firstCustomerMsg = messages.find((msg: any) => {
    const isCustomerMessage = (msg.direction === "inbound" || msg.sender_type === "customer")
      && msg.sender_type !== "internal_note"
      && msg.sender_type !== "system"
      && msg.sender_type !== "agent"
      && msg.sender_type !== "ai";
    return isCustomerMessage;
  });

  if (firstCustomerMsg) {
    console.log("✅ First customer message found:");
    console.log(`   Content: ${firstCustomerMsg.content}`);
    console.log(`   Translated Content: ${firstCustomerMsg.translated_content || "N/A"}`);
    console.log(`   Direction: ${firstCustomerMsg.direction}`);
    console.log(`   Sender Type: ${firstCustomerMsg.sender_type}`);
  } else {
    console.log("❌ No customer message found!");
  }

  console.log("\n═══════════════════════════════════════════════════════════\n");
}

debugMessages().catch((error) => {
  console.error("\n❌ Fatal error:", error);
  process.exit(1);
});
