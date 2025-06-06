#!/usr/bin/env node
import * as XLSX from 'xlsx';
import * as path from 'path';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

const supabase = SupabaseClientService.getInstance().getClient();

interface EmailImport {
  email: string;
  firstName?: string;
  lastName?: string;
}

async function importDHGEmails() {
  console.log('Starting Dynamic Healing Group email import...\n');
  
  // Read the Excel file
  const filePath = path.join(process.cwd(), 'docs/imports/Dynamic Healing Group - 5-31-2025.xlsx');
  console.log('Reading file:', filePath);
  
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  
  // Convert to JSON with headers
  const rawData = XLSX.utils.sheet_to_json<any>(sheet);
  console.log(`Found ${rawData.length} rows in Excel file\n`);
  
  // Parse and normalize the data
  const emailData: EmailImport[] = rawData.map(row => ({
    email: (row['Email Address'] || '').toString().toLowerCase().trim(),
    firstName: (row['First Name'] || '').toString().trim(),
    lastName: (row['Last Name'] || '').toString().trim()
  })).filter(item => item.email && item.email.includes('@'));
  
  console.log(`Parsed ${emailData.length} valid email addresses\n`);
  
  // Get the DHG source
  const { data: dhgSource } = await supabase
    .from('email_sources')
    .select('id')
    .eq('source_code', 'dhg_curated_list')
    .single();
    
  if (!dhgSource) {
    console.error('❌ DHG source not found in database');
    return;
  }
  
  console.log(`Using DHG source ID: ${dhgSource.id}\n`);
  
  // Process each email
  let newEmails = 0;
  let existingEmails = 0;
  let updatedEmails = 0;
  let errors = 0;
  
  for (const importEmail of emailData) {
    try {
      // Check if email already exists (case-insensitive)
      const { data: existingEmail } = await supabase
        .from('auth_allowed_emails')
        .select('id, name, primary_source_id')
        .ilike('email', importEmail.email)
        .single();
        
      if (existingEmail) {
        // Email exists - add DHG as additional source
        existingEmails++;
        
        // Check if association already exists
        const { data: existingAssoc } = await supabase
          .from('email_source_associations')
          .select('id')
          .eq('email_id', existingEmail.id)
          .eq('source_id', dhgSource.id)
          .single();
          
        if (!existingAssoc) {
          // Create new association
          const { error: assocError } = await supabase
            .from('email_source_associations')
            .insert({
              email_id: existingEmail.id,
              source_id: dhgSource.id,
              import_metadata: {
                file: 'Dynamic Healing Group - 5-31-2025.xlsx',
                first_name: importEmail.firstName,
                last_name: importEmail.lastName,
                imported_at: new Date().toISOString()
              }
            });
            
          if (assocError) {
            console.error(`❌ Error associating ${importEmail.email}:`, assocError.message);
            errors++;
          } else {
            // Update source count
            await supabase.rpc('execute_sql', {
              sql_query: `
                UPDATE auth_allowed_emails 
                SET source_count = (
                  SELECT COUNT(DISTINCT source_id) 
                  FROM email_source_associations 
                  WHERE email_id = '${existingEmail.id}'::uuid
                )
                WHERE id = '${existingEmail.id}'::uuid;
              `
            });
            
            updatedEmails++;
            console.log(`✅ Added DHG source to existing: ${importEmail.email}`);
          }
        } else {
          console.log(`⚠️  Already has DHG source: ${importEmail.email}`);
        }
        
        // Update name if not set
        if (!existingEmail.name && (importEmail.firstName || importEmail.lastName)) {
          const fullName = [importEmail.firstName, importEmail.lastName]
            .filter(Boolean)
            .join(' ');
            
          await supabase
            .from('auth_allowed_emails')
            .update({ name: fullName })
            .eq('id', existingEmail.id);
        }
        
      } else {
        // New email - create with DHG as primary source
        const fullName = [importEmail.firstName, importEmail.lastName]
          .filter(Boolean)
          .join(' ');
          
        const { data: newEmailRecord, error: insertError } = await supabase
          .from('auth_allowed_emails')
          .insert({
            email: importEmail.email,
            name: fullName || null,
            primary_source_id: dhgSource.id,
            source_count: 1,
            is_active: true,
            added_at: new Date().toISOString(),
            notes: 'Imported from Dynamic Healing Group curated list'
          })
          .select()
          .single();
          
        if (insertError) {
          console.error(`❌ Error inserting ${importEmail.email}:`, insertError.message);
          errors++;
        } else if (newEmailRecord) {
          // Create source association
          await supabase
            .from('email_source_associations')
            .insert({
              email_id: newEmailRecord.id,
              source_id: dhgSource.id,
              import_metadata: {
                file: 'Dynamic Healing Group - 5-31-2025.xlsx',
                first_name: importEmail.firstName,
                last_name: importEmail.lastName,
                imported_at: new Date().toISOString()
              }
            });
            
          newEmails++;
          console.log(`✅ Created new email: ${importEmail.email}`);
        }
      }
      
    } catch (error) {
      console.error(`❌ Error processing ${importEmail.email}:`, error);
      errors++;
    }
  }
  
  // Final summary
  console.log('\n========== Import Summary ==========');
  console.log(`Total emails in file: ${emailData.length}`);
  console.log(`New emails added: ${newEmails}`);
  console.log(`Existing emails updated: ${updatedEmails}`);
  console.log(`Already had DHG source: ${existingEmails - updatedEmails}`);
  console.log(`Errors: ${errors}`);
  
  // Show final counts
  const { count: totalEmails } = await supabase
    .from('auth_allowed_emails')
    .select('*', { count: 'exact', head: true });
    
  const { count: dhgEmails } = await supabase
    .from('email_source_associations')
    .select('*', { count: 'exact', head: true })
    .eq('source_id', dhgSource.id);
    
  console.log('\n========== Database Status ==========');
  console.log(`Total emails in database: ${totalEmails}`);
  console.log(`Emails with DHG source: ${dhgEmails}`);
  
  // Show some examples of multi-source emails
  const { data: multiSourceEmails } = await supabase
    .from('auth_allowed_emails')
    .select('email, source_count')
    .gt('source_count', 1)
    .limit(5);
    
  if (multiSourceEmails && multiSourceEmails.length > 0) {
    console.log('\nEmails with multiple sources:');
    multiSourceEmails.forEach(e => {
      console.log(`  - ${e.email} (${e.source_count} sources)`);
    });
  }
}

importDHGEmails().catch(console.error).finally(() => process.exit(0));