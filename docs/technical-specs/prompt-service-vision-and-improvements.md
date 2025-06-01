# Prompt Service Vision and Improvements

## Executive Summary

The prompt service is a critical component that bridges document classification with AI analysis, enabling sophisticated content extraction and learning system capabilities. This document outlines the current state, identifies improvement opportunities, and proposes enhancements to create a flexible, sophisticated prompt management system that can power document analysis, learning pathways, and research collaboration.

## Current State Analysis

### Existing Architecture

#### 1. Database Schema (AI-Prefixed Tables)
- **ai_prompts**: Core prompt storage with metadata, versioning, and status tracking
- **ai_prompt_categories**: Hierarchical categorization system
- **ai_prompt_relationships**: Links prompts to assets, documents, and other resources
- **ai_prompt_output_templates**: JSON templates for structured output formatting
- **ai_prompt_template_associations**: Maps prompts to their output templates

#### 2. Key Relationships
- `ai_prompts.document_type_id` → `document_types.id` (Direct mapping)
- `ai_prompt_relationships.document_type_id` → `document_types.id` (Additional context)
- Mime type to prompt mapping in `UnifiedClassificationService`

#### 3. Current Service Implementation
```typescript
// Prompt Service features:
- Dual loading: Database-first, filesystem fallback
- Metadata extraction from prompt content
- Relationship management for related assets
- Database query execution within prompts
- Combined content generation for Claude
- Output template integration
```

### Strengths of Current Design

1. **Flexibility**: Can load prompts from database or filesystem
2. **Rich Metadata**: Supports extensive metadata including AI engine config, usage schemas, related assets
3. **Database Integration**: Prompts can execute SQL queries to enrich context
4. **Relationship System**: Can link prompts to multiple resources
5. **Template System**: Structured output formatting via templates

### Areas for Improvement

1. **Dynamic Prompt Generation**: Limited support for runtime prompt composition
2. **Cascading Analysis**: No built-in support for multi-stage analysis pipelines
3. **Context Aggregation**: Limited ability to combine multiple document analyses
4. **Version Control**: Basic versioning without branching/merging capabilities
5. **Performance Monitoring**: No metrics on prompt effectiveness or cost tracking
6. **Prompt Chaining**: No native support for sequential prompt execution

## Vision for Enhanced Prompt Service

### Core Principles

1. **Document-Type Driven**: Each document type should have specialized prompts optimized for its content structure
2. **Composable**: Prompts should be modular and combinable for complex analysis tasks
3. **Context-Aware**: Prompts should access relevant context from related documents and analyses
4. **Performance-Tracked**: Monitor effectiveness, cost, and quality metrics
5. **Learning-Optimized**: Support educational pathways and concept extraction

### Proposed Architecture Enhancements

#### 1. Enhanced Prompt Types

```sql
-- Add to ai_prompts table
ALTER TABLE ai_prompts ADD COLUMN prompt_type TEXT DEFAULT 'standard';
-- Types: 'standard', 'composite', 'dynamic', 'pipeline', 'aggregation'

ALTER TABLE ai_prompts ADD COLUMN performance_metrics JSONB DEFAULT '{}';
-- Metrics: success_rate, avg_cost, avg_tokens, quality_scores

ALTER TABLE ai_prompts ADD COLUMN context_requirements JSONB DEFAULT '{}';
-- Requirements: required_fields, optional_context, prerequisite_analyses
```

#### 2. Prompt Execution Pipeline

```sql
CREATE TABLE ai_prompt_pipelines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    stages JSONB NOT NULL, -- Array of stage definitions
    context_passing JSONB, -- How context flows between stages
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE ai_prompt_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prompt_id UUID REFERENCES ai_prompts(id),
    pipeline_id UUID REFERENCES ai_prompt_pipelines(id),
    document_id UUID, -- Can reference various document tables
    execution_context JSONB,
    input_tokens INTEGER,
    output_tokens INTEGER,
    cost_estimate DECIMAL(10,4),
    execution_time_ms INTEGER,
    result JSONB,
    quality_score DECIMAL(3,2),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 3. Dynamic Context System

```sql
CREATE TABLE ai_prompt_context_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prompt_id UUID REFERENCES ai_prompts(id),
    source_type TEXT NOT NULL, -- 'query', 'document', 'analysis', 'external'
    source_config JSONB NOT NULL,
    is_required BOOLEAN DEFAULT false,
    max_tokens INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Example source_config for different types:
-- Query: { "sql": "SELECT * FROM ...", "parameters": {...} }
-- Document: { "document_type": "...", "filters": {...}, "limit": 5 }
-- Analysis: { "analysis_type": "...", "recency": "7 days" }
```

#### 4. Prompt Composition System

```typescript
interface PromptComposition {
  basePrompt: string;
  contextSections: {
    name: string;
    source: 'query' | 'document' | 'analysis' | 'static';
    content: string | (() => Promise<string>);
    maxTokens?: number;
    required: boolean;
  }[];
  outputTemplate: string;
  validationSchema?: object;
}
```

### Advanced Features

#### 1. Multi-Stage Analysis Pipeline

```typescript
// Example: Scientific Paper Analysis Pipeline
const scientificPaperPipeline = {
  name: "scientific-paper-comprehensive",
  stages: [
    {
      name: "initial-classification",
      promptId: "scientific-document-classification",
      outputs: ["document_type", "research_domain", "methodology"]
    },
    {
      name: "concept-extraction",
      promptId: "scientific-concept-extraction",
      inputs: ["research_domain", "methodology"],
      outputs: ["key_concepts", "hypotheses", "findings"]
    },
    {
      name: "cross-reference",
      promptId: "scientific-cross-reference",
      inputs: ["key_concepts"],
      contextSources: ["related_papers_query"],
      outputs: ["related_works", "novel_contributions"]
    },
    {
      name: "learning-path-integration",
      promptId: "learning-path-mapper",
      inputs: ["key_concepts", "findings"],
      outputs: ["learning_objectives", "prerequisite_concepts"]
    }
  ]
};
```

#### 2. Intelligent Prompt Selection

```typescript
class PromptSelector {
  async selectOptimalPrompt(
    document: Document,
    analysisGoal: string
  ): Promise<PromptSelection> {
    // Consider:
    // 1. Document mime type and content structure
    // 2. Previous analysis results
    // 3. User's learning profile and goals
    // 4. Performance metrics of similar analyses
    // 5. Cost constraints
    
    const candidates = await this.getCandidatePrompts(document);
    const scored = await this.scorePrompts(candidates, {
      document,
      goal: analysisGoal,
      historicalPerformance: true,
      costWeight: 0.3,
      qualityWeight: 0.7
    });
    
    return scored[0];
  }
}
```

#### 3. Concept Network Building

```sql
CREATE TABLE ai_extracted_concepts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_document_id UUID NOT NULL,
    concept_name TEXT NOT NULL,
    concept_type TEXT, -- 'theory', 'method', 'finding', 'application'
    confidence DECIMAL(3,2),
    context TEXT,
    related_concepts JSONB, -- Array of related concept IDs with relationship types
    extracted_at TIMESTAMPTZ DEFAULT NOW(),
    extraction_prompt_id UUID REFERENCES ai_prompts(id)
);

CREATE TABLE ai_concept_relationships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    concept_a_id UUID REFERENCES ai_extracted_concepts(id),
    concept_b_id UUID REFERENCES ai_extracted_concepts(id),
    relationship_type TEXT, -- 'prerequisite', 'supports', 'contradicts', 'extends'
    strength DECIMAL(3,2),
    evidence JSONB, -- Source documents and contexts
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 4. Learning Path Generation

```typescript
interface LearningPathGenerator {
  async generatePath(
    targetConcepts: string[],
    userProfile: UserProfile
  ): Promise<LearningPath> {
    // 1. Identify prerequisite concepts
    const prerequisites = await this.identifyPrerequisites(targetConcepts);
    
    // 2. Find optimal document sequence
    const documentSequence = await this.optimizeDocumentSequence({
      concepts: [...prerequisites, ...targetConcepts],
      userLevel: userProfile.currentLevel,
      preferredFormats: userProfile.preferredFormats
    });
    
    // 3. Generate milestone assessments
    const milestones = await this.generateMilestones(documentSequence);
    
    return {
      path: documentSequence,
      estimatedDuration: this.estimateDuration(documentSequence, userProfile),
      milestones,
      adaptationPoints: this.identifyAdaptationPoints(documentSequence)
    };
  }
}
```

### Implementation Recommendations

#### Phase 1: Foundation (Weeks 1-2)
1. Add new columns to existing tables (prompt_type, performance_metrics, context_requirements)
2. Create pipeline and execution tracking tables
3. Implement basic prompt composition in the service
4. Add performance metric collection

#### Phase 2: Enhanced Features (Weeks 3-4)
1. Implement multi-stage pipeline execution
2. Build intelligent prompt selection
3. Create context aggregation system
4. Add cost tracking and optimization

#### Phase 3: Advanced Capabilities (Weeks 5-6)
1. Implement concept extraction and relationship mapping
2. Build learning path generation
3. Create cross-document analysis capabilities
4. Add research collaboration features

#### Phase 4: UI Integration (Week 7)
1. Build CRUD interface in dhg-admin-code
2. Add pipeline visualization
3. Create performance dashboards
4. Implement prompt testing interface

### Database Schema Updates

```sql
-- Core enhancements to ai_prompts
ALTER TABLE ai_prompts 
ADD COLUMN prompt_type TEXT DEFAULT 'standard',
ADD COLUMN performance_metrics JSONB DEFAULT '{}',
ADD COLUMN context_requirements JSONB DEFAULT '{}',
ADD COLUMN estimated_cost_per_use DECIMAL(10,4),
ADD COLUMN average_quality_score DECIMAL(3,2),
ADD COLUMN total_executions INTEGER DEFAULT 0;

-- Create indexes for performance
CREATE INDEX idx_ai_prompts_type ON ai_prompts(prompt_type);
CREATE INDEX idx_ai_prompts_document_type ON ai_prompts(document_type_id);
CREATE INDEX idx_prompt_performance ON ai_prompts((performance_metrics->>'success_rate')::float DESC);

-- Add cascade analysis support
ALTER TABLE ai_prompt_relationships
ADD COLUMN execution_order INTEGER DEFAULT 0,
ADD COLUMN pass_output_to_next BOOLEAN DEFAULT false,
ADD COLUMN transformation_function TEXT;
```

### Service Interface Enhancements

```typescript
interface EnhancedPromptService {
  // Existing methods remain unchanged
  
  // New methods for advanced features
  async executePromptPipeline(
    pipelineId: string,
    context: PipelineContext
  ): Promise<PipelineResult>;
  
  async selectOptimalPrompt(
    document: Document,
    goal: AnalysisGoal
  ): Promise<PromptSelection>;
  
  async aggregateAnalyses(
    documentIds: string[],
    aggregationType: AggregationType
  ): Promise<AggregatedAnalysis>;
  
  async trackExecution(
    promptId: string,
    execution: ExecutionMetrics
  ): Promise<void>;
  
  async generateDynamicPrompt(
    template: string,
    context: DynamicContext
  ): Promise<string>;
  
  async extractConcepts(
    documentId: string,
    options: ConceptExtractionOptions
  ): Promise<ExtractedConcepts>;
}
```

### Success Metrics

1. **Performance Metrics**
   - Average prompt execution time < 5 seconds
   - Prompt selection accuracy > 85%
   - Cost per analysis reduced by 30%
   
2. **Quality Metrics**
   - Concept extraction precision > 80%
   - Learning path relevance score > 4.5/5
   - Cross-reference accuracy > 75%
   
3. **Usage Metrics**
   - Pipeline completion rate > 90%
   - User satisfaction with extracted insights > 4/5
   - Time to insight reduced by 50%

### Conclusion

The enhanced prompt service will transform from a simple prompt storage system into an intelligent analysis orchestrator. By implementing document-type-specific prompts, multi-stage pipelines, and concept extraction, we create a foundation for sophisticated learning systems and research collaboration tools. The phased implementation ensures we can deliver value incrementally while building toward the full vision.

Key benefits:
- **Flexibility**: Adapt to any document type or analysis goal
- **Intelligence**: Learn from past executions to improve quality
- **Scalability**: Handle complex multi-document analyses efficiently
- **Learning-Oriented**: Extract concepts and build knowledge graphs
- **Cost-Effective**: Optimize token usage and API calls

This enhanced system positions the platform to deliver unique value in educational content analysis and research collaboration.