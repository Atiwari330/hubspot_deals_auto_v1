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
  hidden?: boolean;
  modificationMetadata?: {
    readOnlyValue?: boolean;
    readOnlyDefinition?: boolean;
  };
}

interface PropertiesResponse {
  results: HubSpotProperty[];
}

async function fetchAllDealProperties(accessToken: string): Promise<HubSpotProperty[]> {
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

function groupPropertiesByGroup(properties: HubSpotProperty[]): Map<string, HubSpotProperty[]> {
  const grouped = new Map<string, HubSpotProperty[]>();

  properties.forEach(prop => {
    const groupName = prop.groupName || 'Uncategorized';
    if (!grouped.has(groupName)) {
      grouped.set(groupName, []);
    }
    grouped.get(groupName)!.push(prop);
  });

  // Sort properties within each group alphabetically by label
  grouped.forEach(props => {
    props.sort((a, b) => a.label.localeCompare(b.label));
  });

  return grouped;
}

function isStandardProperty(propertyName: string): boolean {
  return propertyName.startsWith('hs_') ||
         ['dealname', 'amount', 'closedate', 'createdate', 'dealstage', 'pipeline', 'hubspot_owner_id'].includes(propertyName);
}

async function main() {
  console.log('\n📊 ALL HUBSPOT DEAL PROPERTIES');
  console.log('═'.repeat(100));
  console.log('\nFetching comprehensive property list from HubSpot API...\n');

  // Validate environment variables
  if (!process.env.HUBSPOT_ACCESS_TOKEN) {
    console.error('❌ Error: HUBSPOT_ACCESS_TOKEN environment variable is required');
    console.error('   Please add it to your .env file\n');
    process.exit(1);
  }

  const accessToken = process.env.HUBSPOT_ACCESS_TOKEN;

  try {
    // Fetch all properties
    const allProperties = await fetchAllDealProperties(accessToken);

    // Calculate stats
    const standardCount = allProperties.filter(p => isStandardProperty(p.name)).length;
    const customCount = allProperties.length - standardCount;
    const calculatedCount = allProperties.filter(p => p.calculated).length;

    console.log(`✅ Successfully retrieved ${allProperties.length} total properties\n`);
    console.log(`📈 Property Statistics:`);
    console.log(`   • Standard HubSpot Properties: ${standardCount}`);
    console.log(`   • Custom Properties: ${customCount}`);
    console.log(`   • Calculated Properties: ${calculatedCount}`);
    console.log('\n' + '═'.repeat(100) + '\n');

    // Group properties by their group name
    const groupedProperties = groupPropertiesByGroup(allProperties);

    // Sort group names alphabetically
    const sortedGroupNames = Array.from(groupedProperties.keys()).sort();

    // Display properties organized by group
    sortedGroupNames.forEach((groupName, groupIndex) => {
      const properties = groupedProperties.get(groupName)!;

      console.log(`\n${'═'.repeat(100)}`);
      console.log(`📁 ${groupName.toUpperCase()} (${properties.length} properties)`);
      console.log('═'.repeat(100));

      properties.forEach((prop, index) => {
        const isCustom = !isStandardProperty(prop.name);
        const customBadge = isCustom ? ' 🔧' : '';
        const calculatedBadge = prop.calculated ? ' 🧮' : '';

        console.log(`\n${index + 1}. ${prop.label}${customBadge}${calculatedBadge}`);
        console.log(`   ├─ Internal Name: ${prop.name}`);
        console.log(`   ├─ Type: ${prop.type}`);
        console.log(`   ├─ Field Type: ${prop.fieldType}`);

        if (prop.description) {
          // Wrap long descriptions
          const maxLength = 80;
          const desc = prop.description;
          if (desc.length <= maxLength) {
            console.log(`   ├─ Description: ${desc}`);
          } else {
            console.log(`   ├─ Description: ${desc.substring(0, maxLength)}...`);
          }
        }

        if (prop.calculated) {
          console.log(`   ├─ Calculated: Yes (auto-computed by HubSpot)`);
        }

        if (prop.hidden) {
          console.log(`   ├─ Hidden: Yes`);
        }

        // Show options if it's an enumeration/select field
        if (prop.options && prop.options.length > 0) {
          const optionLabels = prop.options.map(o => o.label);
          if (optionLabels.length <= 5) {
            console.log(`   └─ Options: ${optionLabels.join(', ')}`);
          } else {
            console.log(`   └─ Options (${optionLabels.length}): ${optionLabels.slice(0, 5).join(', ')}, ...`);
          }
        } else {
          console.log(`   └─`);
        }
      });
    });

    // Summary section
    console.log('\n' + '═'.repeat(100));
    console.log('\n💡 LEGEND:');
    console.log('   🔧 = Custom Property (created by your organization)');
    console.log('   🧮 = Calculated Property (auto-computed by HubSpot)');
    console.log('\n📖 USAGE TIPS:');
    console.log('   • Use the "Internal Name" when querying via API');
    console.log('   • Custom properties can be modified/deleted via HubSpot settings');
    console.log('   • Calculated properties are read-only');
    console.log('   • Refer to "Type" and "Field Type" when building forms or validations');
    console.log('\n💾 To export this data:');
    console.log('   • Redirect output: npm run all-properties > properties-list.txt');
    console.log('   • Or modify this script to export JSON/CSV\n');
    console.log('═'.repeat(100) + '\n');

  } catch (error) {
    console.error('\n❌ Error fetching properties:');
    console.error(error instanceof Error ? error.message : error);
    console.error('\nTroubleshooting:');
    console.error('   1. Verify HUBSPOT_ACCESS_TOKEN is set in .env');
    console.error('   2. Ensure token has crm.schemas.deals.read scope');
    console.error('   3. Check if token is expired or revoked\n');
    process.exit(1);
  }
}

main();
