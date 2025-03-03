import { supabase } from '@/integrations/supabase/client';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
});

export async function processExpertDocument(req, res) {
  try {
    const { documentId } = req.body;
    
    if (!documentId) {
      return res.status(400).json({ error: 'Document ID is required' });
    }
    
    // Get the document
    const { data: document, error: docError } = await supabase
      .from('experts_documents')
      .select('*')
      .eq('id', documentId)
      .single();
      
    if (docError) {
      return res.status(404).json({ error: 'Document not found' });
    }
    
    if (!document.raw_content) {
      return res.status(400).json({ error: 'Document has no content to process' });
    }
    
    // Update status to processing
    await supabase
      .from('experts_documents')
      .update({ processing_status: 'processing' })
      .eq('id', documentId);
    
    // Process the document with the expert profile extractor
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4-0125-preview",
        messages: [
          {
            role: "system",
            content: `You are an expert profile extractor. Your task is to extract structured information about an expert from the provided text. 
            Extract as much detail as possible and organize it into a structured JSON format with the following fields:
            
            {
              "name": "Full name of the expert",
              "title": "Professional title or position",
              "affiliations": ["List of organizations they are affiliated with"],
              "contact": {
                "email": "Email address if available",
                "phone": "Phone number if available",
                "website": "Personal or professional website"
              },
              "expertise": ["List of areas of expertise"],
              "education": [
                {
                  "institution": "Name of institution",
                  "degree": "Degree obtained",
                  "field": "Field of study",
                  "year": "Year of graduation"
                }
              ],
              "experience": [
                {
                  "organization": "Name of organization",
                  "role": "Position or role",
                  "duration": "Time period",
                  "description": "Brief description of responsibilities"
                }
              ],
              "publications": [
                {
                  "title": "Title of publication",
                  "year": "Year published",
                  "journal": "Journal or publisher",
                  "authors": ["List of authors"],
                  "url": "URL if available"
                }
              ],
              "awards": [
                {
                  "title": "Name of award",
                  "year": "Year received",
                  "organization": "Awarding organization"
                }
              ],
              "languages": ["Languages spoken"],
              "skills": ["Technical or professional skills"],
              "interests": ["Research or professional interests"],
              "bio": "A complete biography paragraph",
              "research_areas": ["Specific research areas"],
              "social_media": {
                "linkedin": "LinkedIn URL",
                "twitter": "Twitter/X URL",
                "github": "GitHub URL",
                "other": {
                  "platform_name": "URL"
                }
              }
            }
            
            Fill in as many fields as possible based on the provided text. If information for a field is not available, leave it out of the JSON entirely (do not include null or empty values). Focus on accuracy and completeness.`
          },
          {
            role: "user",
            content: document.raw_content
          }
        ],
        temperature: 0.2,
        response_format: { type: "json_object" }
      });
      
      const processedContent = JSON.parse(response.choices[0].message.content);
      
      // Update the document with the processed content
      const { error: updateError } = await supabase
        .from('experts_documents')
        .update({ 
          processed_content: processedContent,
          processing_status: 'completed',
          extraction_date: new Date().toISOString()
        })
        .eq('id', documentId);
        
      if (updateError) {
        throw updateError;
      }
      
      // Update expert record with extracted information if applicable
      if (processedContent) {
        const expertUpdateData: any = {};
        
        if (processedContent.name && !processedContent.name.includes("not available")) {
          expertUpdateData.full_name = processedContent.name;
        }
        
        if (processedContent.bio && processedContent.bio.length > 10) {
          expertUpdateData.bio = processedContent.bio;
        }
        
        if (processedContent.expertise && processedContent.expertise.length > 0) {
          expertUpdateData.expertise_area = processedContent.expertise.join(', ');
        }
        
        if (processedContent.contact && processedContent.contact.email) {
          expertUpdateData.email_address = processedContent.contact.email;
        }
        
        if (Object.keys(expertUpdateData).length > 0) {
          await supabase
            .from('experts')
            .update(expertUpdateData)
            .eq('id', document.expert_id);
        }
      }
      
      return res.status(200).json({ success: true, data: processedContent });
    } catch (aiError) {
      console.error('AI processing error:', aiError);
      
      // Update document status to failed
      await supabase
        .from('experts_documents')
        .update({ 
          processing_status: 'failed',
          extraction_date: new Date().toISOString()
        })
        .eq('id', documentId);
        
      return res.status(500).json({ error: 'Failed to process document with AI' });
    }
  } catch (error) {
    console.error('Error processing expert document:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}