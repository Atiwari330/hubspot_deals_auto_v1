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
  createdUserId?: string;
  updatedUserId?: string;
  displayOrder?: number;
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

function isCustomProperty(propertyName: string): boolean {
  // Custom properties are those that:
  // 1. Don't start with 'hs_' (HubSpot standard prefix)
  // 2. Are not in the list of default HubSpot properties
  const standardProperties = [
    'dealname',
    'amount',
    'closedate',
    'createdate',
    'dealstage',
    'pipeline',
    'hubspot_owner_id',
    'dealtype',
    'description',
    'hubspot_team_id',
    'num_associated_contacts',
    'num_contacted_notes',
    'num_notes',
    'closed_lost_reason',
    'closed_won_reason',
    'days_to_close',
    'hs_createdate',
    'hs_lastmodifieddate',
    'hs_object_id',
  ];

  return !propertyName.startsWith('hs_') && !standardProperties.includes(propertyName);
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

async function main() {
  console.log('\n🔧 CUSTOM DEAL PROPERTIES (Created by Your Organization)');
  console.log('═'.repeat(100));
  console.log('\nFetching custom properties from HubSpot API...\n');

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

    // Filter to only custom properties
    const customProperties = allProperties.filter(prop => isCustomProperty(prop.name));

    console.log(`✅ Found ${customProperties.length} custom properties out of ${allProperties.length} total properties\n`);

    if (customProperties.length === 0) {
      console.log('⚠️  No custom properties found.');
      console.log('   This might mean all properties are standard HubSpot fields.\n');
      return;
    }

    // Calculate stats
    const calculatedCount = customProperties.filter(p => p.calculated).length;
    const hiddenCount = customProperties.filter(p => p.hidden).length;
    const withOptionsCount = customProperties.filter(p => p.options && p.options.length > 0).length;

    console.log(`📊 Custom Property Statistics:`);
    console.log(`   • Total Custom Properties: ${customProperties.length}`);
    console.log(`   • Calculated/Formula Fields: ${calculatedCount}`);
    console.log(`   • Hidden Properties: ${hiddenCount}`);
    console.log(`   • Dropdown/Select Fields: ${withOptionsCount}`);
    console.log('\n' + '═'.repeat(100) + '\n');

    // Group properties by their group name
    const groupedProperties = groupPropertiesByGroup(customProperties);

    // Sort group names alphabetically
    const sortedGroupNames = Array.from(groupedProperties.keys()).sort();

    // Display properties organized by group
    sortedGroupNames.forEach((groupName, groupIndex) => {
      const properties = groupedProperties.get(groupName)!;

      console.log(`\n${'═'.repeat(100)}`);
      console.log(`📁 ${groupName.toUpperCase()} (${properties.length} properties)`);
      console.log('═'.repeat(100));

      properties.forEach((prop, index) => {
        const calculatedBadge = prop.calculated ? ' 🧮' : '';
        const hiddenBadge = prop.hidden ? ' 🔒' : '';

        console.log(`\n${index + 1}. ${prop.label}${calculatedBadge}${hiddenBadge}`);
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
          console.log(`   ├─ Calculated: Yes (formula/automation field)`);
        }

        if (prop.hidden) {
          console.log(`   ├─ Hidden: Yes (not visible in UI by default)`);
        }

        // Show options if it's an enumeration/select field
        if (prop.options && prop.options.length > 0) {
          const optionLabels = prop.options.map(o => o.label);
          if (optionLabels.length <= 8) {
            console.log(`   └─ Options: ${optionLabels.join(', ')}`);
          } else {
            console.log(`   └─ Options (${optionLabels.length} total): ${optionLabels.slice(0, 8).join(', ')}, ...`);
          }
        } else {
          console.log(`   └─`);
        }
      });
    });

    // Summary section with categorized breakdown
    console.log('\n' + '═'.repeat(100));
    console.log('\n📋 CUSTOM PROPERTIES BY TYPE:\n');

    const byType = new Map<string, number>();
    customProperties.forEach(prop => {
      const count = byType.get(prop.type) || 0;
      byType.set(prop.type, count + 1);
    });

    const sortedTypes = Array.from(byType.entries()).sort((a, b) => b[1] - a[1]);
    sortedTypes.forEach(([type, count]) => {
      console.log(`   • ${type}: ${count} properties`);
    });

    console.log('\n' + '═'.repeat(100));
    console.log('\n💡 LEGEND:');
    console.log('   🧮 = Calculated/Formula Field (auto-computed)');
    console.log('   🔒 = Hidden Property (not visible in UI by default)');
    console.log('\n📖 USAGE TIPS:');
    console.log('   • These are custom fields created specifically for your organization');
    console.log('   • Use the "Internal Name" when querying via API');
    console.log('   • Calculated properties are read-only (values set by formulas)');
    console.log('   • Hidden properties can still be accessed via API');
    console.log('   • You can modify/delete custom properties in HubSpot Settings > Properties');
    console.log('\n💾 TO EXPORT THIS DATA:');
    console.log('   • Text file: npm run custom-properties > custom-properties-list.txt');
    console.log('   • Or modify this script to export JSON/CSV format\n');
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
