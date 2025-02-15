import { supabase } from '@/integrations/supabase/client';

interface ExpertProfile {
  name: string;
  specialties?: string[];
  education?: string[];
  experience?: string;
  bio?: string;
}

export async function processDocumentWithAI(documentId: string): Promise<ExpertProfile> {
  if (!import.meta.env.VITE_ANTHROPIC_API_KEY) {
    throw new Error('VITE_ANTHROPIC_API_KEY is not set in environment variables');
  }

  console.log('Starting AI processing for document:', documentId);
  
  // 1. Get document content
  const { data: doc, error: docError } = await supabase
    .from('expert_documents')
    .select(`
      id,
      raw_content,
      source:source_id (
        name,
        mime_type
      )
    `)
    .eq('id', documentId)
    .single();

  if (docError) {
    console.error('Database error:', docError);
    throw new Error(`Failed to fetch document: ${docError.message}`);
  }
  if (!doc) throw new Error('Document not found');

  console.log('Retrieved document:', {
    id: doc.id,
    sourceName: doc.source?.name,
    contentLength: doc.raw_content?.length
  });

  // 2. Prepare prompt for Claude
  const prompt = `
    Please analyze this document about a medical expert and extract the following information in JSON format:
    - name: The expert's full name
    - specialties: Array of their specialties/expertise areas
    - education: Array of their educational background
    - experience: Text describing their professional experience
    - bio: A brief professional biography

    Document content:
    ${doc.raw_content}

    Please respond with only the JSON object containing these fields. If a field cannot be determined, omit it from the JSON.
  `;

  try {
    // 3. Call Claude API
    console.log('Calling Claude API...');
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': import.meta.env.VITE_ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: "claude-3-sonnet-20241022",
        messages: [
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 1000,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Claude API error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      });
      throw new Error(`AI API error: ${errorText}`);
    }

    const aiResponse = await response.json();
    console.log('Claude response:', aiResponse);

    const expertProfile: ExpertProfile = JSON.parse(aiResponse.content[0].text);
    console.log('Parsed expert profile:', expertProfile);

    // 4. Update experts table
    const { error: updateError } = await supabase
      .from('experts')
      .upsert({
        name: expertProfile.name,
        specialties: expertProfile.specialties,
        education: expertProfile.education,
        experience: expertProfile.experience,
        bio: expertProfile.bio,
        updated_at: new Date().toISOString()
      });

    if (updateError) {
      console.error('Database update error:', updateError);
      throw new Error(`Failed to update expert profile: ${updateError.message}`);
    }

    return expertProfile;
  } catch (error) {
    console.error('AI processing error:', error);
    throw error;
  }
} 