const { SupabaseClientService } = require('../../../packages/shared/services/supabase-client');

async function associateTemplates() {
  const supabase = SupabaseClientService.getInstance().getClient();
  
  // Get the prompt ID
  const { data: prompt, error: promptError } = await supabase
    .from('ai_prompts')
    .select('id')
    .eq('name', 'document-classification-prompt-new')
    .single();
  
  if (promptError) {
    console.error('Error fetching prompt:', promptError);
    return;
  }
  
  // Get template IDs
  const { data: templates, error: templatesError } = await supabase
    .from('ai_prompt_output_templates')
    .select('id, name');
  
  if (templatesError) {
    console.error('Error fetching templates:', templatesError);
    return;
  }
  
  // Map template names to IDs
  const templateMap = {};
  templates.forEach(template => {
    templateMap[template.name] = template.id;
  });
  
  console.log('Templates available:', Object.keys(templateMap));
  
  // Define template associations with priorities
  const associations = [
    { name: 'core_document_classification', priority: 1 },
    { name: 'concepts_extraction', priority: 2 },
    { name: 'clinical_implications', priority: 3 }
  ];
  
  // Check which associations already exist
  const { data: existingAssociations, error: assocError } = await supabase
    .from('ai_prompt_template_associations')
    .select('template_id')
    .eq('prompt_id', prompt.id);
  
  if (assocError) {
    console.error('Error checking existing associations:', assocError);
    return;
  }
  
  const existingTemplateIds = existingAssociations.map(a => a.template_id);
  console.log('Existing template associations:', existingTemplateIds.length);
  
  // Create associations that don't exist yet
  for (const assoc of associations) {
    const templateId = templateMap[assoc.name];
    if (!templateId) {
      console.warn(`Template '${assoc.name}' not found`);
      continue;
    }
    
    if (existingTemplateIds.includes(templateId)) {
      console.log(`Association for template '${assoc.name}' already exists, updating priority`);
      
      // Update priority
      const { error: updateError } = await supabase
        .from('ai_prompt_template_associations')
        .update({ priority: assoc.priority })
        .eq('prompt_id', prompt.id)
        .eq('template_id', templateId);
      
      if (updateError) {
        console.error(`Error updating association for '${assoc.name}':`, updateError);
      } else {
        console.log(`Updated priority for '${assoc.name}' to ${assoc.priority}`);
      }
    } else {
      console.log(`Creating new association for template '${assoc.name}'`);
      
      // Create new association
      const { error: insertError } = await supabase
        .from('ai_prompt_template_associations')
        .insert({
          prompt_id: prompt.id,
          template_id: templateId,
          priority: assoc.priority
        });
      
      if (insertError) {
        console.error(`Error creating association for '${assoc.name}':`, insertError);
      } else {
        console.log(`Created association for '${assoc.name}' with priority ${assoc.priority}`);
      }
    }
  }
  
  console.log('Template associations updated');
}

// Execute the function
associateTemplates().catch(console.error);