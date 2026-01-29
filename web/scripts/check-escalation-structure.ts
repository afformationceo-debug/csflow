import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

import { createClient } from "@supabase/supabase-js";

async function checkEscalation() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("Missing env vars");
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  
  const { data: escalations } = await (supabase as any)
    .from("escalations")
    .select("id, conversation_id, message_id, created_at, reason")
    .order("created_at", { ascending: false })
    .limit(3);

  console.log("\n=== Escalation Structure ===\n");
  console.log(JSON.stringify(escalations, null, 2));
}

checkEscalation().catch(console.error);
