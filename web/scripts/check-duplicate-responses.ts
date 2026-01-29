import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

import { createClient } from "@supabase/supabase-js";

async function checkDuplicates() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("Missing env vars");
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const conversationId = "b269bb05-36d5-4f27-82d3-14ea48e57e86";
  const customerMessageId = "71651dfa-8f8f-46dc-8688-5008fdf56777";

  console.log("\n🔍 Checking duplicate AI responses\n");
  console.log(`Conversation: ${conversationId}`);
  console.log(`Customer Message: ${customerMessageId} (sagging cheeks)\n`);

  // Get customer message timestamp
  const { data: customerMsg } = await (supabase as any)
    .from("messages")
    .select("created_at, content")
    .eq("id", customerMessageId)
    .single();

  console.log(`Customer message time: ${customerMsg.created_at}`);
  console.log(`Content: ${customerMsg.content?.substring(0, 80)}...\n`);

  // Get all messages after this customer message
  const { data: afterMessages } = await (supabase as any)
    .from("messages")
    .select("id, sender_type, created_at, content, direction")
    .eq("conversation_id", conversationId)
    .gte("created_at", customerMsg.created_at)
    .order("created_at", { ascending: true });

  console.log(`Messages after customer message (${afterMessages?.length || 0}):\n`);

  let aiResponseCount = 0;
  afterMessages?.forEach((msg: any, i: number) => {
    const isAI = msg.sender_type === "ai";
    if (isAI) aiResponseCount++;

    console.log(`${i + 1}. [${msg.created_at}] ${msg.sender_type} (${msg.direction})`);
    console.log(`   ${msg.content?.substring(0, 80)}...`);
    if (isAI) console.log(`   ⚠️  AI RESPONSE #${aiResponseCount}`);
    console.log();
  });

  console.log(`\n❌ DUPLICATE AI RESPONSES: ${aiResponseCount} (should be 0 or 1)`);

  // Check what the duplicate prevention logic would see
  console.log("\n--- Duplicate Prevention Logic Test ---");
  const { data: checkMessages } = await (supabase as any)
    .from("messages")
    .select("id, sender_type, created_at, direction")
    .eq("conversation_id", conversationId)
    .gte("created_at", customerMsg.created_at)
    .order("created_at", { ascending: true });

  const hasAIResponse = checkMessages?.some((msg: any) =>
    msg.id !== customerMessageId && msg.sender_type === "ai"
  );

  console.log(`Query: messages >= ${customerMsg.created_at}`);
  console.log(`Found ${checkMessages?.length || 0} messages`);
  console.log(`Has AI response: ${hasAIResponse}`);
  console.log(`Should skip: ${hasAIResponse ? 'YES' : 'NO'}`);
}

checkDuplicates().catch(console.error);
