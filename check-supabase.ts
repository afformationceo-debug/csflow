import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function check() {
  // Check tenants
  const { data: tenants, error: tenantsError } = await supabase
    .from('tenants')
    .select('id, name');
  
  console.log('=== TENANTS ===');
  if (tenantsError) {
    console.error('Error:', tenantsError);
  } else {
    console.log(JSON.stringify(tenants, null, 2));
  }

  // Check knowledge documents count
  const { data: docs, error: docsError, count } = await supabase
    .from('knowledge_documents')
    .select('*', { count: 'exact', head: true });

  console.log('\n=== KNOWLEDGE DOCUMENTS ===');
  if (docsError) {
    console.error('Error:', docsError);
  } else {
    console.log(`Total documents: ${count}`);
  }

  // Check by tenant
  if (tenants && tenants.length > 0) {
    for (const tenant of tenants) {
      const { count: tenantCount } = await supabase
        .from('knowledge_documents')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenant.id);
      
      console.log(`  - ${tenant.name}: ${tenantCount} documents`);
    }
  }
}

check().catch(console.error);
