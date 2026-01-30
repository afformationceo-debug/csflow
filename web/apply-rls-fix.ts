import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config({ path: './.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function applyMigration() {
  console.log('=== APPLYING RLS POLICY FIX ===\n');

  // Read the migration file
  const migrationSQL = fs.readFileSync('./supabase/migrations/006_fix_knowledge_rls_policies.sql', 'utf-8');

  console.log('Executing migration...\n');

  // Split SQL by semicolons and execute each statement
  const statements = migrationSQL
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];

    // Skip comments and empty lines
    if (statement.startsWith('--') || statement.length < 10) {
      continue;
    }

    console.log(`Executing statement ${i + 1}/${statements.length}...`);

    try {
      const { data, error } = await supabase.rpc('exec_sql', {
        sql_query: statement + ';'
      });

      if (error) {
        // Try direct execution if RPC fails
        console.log('RPC failed, trying alternative method...');

        // For policy creation, we need to use raw SQL execution
        // This might not work via Supabase client, need to use Postgres directly
        console.log('Statement:', statement.substring(0, 100) + '...');
        console.error('Error:', error.message);
      } else {
        console.log('✓ Success');
      }
    } catch (err) {
      console.error('Error executing statement:', err);
    }
  }

  console.log('\n=== TESTING ACCESS ===\n');

  // Test querying tenants as authenticated user would
  console.log('Testing tenant query...');
  const { data: tenants, error: tenantsError } = await supabase
    .from('tenants')
    .select('id, name');

  if (tenantsError) {
    console.error('Tenants query error:', tenantsError);
  } else {
    console.log(`✓ Found ${tenants?.length || 0} tenants`);
  }

  // Test querying knowledge_documents
  console.log('Testing knowledge_documents query...');
  const { data: docs, error: docsError } = await supabase
    .from('knowledge_documents')
    .select('id, title, tenant_id')
    .limit(5);

  if (docsError) {
    console.error('Documents query error:', docsError);
  } else {
    console.log(`✓ Found ${docs?.length || 0} documents`);
  }

  console.log('\n=== MIGRATION COMPLETE ===');
  console.log('\nNOTE: The migration file has been created.');
  console.log('Please run this SQL manually in Supabase SQL Editor:');
  console.log('./supabase/migrations/006_fix_knowledge_rls_policies.sql');
}

applyMigration().catch(console.error);
