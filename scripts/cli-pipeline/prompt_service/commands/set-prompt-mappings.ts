import { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';
import { Database } from '../../../../supabase/types';

interface SetMappingsOptions {
  documentTypes?: string[];
  mimeTypes?: string[];
  priority?: number;
  append?: boolean;
  dryRun?: boolean;
}

export async function setPromptMappingsCommand(
  promptName: string,
  options: SetMappingsOptions
): Promise<void> {
  const supabase = SupabaseClientService.getInstance().getClient() as SupabaseClient<Database>;

  try {
    // Fetch the prompt
    const { data: prompt, error: promptError } = await supabase
      .from('ai_prompts')
      .select('*')
      .eq('name', promptName)
      .single();

    if (promptError || !prompt) {
      console.error(`❌ Prompt not found: ${promptName}`);
      if (promptError) console.error('Error:', promptError.message);
      process.exit(1);
    }

    console.log(`\n📋 Updating mappings for prompt: ${prompt.name}`);
    
    // Prepare updates
    const updates: any = {};
    
    // Handle document types
    if (options.documentTypes && options.documentTypes.length > 0) {
      if (options.append) {
        // Append to existing
        const existing = prompt.supported_document_types || [];
        const combined = [...new Set([...existing, ...options.documentTypes])];
        updates.supported_document_types = combined;
        console.log(`📄 Document types (appending): ${options.documentTypes.join(', ')}`);
      } else {
        // Replace
        updates.supported_document_types = options.documentTypes;
        console.log(`📄 Document types (replacing): ${options.documentTypes.join(', ')}`);
      }
    }

    // Handle MIME types
    if (options.mimeTypes && options.mimeTypes.length > 0) {
      if (options.append) {
        // Append to existing
        const existing = prompt.supported_mime_types || [];
        const combined = [...new Set([...existing, ...options.mimeTypes])];
        updates.supported_mime_types = combined;
        console.log(`📎 MIME types (appending): ${options.mimeTypes.join(', ')}`);
      } else {
        // Replace
        updates.supported_mime_types = options.mimeTypes;
        console.log(`📎 MIME types (replacing): ${options.mimeTypes.join(', ')}`);
      }
    }

    // Handle priority
    if (options.priority !== undefined) {
      updates.priority = options.priority;
      console.log(`⭐ Priority: ${options.priority}`);
    }

    // Check if there are any updates
    if (Object.keys(updates).length === 0) {
      console.log('⚠️  No updates specified');
      return;
    }

    // Show current vs new mappings
    console.log('\n📊 Mapping Changes:');
    console.log('─'.repeat(60));
    
    if (updates.supported_document_types) {
      console.log('Document Types:');
      console.log(`  Current: ${(prompt.supported_document_types || []).join(', ') || 'None'}`);
      console.log(`  New:     ${updates.supported_document_types.join(', ')}`);
    }
    
    if (updates.supported_mime_types) {
      console.log('MIME Types:');
      console.log(`  Current: ${(prompt.supported_mime_types || []).join(', ') || 'None'}`);
      console.log(`  New:     ${updates.supported_mime_types.join(', ')}`);
    }
    
    if (updates.priority !== undefined) {
      console.log('Priority:');
      console.log(`  Current: ${prompt.priority || 0}`);
      console.log(`  New:     ${updates.priority}`);
    }
    
    console.log('─'.repeat(60));

    // Dry run check
    if (options.dryRun) {
      console.log('\n⚠️  Dry run mode - no changes made');
      return;
    }

    // Update the prompt
    const { error: updateError } = await supabase
      .from('ai_prompts')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', prompt.id);

    if (updateError) {
      console.error('❌ Failed to update prompt:', updateError.message);
      process.exit(1);
    }

    console.log('\n✅ Prompt mappings updated successfully!');

    // Verify and show the document types that these mappings cover
    if (updates.supported_document_types && updates.supported_document_types.length > 0) {
      const { data: docTypes, error: docError } = await supabase
        .from('document_types')
        .select('name, description, mime_type')
        .in('name', updates.supported_document_types);

      if (!docError && docTypes && docTypes.length > 0) {
        console.log('\n📚 Covered Document Types:');
        docTypes.forEach(dt => {
          console.log(`   - ${dt.name}: ${dt.description || 'No description'}`);
          if (dt.mime_type) console.log(`     MIME: ${dt.mime_type}`);
        });
      }
    }

  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}