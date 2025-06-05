#!/usr/bin/env ts-node

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

async function updateDeprecatedToArchived() {
  console.log('Updating deprecated commands to archived status...\n');
  
  const supabase = SupabaseClientService.getInstance().getClient();

  // IDs of commands to update to archived
  const commandIds = [
    'dc425dba-51d1-4266-80d8-e98fc46d490f', 'bd96d19c-1ba4-4589-ab9f-850c6c2fabee', 
    'ef53f4a4-5871-4c71-87ba-ba7d36ac9be7', 'ec6a7c11-8d12-4318-aff0-7862523b93c5', 
    'fd095535-25cc-454d-8f7e-0cbc1da23672', 'd76680e8-61b5-4892-a4b1-1de6d62cf41c', 
    '998cac4a-c41a-464d-acd0-1f849e9a6441', 'ac0589ff-e678-4d85-9af5-a3e921b055f9', 
    '6d606fcb-dd0b-46bc-aaed-be4ab44d13b2', '35556db8-fd2f-4783-86f0-5f45742b887a', 
    '1289744e-6599-421f-ba6a-70e8968885aa', '2d710689-c1c6-4f24-848b-383bcc9108e9', 
    'c9ee0a7a-0f55-412d-b404-b329e08f593b', '32d87891-dd9a-4622-960c-a95d4397bb2b', 
    '8b7ce0bd-b6c4-41b7-ac04-9c907c4a2fac', '2c2d321f-7239-490a-8b4f-244676315c30', 
    'd3204a51-9fd5-41c0-9c29-36421e47e547', 'd13f5902-7545-449a-b2a3-6062ac10d071', 
    'b0f1abb6-0601-4ad5-bd78-d250f669d951', '0e64be35-ef11-4d2c-9c5d-98090f8f002c', 
    'f7baef4c-d835-449f-baea-f1a3b39e81d6', '5933b530-c815-4d76-8cdd-5881d991e7ed', 
    '12db27bf-0ac1-4f00-b184-f65b85d49852', 'deffa2dd-c505-49a7-96b7-6fa0515ea0e6', 
    '7af58697-4f18-45ca-af30-fb2ee3ca1686', '2dae1ed4-f985-459c-9b11-8a72eceeaeb7', 
    '0c8524ea-7b17-4c88-b031-bc7ba2fb1928', 'd36a1c6d-4a64-42a4-916e-0006fe674e4e', 
    '1db145d5-8041-408b-ad18-ce974610b249', '7962396c-ea74-4de6-a12f-76b9f9e25f16', 
    '3c3a75e6-b75e-4dfe-8c12-7519db3cf963', 'bcd883ea-dbca-4111-9def-e1a1e0c6ce95', 
    '1fdba459-eee1-4b65-893f-65f58077194a', '8fd44bc1-678e-43b3-86d4-bb930ebe0810', 
    '53b7e901-b9f9-41ae-bd23-c9f0f1f24a54', 'b4d9b4f9-8221-4a9c-a955-036ce0592aa2', 
    'a902c110-ddd6-4f05-a7f3-f9e81cff8a3b', '4d414ead-c6e2-40d2-ada3-d41ece5835c4', 
    '6ce95275-55f8-461d-a070-8181a0ca3f99', '4dfc6e93-f82d-4b3a-a055-798ebea0555f', 
    'df86a07a-44b0-4700-88b8-f284f012e074', 'b8ef78aa-8da2-4e38-91e7-283e106501f8', 
    '8b359837-bafe-4747-af7d-3fae4f7786e7', '4320edca-aced-4313-b4aa-fc4d4ae05bfc', 
    '4b2fda28-d155-443d-82a3-185116512c33', 'fc9ec280-996d-4896-8c36-0c04658f0d4d', 
    '11267794-4b3f-48b1-801c-b54527ce401d', 'cb4ae82b-1e1b-4a63-a820-0aaf6643da27', 
    'f99e48f6-21f7-42ab-9e19-fe203d25ec3f', '1dc0e919-1978-4f9c-9d8f-b33617f48c80', 
    '2361eb0a-7ebf-4f03-94e1-8153521e1a28', '89d3cc7b-8913-476d-a08e-e2f85dc18873', 
    'a8e25645-b505-4a4f-a7b8-b27cc7819014', '3385b7f7-99f8-4310-9320-55c6c3804fe3', 
    '756fad05-1682-4a67-81ea-486405580710', 'd380212b-259c-443e-a13e-798f4fd9ad30', 
    'ceb1cc0c-2bdd-40e3-84d9-45db89ca5247', 'b2bae509-05e7-40cf-8554-5680d8f81818', 
    '7f590c37-e1be-4002-a94f-63c3f8d7ba92', '8425c103-c8f1-4537-9c2f-cbf1005525f2', 
    'b3b820d6-cb39-42e6-9c3a-3a3c505b0225', 'ba89d9e3-9797-4cfc-84ac-ea371e79be38', 
    'bbfe72d1-f519-42c2-952b-4776736f1ff3', '86e94fd7-52da-4fd5-8c3d-fb0750eb02c9', 
    '2eba3653-259d-47f3-abd7-ade579a85bdc', '92a5993f-b8ec-4f97-a401-9f701eda7cc7', 
    '43a6adfb-3207-41f2-9a16-d4eb5e8a50c1', '01be41ff-a3b5-47b9-9e28-1e2ba16b6ef2', 
    '1db9184d-e3ac-4439-bc55-80e8bdbb69fc', '451155e7-31ad-499c-a4bd-49b7b067e045', 
    'f204b237-3d96-4149-ae98-1e4ec45f2681', 'ce93bbb3-0418-4029-ac4c-56bfd7d7506b', 
    '988c126e-749b-407b-b940-cb9b48edaf11', '0b7f65e8-0621-49a5-9b3f-88e53006ab72', 
    '205031bd-352e-413f-9446-15d9fe641d08', '84edf71c-8cd0-456d-9303-e53363f13eb3', 
    'af8c775b-3f40-4f4c-b392-c2c368e0c7f2', '87fb1c8e-7088-4585-bbc9-3f6034c3a877', 
    'e42d39e5-bfce-4147-a10f-bc1de87c3a81', '2152b87a-59c3-421b-a1d8-ad8f075ea3cc', 
    '931920c7-f927-4225-8058-6ffe21a6ce70', 'c30eec15-9ded-491f-bcaa-484216eb8436', 
    '496d5422-43da-41b3-a097-e255a0d89f36', '2d465f86-3bf5-4356-af00-cf11df9c7855', 
    '3b353c79-75dc-4e93-87bf-44a909fc3f08', '3f7a4d67-52be-4b5f-b9dd-0af0de826101', 
    '7a70a78e-2461-43e9-8203-4c5a035044f5', '69a788e7-2d5d-4e1e-8597-c3b9d7f78533', 
    'c3e8001a-290b-4836-8437-8ea7531afd4e', 'c520e6ea-f69b-472e-ab2b-e5cfb412565b', 
    '1f6c9b77-cc49-4ebc-b09a-911e06aa7c37', '5c38d547-4467-4b77-a93e-a83668ff3299'
  ];

  try {
    // Execute the update
    const { data: updatedRecords, error, count } = await supabase
      .from('command_refactor_tracking')
      .update({ 
        current_status: 'archived',
        updated_at: new Date().toISOString()
      })
      .in('id', commandIds)
      .select();

    if (error) {
      console.error('Error updating commands:', error);
      process.exit(1);
    }

    if (!updatedRecords || updatedRecords.length === 0) {
      console.log('No records were updated. This might mean they were already archived or the IDs were not found.');
      return;
    }

    // Display summary
    console.log(`✅ Successfully updated ${updatedRecords.length} commands from 'deprecated' to 'archived'\n`);
    
    // Group by command type for summary
    const typeSummary = updatedRecords.reduce((acc: Record<string, number>, record: any) => {
      acc[record.command_type] = (acc[record.command_type] || 0) + 1;
      return acc;
    }, {});

    console.log('Summary by command type:');
    console.log('========================');
    Object.entries(typeSummary)
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([type, count]) => {
        console.log(`${type}: ${count} commands`);
      });

    console.log('\nAll commands have been successfully archived.');

    // Verify final status
    const { data: statusCounts, error: verifyError } = await supabase
      .from('command_refactor_tracking')
      .select('current_status')
      .order('current_status');

    if (!verifyError && statusCounts) {
      const statusSummary = statusCounts.reduce((acc: Record<string, number>, row: any) => {
        acc[row.current_status] = (acc[row.current_status] || 0) + 1;
        return acc;
      }, {});

      console.log('\nCurrent status distribution:');
      console.log('===========================');
      Object.entries(statusSummary)
        .sort(([a], [b]) => a.localeCompare(b))
        .forEach(([status, count]) => {
          console.log(`${status}: ${count} commands`);
        });
    }

  } catch (error) {
    console.error('Unexpected error:', error);
    process.exit(1);
  }
}

// Run the update
updateDeprecatedToArchived();