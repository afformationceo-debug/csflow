import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

// Load .env.local
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function createUser() {
  try {
    const { data, error } = await supabase.auth.admin.createUser({
      email: "afformation.ceo@gmail.com",
      password: "afformation1!",
      email_confirm: true,
    });

    if (error) {
      console.error("Error creating user:", error.message);
      process.exit(1);
    }

    console.log("✅ User created successfully!");
    console.log("Email:", data.user.email);
    console.log("ID:", data.user.id);
  } catch (err) {
    console.error("Failed to create user:", err);
    process.exit(1);
  }
}

createUser();
