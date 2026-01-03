/**
 * Database Seed Script
 * Creates initial tenants, API keys, and agents for development and testing
 */

import { prisma } from '../db/prisma';
import { generateTenantId, generateApiKeyId, generateAgentId } from '../utils/ids';
import { generateApiKey, hashApiKey } from '../utils/hash';

interface SeedData {
  tenants: Array<{
    id: string;
    name: string;
    apiKey: string;
    apiKeyId: string;
  }>;
  agents: Array<{
    id: string;
    tenantId: string;
    name: string;
    primaryProvider: string;
    fallbackProvider: string | null;
  }>;
}

/**
 * Main seed function
 */
async function seed(): Promise<SeedData> {
  console.log('🌱 Seeding database...\n');

  // Check if data already exists
  const existingTenants = await prisma.tenant.count();
  if (existingTenants > 0) {
    console.log('⚠️  Database already contains data.');
    console.log('   Run `npm run db:reset` to clear and re-seed.\n');

    // Return existing data for display
    const tenants = await prisma.tenant.findMany({
      include: { apiKeys: true },
    });

    const agents = await prisma.agent.findMany();

    return {
      tenants: [], // Can't show API keys for existing data (they're hashed)
      agents: agents.map(a => ({
        id: a.id,
        tenantId: a.tenantId,
        name: a.name,
        primaryProvider: a.primaryProvider,
        fallbackProvider: a.fallbackProvider,
      })),
    };
  }

  // TENANT 1: StitchFin
  const tenant1Id = generateTenantId();
  const tenant1ApiKey = generateApiKey();
  const tenant1ApiKeyId = generateApiKeyId();

  await prisma.tenant.create({
    data: {
      id: tenant1Id,
      name: 'StitchFin',
    },
  });

  await prisma.apiKey.create({
    data: {
      id: tenant1ApiKeyId,
      tenantId: tenant1Id,
      keyHash: hashApiKey(tenant1ApiKey),
    },
  });

  console.log('✅ Created Tenant 1: StitchFin');

  // TENANT 2: GlobalTech Industries
  const tenant2Id = generateTenantId();
  const tenant2ApiKey = generateApiKey();
  const tenant2ApiKeyId = generateApiKeyId();

  await prisma.tenant.create({
    data: {
      id: tenant2Id,
      name: 'GlobalTech Industries',
    },
  });

  await prisma.apiKey.create({
    data: {
      id: tenant2ApiKeyId,
      tenantId: tenant2Id,
      keyHash: hashApiKey(tenant2ApiKey),
    },
  });

  console.log('✅ Created Tenant 2: GlobalTech Industries\n');

  // AGENTS FOR TENANT 1
  const agent1Id = generateAgentId();
  await prisma.agent.create({
    data: {
      id: agent1Id,
      tenantId: tenant1Id,
      name: 'Customer Support Agent',
      primaryProvider: 'vendorA',
      fallbackProvider: 'vendorB',
      systemPrompt:
        'You are a helpful customer support agent. Assist customers with their questions and provide accurate information about products and services.',
      enabledToolsJson: JSON.stringify(['InvoiceLookup', 'OrderTracking']),
    },
  });

  console.log('✅ Created Agent 1: Customer Support Agent (Tenant 1)');
  console.log('   Primary: vendorA, Fallback: vendorB');

  const agent2Id = generateAgentId();
  await prisma.agent.create({
    data: {
      id: agent2Id,
      tenantId: tenant1Id,
      name: 'Sales Assistant',
      primaryProvider: 'vendorB',
      fallbackProvider: null,
      systemPrompt:
        'You are a sales assistant. Help customers find the right products and answer questions about pricing and features.',
      enabledToolsJson: JSON.stringify(['ProductCatalog']),
    },
  });

  console.log('✅ Created Agent 2: Sales Assistant (Tenant 1)');
  console.log('   Primary: vendorB, Fallback: none\n');

  // AGENTS FOR TENANT 2
  const agent3Id = generateAgentId();
  await prisma.agent.create({
    data: {
      id: agent3Id,
      tenantId: tenant2Id,
      name: 'Technical Support Bot',
      primaryProvider: 'vendorA',
      fallbackProvider: 'vendorB',
      systemPrompt:
        'You are a technical support specialist. Help users troubleshoot technical issues and provide step-by-step solutions.',
      enabledToolsJson: JSON.stringify(['KnowledgeBase', 'TicketCreation']),
    },
  });

  console.log('✅ Created Agent 3: Technical Support Bot (Tenant 2)');
  console.log('   Primary: vendorA, Fallback: vendorB\n');

  // Return seed data for display
  return {
    tenants: [
      {
        id: tenant1Id,
        name: 'StitchFin',
        apiKey: tenant1ApiKey,
        apiKeyId: tenant1ApiKeyId,
      },
      {
        id: tenant2Id,
        name: 'GlobalTech Industries',
        apiKey: tenant2ApiKey,
        apiKeyId: tenant2ApiKeyId,
      },
    ],
    agents: [
      {
        id: agent1Id,
        tenantId: tenant1Id,
        name: 'Customer Support Agent',
        primaryProvider: 'vendorA',
        fallbackProvider: 'vendorB',
      },
      {
        id: agent2Id,
        tenantId: tenant1Id,
        name: 'Sales Assistant',
        primaryProvider: 'vendorB',
        fallbackProvider: null,
      },
      {
        id: agent3Id,
        tenantId: tenant2Id,
        name: 'Technical Support Bot',
        primaryProvider: 'vendorA',
        fallbackProvider: 'vendorB',
      },
    ],
  };
}

/**
 * Display seed results
 */
function displayResults(data: SeedData): void {
  if (data.tenants.length === 0) {
    console.log('ℹ️  Seed data already exists. No new data created.\n');
    return;
  }

  console.log('\n' + '='.repeat(70));
  console.log('                    SEED COMPLETE - API KEYS');
  console.log('='.repeat(70));
  console.log('\n⚠️  IMPORTANT: Save these API keys! They cannot be retrieved later.\n');

  data.tenants.forEach((tenant, index) => {
    console.log(`Tenant ${index + 1}: ${tenant.name}`);
    console.log(`  Tenant ID: ${tenant.id}`);
    console.log(`  API Key:   ${tenant.apiKey}`);
    console.log('');
  });

  console.log('='.repeat(70));
  console.log('                         AGENTS CREATED');
  console.log('='.repeat(70));
  console.log('');

  data.agents.forEach((agent, index) => {
    const tenant = data.tenants.find((t) => t.id === agent.tenantId);
    console.log(`Agent ${index + 1}: ${agent.name}`);
    console.log(`  Tenant:    ${tenant?.name || 'Unknown'}`);
    console.log(`  Agent ID:  ${agent.id}`);
    console.log(`  Primary:   ${agent.primaryProvider}`);
    console.log(`  Fallback:  ${agent.fallbackProvider || 'none'}`);
    console.log('');
  });

  console.log('='.repeat(70));
  console.log('\n✨ Seed completed successfully!\n');
  console.log('To test the API, use one of the API keys above:');
  console.log('  curl -H "X-API-Key: <api-key>" http://localhost:3000/v1/me\n');
}

/**
 * Run seed
 */
async function main() {
  try {
    const data = await seed();
    displayResults(data);
  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

export { seed, displayResults };
