import 'dotenv/config';

const HUBSPOT_API_BASE = 'https://api.hubapi.com';

interface HubSpotProperty {
  name: string;
  label: string;
  type: string;
  fieldType: string;
  groupName: string;
  description?: string;
  options?: Array<{ label: string; value: string }>;
  calculated?: boolean;
  externalOptions?: boolean;
}

interface PropertiesResponse {
  results: HubSpotProperty[];
}

async function discoverDealProperties(accessToken: string): Promise<HubSpotProperty[]> {
  console.log('🔍 Fetching all deal properties from HubSpot...\n');

  const response = await fetch(`${HUBSPOT_API_BASE}/crm/v3/properties/deals`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to fetch properties: ${response.status} ${error}`);
  }

  const data: PropertiesResponse = await response.json();
  return data.results || [];
}

function filterRelevantProperties(
  properties: HubSpotProperty[],
  keywords: string[]
): HubSpotProperty[] {
  return properties.filter(prop => {
    const searchText = `${prop.name} ${prop.label} ${prop.description || ''}`.toLowerCase();
    return keywords.some(keyword => searchText.includes(keyword.toLowerCase()));
  });
}

async function main() {
  console.log('🚀 HubSpot Deal Properties Discovery Tool\n');
  console.log('━'.repeat(80));

  // Validate environment variables
  if (!process.env.HUBSPOT_ACCESS_TOKEN) {
    console.error('❌ Error: HUBSPOT_ACCESS_TOKEN environment variable is required');
    process.exit(1);
  }

  const accessToken = process.env.HUBSPOT_ACCESS_TOKEN;

  try {
    // Fetch all properties
    const allProperties = await discoverDealProperties(accessToken);
    console.log(`✅ Found ${allProperties.length} total deal properties\n`);

    // Keywords for the properties we're looking for
    const searchKeywords = [
      'product',
      'ehr',
      'collaborator',
      'substage',
      'meeting',
      'appointment',
      'next_meeting',
      'prior'
    ];

    console.log('━'.repeat(80));
    console.log('🎯 Searching for properties matching keywords:\n');
    console.log(`   ${searchKeywords.join(', ')}\n`);
    console.log('━'.repeat(80));

    // Filter relevant properties
    const relevantProperties = filterRelevantProperties(allProperties, searchKeywords);

    if (relevantProperties.length > 0) {
      console.log(`\n✅ Found ${relevantProperties.length} potentially relevant properties:\n`);

      relevantProperties.forEach((prop, index) => {
        console.log(`${index + 1}. ${prop.label}`);
        console.log(`   ├─ Internal Name: ${prop.name}`);
        console.log(`   ├─ Type: ${prop.type}`);
        console.log(`   ├─ Field Type: ${prop.fieldType}`);
        console.log(`   ├─ Group: ${prop.groupName}`);
        if (prop.description) {
          console.log(`   └─ Description: ${prop.description}`);
        }

        // Show options if it's an enumeration
        if (prop.options && prop.options.length > 0) {
          console.log(`   └─ Options: ${prop.options.map(o => o.label).join(', ')}`);
        }
        console.log('');
      });
    } else {
      console.log('\n⚠️  No properties found matching the search keywords.');
      console.log('    This might mean these are custom properties with different naming.\n');
    }

    // Show all custom properties (non-HubSpot standard)
    console.log('━'.repeat(80));
    console.log('📋 All Custom Properties (non-standard):\n');
    const customProperties = allProperties.filter(prop =>
      !prop.name.startsWith('hs_') &&
      !['dealname', 'amount', 'closedate', 'createdate', 'dealstage', 'pipeline'].includes(prop.name)
    );

    if (customProperties.length > 0) {
      customProperties.forEach((prop, index) => {
        console.log(`${index + 1}. "${prop.label}" → ${prop.name} (${prop.fieldType})`);
      });
    } else {
      console.log('   No custom properties found.');
    }

    console.log('\n' + '━'.repeat(80));
    console.log('\n💡 Next Steps:');
    console.log('   1. Review the properties above');
    console.log('   2. Identify which internal names match your required fields:');
    console.log('      - Product/s');
    console.log('      - Prior EHR');
    console.log('      - Deal Collaborator');
    console.log('      - Deal Substage');
    console.log('      - Next Meeting Start Time');
    console.log('   3. Add those property names to src/hubspot.ts\n');

  } catch (error) {
    console.error('\n❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
