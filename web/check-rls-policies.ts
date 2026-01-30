import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkPolicies() {
  // Check if user exists in users table
  const { data: userRecord, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('email', 'afformation.ceo@gmail.com')
    .single();

  console.log('=== USER RECORD ===');
  if (userError) {
    console.log('❌ No user record found in users table');
    console.log('Error:', userError.message);
  } else {
    console.log('✅ User exists:');
    console.log(JSON.stringify(userRecord, null, 2));
  }

  // Check RLS policies for knowledge_documents
  const { data: policies } = await supabase
    .rpc('exec_sql', { 
      query: `
        SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
        FROM pg_policies 
        WHERE tablename = 'knowledge_documents'
      ` 
    })
    .single();

  console.log('\n=== RLS POLICIES (knowledge_documents) ===');
  console.log(policies);
}

checkPolicies().catch(console.error);
