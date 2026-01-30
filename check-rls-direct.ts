import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: './web/.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function checkRLSPolicies() {
  console.log('=== CHECKING AUTH USERS ===\n');
  
  const { data: authData, error: authError } = await supabase.auth.admin.listUsers();
  
  if (authError) {
    console.error('Error listing auth users:', authError);
  } else {
    console.log('Auth Users:');
    authData.users.forEach(user => {
      console.log(`- ${user.email}: ${user.id}`);
    });
  }

  console.log('\n=== CHECKING USERS TABLE ===\n');
  
  const { data: usersData, error: usersError } = await supabase
    .from('users')
    .select('id, email, tenant_ids');

  if (usersError) {
    console.error('Error fetching users table:', usersError);
  } else {
    console.log('Users Table:', JSON.stringify(usersData, null, 2));
  }

  console.log('\n=== TESTING DOCUMENT QUERY ===\n');
  
  const tenantId = '8d3bd24e-0d74-4dc7-aa34-3e39d5821244';
  
  const { data: serviceData, error: serviceError } = await supabase
    .from('knowledge_documents')
    .select('id, title, tenant_id')
    .eq('tenant_id', tenantId)
    .limit(5);

  console.log('Service Role Query (should work):');
  if (serviceError) {
    console.error('Error:', serviceError);
  } else {
    const count = serviceData ? serviceData.length : 0;
    console.log(`Found ${count} documents`);
    console.log(JSON.stringify(serviceData, null, 2));
  }

  console.log('\n=== TESTING TENANTS QUERY ===\n');
  
  const { data: tenantsData, error: tenantsError } = await supabase
    .from('tenants')
    .select('id, name');

  console.log('Tenants Query (service role):');
  if (tenantsError) {
    console.error('Error:', tenantsError);
  } else {
    console.log(JSON.stringify(tenantsData, null, 2));
  }
}

checkRLSPolicies().catch(console.error);
