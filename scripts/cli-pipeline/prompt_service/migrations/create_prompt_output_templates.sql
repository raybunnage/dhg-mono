-- Create prompt_output_templates table
CREATE TABLE IF NOT EXISTS prompt_output_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  template JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create prompt_template_associations junction table
CREATE TABLE IF NOT EXISTS prompt_template_associations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id UUID NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES prompt_output_templates(id) ON DELETE CASCADE,
  priority INTEGER NOT NULL DEFAULT 1, -- Lower numbers have higher priority
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Enforce uniqueness of prompt-template pairs
  UNIQUE(prompt_id, template_id)
);

-- Create index on the association table for faster lookups
CREATE INDEX IF NOT EXISTS idx_prompt_template_associations_prompt_id ON prompt_template_associations(prompt_id);
CREATE INDEX IF NOT EXISTS idx_prompt_template_associations_template_id ON prompt_template_associations(template_id);

-- Create index for faster priority-based sorting
CREATE INDEX IF NOT EXISTS idx_prompt_template_associations_priority ON prompt_template_associations(priority);

-- Create some example core templates
INSERT INTO prompt_output_templates (name, description, template)
VALUES 
('core_document_classification', 'Core document classification template with document_type_id, category, etc.', 
'{
  "document_type_id": {
    "description": "UUID of the selected document type",
    "required": true,
    "type": "string"
  },
  "category": {
    "description": "General document category",
    "required": true,
    "type": "string"
  },
  "name": {
    "description": "The specific document type name",
    "required": true,
    "type": "string"
  },
  "suggested_title": {
    "description": "A clear, concise title that accurately represents the document content",
    "required": true,
    "type": "string"
  },
  "classification_confidence": {
    "description": "A number between 0.0 and 1.0 indicating confidence in the classification",
    "required": true,
    "type": "number"
  },
  "classification_reasoning": {
    "description": "Detailed explanation of why this document type was selected",
    "required": true,
    "type": "string"
  },
  "document_summary": {
    "description": "A comprehensive 5-7 paragraph summary of the document",
    "required": true,
    "type": "string"
  },
  "target_audience": {
    "description": "Specific types of healthcare providers who would benefit most from this content",
    "required": true,
    "type": "string"
  },
  "key_topics": {
    "description": "List of the main topics covered in the document",
    "required": true,
    "type": "array",
    "items": {
      "type": "string"
    }
  },
  "unique_insights": {
    "description": "Key insights from the document",
    "required": true,
    "type": "array",
    "items": {
      "type": "string"
    }
  }
}'
),

('concepts_extraction', 'Template for extracting weighted concepts from documents', 
'{
  "concepts": {
    "description": "Key concepts from the document with importance weights",
    "required": true,
    "type": "array",
    "items": {
      "type": "object",
      "properties": {
        "name": {
          "type": "string",
          "description": "Name of the concept"
        },
        "weight": {
          "type": "number",
          "description": "Importance weight (0.0-1.0) of the concept"
        }
      }
    }
  }
}'
),

('powerpoint_specific', 'Extensions specific to PowerPoint presentations', 
'{
  "powerpoint_suggestions": {
    "description": "Suggested slide organization for effective presentation",
    "required": true,
    "type": "array",
    "items": {
      "type": "string"
    }
  },
  "transformative_potential": {
    "description": "How this research might shift understanding or open new therapeutic pathways",
    "required": true,
    "type": "string"
  }
}'
),

('clinical_implications', 'Extensions for clinical implications of research', 
'{
  "clinical_implications": {
    "description": "Specific implications for clinical practice",
    "required": true,
    "type": "array",
    "items": {
      "type": "string"
    }
  },
  "limitations": {
    "description": "Important limitations or contextual factors practitioners should consider",
    "required": true,
    "type": "string"
  }
}'
);




-- Add presentation summary template
INSERT INTO prompt_output_templates (name, description, template)
VALUES 
('presentation_summary', 'Template for generating comprehensive presentation summaries and viewer guides', 
'{
  "title": "An engaging, descriptive title for the presentation",
  "speakerProfile": {
    "name": "Full name of the speaker",
    "title": "Professional title or role",
    "expertise": "Brief description of expertise and what makes them valuable"
  },
  "presentationEssence": {
    "coreTopic": "Main subject or focus of the presentation",
    "uniqueApproach": "What makes this presentation''s perspective distinctive",
    "problemAddressed": "Problem being addressed or opportunity explored",
    "insightSummary": "Summary of the core insight or message"
  },
  "keyTakeaways": [
    "First key insight or actionable advice",
    "Second key insight or actionable advice",
    "Third key insight or actionable advice",
    "Fourth key insight or actionable advice (optional)"
  ],
  "memorableQuotes": [
    {
      "quote": "Direct quote from the speaker",
      "context": "Brief context for the quote"
    },
    {
      "quote": "Another direct quote (optional)",
      "context": "Brief context for the second quote"
    }
  ],
  "discussionHighlights": {
    "exchanges": "Notable exchanges or insights from Q&A",
    "challenges": "Interesting challenges or debates that emerged",
    "additionalContext": "Any additional context from the discussion"
  },
  "whyWatch": {
    "targetAudience": "Who would benefit most from this presentation",
    "uniqueValue": "What distinguishes this from other videos on similar topics"
  },
  "summary": "A vibrant, informative 200-300 word summary that captures the overall presentation, combining elements from all sections above in an engaging narrative format"
}');

INSERT INTO prompt_output_templates (name, description, template)
  VALUES
  ('expert_profile', 'Template for structured expert profiles including credentials and research',
  '{
        "research_summary": "Dr. Carter is a pioneering researcher who first discovered the relationship between oxytocin and social monogamy, as 
  well as its role in adult social bond formation. Her work focuses on understanding the neurobiology of early experience, stress-coping, and 
  love, with particular emphasis on oxytocin pathways. She studies how these systems promote social bonding, parental behavior, and healthy 
  relationships throughout the lifecycle. Her research has been instrumental in establishing the biological foundations of human sociality and
   love, particularly examining the intersections between birth, lactation, and social behavior.",
        "basic_information": {
                "name": "Sue Carter, Ph.D.",
                "title": "Ph.D.",
                "credentials": [
                        "Ph.D.",
                        "Distinguished University Scientist at Indiana University",
                        "Former Executive Director of the Kinsey Institute",
                        "Rudy Professor Emerita of Biology"
                ],
                "institution": "University of Virginia",
                "specialty_areas": [
                        "Neurobiology",
                        "Social Bonding",
                        "Oxytocin Research",
                        "Behavioral Biology",
                        "Reproductive Biology"
                ],
                "current_position": "Professor of Psychology"
        },
        "expertise_keywords": [
                "oxytocin",
                "social bonding",
                "neurobiology",
                "behavioral biology",
                "reproductive biology",
                "attachment",
                "sociostasis"
        ],
        "professional_links": {
                "website_urls": [
                        "[Not provided]"
                ]
        },
        "notable_achievements": [
                "First scientist to discover the relationship between oxytocin and social monogamy",
                "Authored more than 400 publications",
                "Edited 5 books including ''Attachment and Bonding: A New Synthesis'' (MIT Press)",
                "Distinguished University Professor at University of Maryland",
                "Former Executive Director of the Kinsey Institute"
        ]
  }');