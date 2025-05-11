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