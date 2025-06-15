# Critical Evaluation System for Continuous Development Scenarios

**Version**: 2.0  
**Date**: 2025-06-15  
**Enhancement**: Before/After Critical Analysis

## Core Principle: Question Everything

Every scenario request must survive rigorous evaluation before execution and undergo critical review after completion. The system should actively resist unnecessary complexity and protect the monorepo from bloat.

## Pre-Execution Critical Evaluation (The "Should We?" Gate)

### 1. Necessity Evaluation
```yaml
evaluation_checklist:
  necessity:
    - question: "Does this truly benefit the multi-agent monorepo approach?"
      weight: critical
      checks:
        - "Can existing objects accomplish this goal?"
        - "Would this add unnecessary complexity?"
        - "Is this solving a real problem or creating busy work?"
    
    - question: "Have we searched existing solutions thoroughly?"
      weight: critical
      automated_checks:
        - "grep -r 'similar_functionality' packages/"
        - "Search service registry for related services"
        - "Check CLI pipeline commands for overlap"
        - "Query usage tracking tables for utilization data"
```

### 2. Architecture Fit Evaluation
```yaml
architecture_fit:
  service_analysis:
    - "Is this using the right service pattern (singleton vs DI)?"
    - "Are the proposed services already tested?"
    - "Do test coverage metrics support this approach?"
  
  cli_integration:
    - "Does this truly fit the proposed CLI pipeline?"
    - "Would it be better in an existing pipeline?"
    - "Is the command frequency high enough to justify?"
  
  usage_tracking:
    - "What do usage tables show about similar objects?"
    - "Are we creating something that won't be used?"
    - "Do health metrics indicate problems with current approach?"
```

### 3. Deprecation Opportunity Analysis
```yaml
deprecation_analysis:
  code_removal:
    - "Can we remove/archive existing code instead?"
    - "Would consolidation be better than addition?"
    - "Are there deprecated objects we should eliminate first?"
  
  simplification:
    - "Could we solve this by simplifying existing systems?"
    - "Is this masking a fundamental design issue?"
    - "Would refactoring be more valuable than addition?"
```

## Enhanced Scenario Structure with Critical Gates

```typescript
interface CriticalScenario {
  id: string;
  objectType: ObjectType;
  
  // PRE-EXECUTION GATES
  criticalEvaluation: {
    necessityCheck: NecessityEvaluation;
    architectureFit: ArchitectureEvaluation;
    deprecationAnalysis: DeprecationAnalysis;
    manualCodeSearch: CodeSearchResults;
    signOffRequired: boolean;
  };
  
  // EXECUTION PHASES
  execution: {
    steps: Step[];
    checkpoints: GitCheckpoint[];
    validations: Validation[];
  };
  
  // POST-EXECUTION ANALYSIS
  retrospective: {
    benefitRealization: BenefitAnalysis;
    lessonsLearned: string[];
    betterAlternatives: Alternative[];
    recommendContinuation: boolean;
  };
}
```

## Database Schema for Critical Evaluation

```sql
-- Pre-execution evaluation tracking
CREATE TABLE sys_scenario_evaluations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scenario_request_id UUID NOT NULL,
    evaluation_type TEXT NOT NULL, -- 'necessity', 'architecture', 'deprecation'
    evaluator TEXT NOT NULL, -- 'automated' or user ID
    evaluation_data JSONB NOT NULL,
    decision TEXT CHECK (decision IN ('approve', 'reject', 'needs_review')),
    reasoning TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Code search and analysis results
CREATE TABLE sys_scenario_code_analysis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scenario_request_id UUID NOT NULL,
    search_type TEXT NOT NULL, -- 'similar_code', 'service_usage', 'cli_overlap'
    search_query TEXT NOT NULL,
    results_found INTEGER NOT NULL,
    findings JSONB NOT NULL,
    impact_assessment TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Post-execution retrospectives
CREATE TABLE sys_scenario_retrospectives (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    execution_id UUID REFERENCES sys_scenario_executions(id),
    retrospective_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    benefit_realized TEXT CHECK (benefit_realized IN ('exceeded', 'met', 'partial', 'none')),
    time_investment_justified BOOLEAN,
    complexity_added TEXT CHECK (complexity_added IN ('minimal', 'acceptable', 'concerning', 'excessive')),
    lessons_learned JSONB NOT NULL,
    better_alternatives JSONB,
    recommend_continuation BOOLEAN NOT NULL,
    recommend_deprecation BOOLEAN DEFAULT FALSE,
    evaluator TEXT NOT NULL
);

-- Critical evaluation checklist responses
CREATE TABLE sys_evaluation_checklist_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    evaluation_id UUID REFERENCES sys_scenario_evaluations(id),
    checklist_item TEXT NOT NULL,
    response_type TEXT CHECK (response_type IN ('yes', 'no', 'needs_investigation')),
    evidence TEXT,
    confidence_level INTEGER CHECK (confidence_level BETWEEN 1 AND 10),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

## Automated Critical Analysis Tools

### 1. Code Similarity Detector
```typescript
class CodeSimilarityAnalyzer {
  async analyzeRequest(scenarioRequest: ScenarioRequest): Promise<SimilarityReport> {
    const searches = [
      this.searchExistingServices(scenarioRequest.description),
      this.searchCLICommands(scenarioRequest.proposedCommands),
      this.searchDatabaseTables(scenarioRequest.proposedTables),
      this.analyzeUsagePatterns(scenarioRequest.objectType)
    ];
    
    const results = await Promise.all(searches);
    
    return {
      similarityScore: this.calculateSimilarity(results),
      existingAlternatives: this.identifyAlternatives(results),
      usageJustification: this.analyzeUsageData(results),
      recommendation: this.generateRecommendation(results)
    };
  }
}
```

### 2. Usage Pattern Analyzer
```typescript
class UsagePatternAnalyzer {
  async evaluateNecessity(request: ScenarioRequest): Promise<NecessityEvaluation> {
    // Check actual usage of similar objects
    const usageData = await this.queryUsageTables(request.objectType);
    
    // Analyze health metrics
    const healthMetrics = await this.getHealthMetrics(request.relatedServices);
    
    // Check test coverage
    const testCoverage = await this.analyzeTestCoverage(request.proposedCode);
    
    return {
      usageJustification: this.evaluateUsage(usageData),
      healthConcerns: this.identifyHealthIssues(healthMetrics),
      testingAdequacy: this.evaluateTestCoverage(testCoverage),
      overallRecommendation: this.synthesizeRecommendation([
        usageData, healthMetrics, testCoverage
      ])
    };
  }
}
```

## Critical Evaluation Workflow

### Phase 1: Automated Screening
```yaml
automated_screening:
  similarity_check:
    threshold: 80% # Reject if >80% similar to existing code
    searches:
      - "rg -i 'similar_patterns' packages/"
      - "psql -c 'SELECT * FROM sys_shared_services WHERE description ILIKE %similar%'"
      - "find scripts/ -name '*similar*' -type f"
  
  usage_analysis:
    required_metrics:
      - "Average usage > 10 calls/week for similar objects"
      - "Health score > 70 for related services"
      - "Test coverage > 80% for similar components"
  
  bloat_prevention:
    red_flags:
      - "Creates >3 new files"
      - "Adds >100 lines of configuration"
      - "Requires >2 new dependencies"
```

### Phase 2: Manual Code Review
```typescript
interface ManualReviewChecklist {
  codeSearchFindings: {
    question: "What did manual code search reveal?";
    requiredActions: [
      "grep -r 'proposed_functionality' .",
      "Review similar services in packages/shared/services/",
      "Check CLI commands in scripts/cli-pipeline/",
      "Analyze database usage patterns"
    ];
  };
  
  architecturalFit: {
    question: "Does this fit our architecture principles?";
    criteria: [
      "Follows singleton/DI patterns correctly",
      "Respects worktree boundaries",
      "Maintains test coverage standards",
      "Uses existing infrastructure"
    ];
  };
  
  simplicityTest: {
    question: "Is this the simplest solution?";
    alternatives: [
      "Could we enhance existing code instead?",
      "Would configuration changes suffice?",
      "Can we remove something to make room?",
      "Is this solving the right problem?"
    ];
  };
}
```

### Phase 3: Sign-Off Gate
```yaml
sign_off_criteria:
  technical_signoff:
    - "All automated checks pass"
    - "Manual code review completed"
    - "Alternatives evaluated and documented"
    - "Test coverage plan approved"
  
  architectural_signoff:
    - "Fits multi-agent development model"
    - "Maintains system simplicity"
    - "Provides measurable value"
    - "Has clear deprecation path if needed"
  
  strategic_signoff:
    - "Aligns with monorepo goals"
    - "Resource investment justified"
    - "Maintenance burden acceptable"
    - "User demand validated"
```

## Post-Execution Retrospective System

### Automatic 30-Day Review
```typescript
class ScenarioRetrospectiveManager {
  async scheduleRetrospective(executionId: string): Promise<void> {
    // Schedule automatic review 30 days after completion
    await this.scheduler.schedule({
      date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      action: 'retrospective',
      executionId,
      checklist: this.generateRetrospectiveChecklist(executionId)
    });
  }
  
  async conductRetrospective(executionId: string): Promise<Retrospective> {
    const execution = await this.getExecution(executionId);
    
    return {
      usageAnalysis: await this.analyzeActualUsage(execution),
      complexityImpact: await this.measureComplexityIncrease(execution),
      benefitRealization: await this.evaluateBenefits(execution),
      lessonsLearned: await this.extractLessons(execution),
      recommendation: await this.generateContinuationRecommendation(execution)
    };
  }
}
```

### Retrospective Checklist
```yaml
retrospective_evaluation:
  usage_reality:
    - "Is the created object actually being used?"
    - "How does usage compare to projections?"
    - "What usage patterns emerged that we didn't expect?"
  
  complexity_impact:
    - "Did this add more complexity than anticipated?"
    - "Are there maintenance burdens we didn't foresee?"
    - "How has this affected system health metrics?"
  
  value_delivery:
    - "Did we achieve the intended benefits?"
    - "Were there unexpected benefits or problems?"
    - "Would we make the same decision knowing what we know now?"
  
  alternative_assessment:
    - "Have we discovered better ways to achieve this?"
    - "Would a different approach have been more effective?"
    - "Should we deprecate this in favor of something else?"
```

## Implementation: Checklist Management Strategy

### 1. Database Storage (Primary)
```sql
-- Dynamic checklist system
CREATE TABLE sys_evaluation_checklists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    checklist_type TEXT NOT NULL, -- 'pre_evaluation', 'sign_off', 'retrospective'
    object_type TEXT NOT NULL,
    checklist_version TEXT NOT NULL,
    checklist_data JSONB NOT NULL,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Checklist responses for tracking
CREATE TABLE sys_checklist_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    evaluation_session_id UUID NOT NULL,
    checklist_id UUID REFERENCES sys_evaluation_checklists(id),
    item_key TEXT NOT NULL,
    response JSONB NOT NULL, -- Flexible response format
    evidence_links TEXT[],
    reviewer TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### 2. YAML Configuration (Templates)
```yaml
# checklist-templates/pre-evaluation-service.yaml
checklist:
  name: "Service Creation Pre-Evaluation"
  version: "1.0"
  object_type: "service"
  
  sections:
    necessity:
      weight: critical
      items:
        - id: "existing_search"
          question: "Have you searched for existing similar services?"
          type: "boolean_with_evidence"
          automated_checks:
            - "grep -r 'similar_functionality' packages/shared/services/"
            - "psql query for service registry"
        
        - id: "usage_justification"
          question: "Is there demonstrated need for this service?"
          type: "evidence_required"
          criteria:
            - "User requests or pain points documented"
            - "Usage patterns from existing services justify this"
            - "No simpler solution available"
```

### 3. Living Documentation Integration
```typescript
// Automatic checklist documentation updates
class ChecklistDocumentationManager {
  async updateLivingDocs(checklistResponse: ChecklistResponse): Promise<void> {
    const docPath = `docs/continuous-improvement/evaluation-history/${checklistResponse.scenarioId}.md`;
    
    await this.livingDocsService.updateDocument({
      path: docPath,
      section: 'Critical Evaluation',
      content: this.formatChecklistResults(checklistResponse),
      phase: 'current'
    });
  }
}
```

### 4. Claude Code Integration
```typescript
// Generate Claude Code requests for manual review items
class ClaudeCodeIntegration {
  async generateReviewRequests(evaluation: ScenarioEvaluation): Promise<void> {
    for (const item of evaluation.manualReviewItems) {
      await this.createClaudeCodeRequest({
        title: `Review: ${item.question}`,
        description: this.formatReviewRequest(item),
        checklist: item.automatedChecks,
        context: evaluation.scenarioContext
      });
    }
  }
}
```

### 5. Work Summary Integration
```typescript
// Automatic work summary generation
class WorkSummaryIntegration {
  async createEvaluationSummary(evaluation: ScenarioEvaluation): Promise<void> {
    await this.workSummaryService.add({
      title: `Scenario Evaluation: ${evaluation.scenarioName}`,
      content: this.formatEvaluationSummary(evaluation),
      category: 'evaluation',
      tags: ['continuous-improvement', 'critical-analysis', evaluation.objectType],
      metadata: {
        scenario_id: evaluation.scenarioId,
        decision: evaluation.finalDecision,
        confidence: evaluation.confidenceLevel
      }
    });
  }
}
```

## Viewing and Managing Checklists

### 1. CLI Interface
```bash
# View checklist templates
./continuous-cli.sh checklists list --type pre-evaluation

# Review pending evaluations
./continuous-cli.sh evaluations pending

# Conduct evaluation
./continuous-cli.sh evaluate scenario-request-123 --checklist service-pre-eval

# View retrospective schedules
./continuous-cli.sh retrospectives scheduled
```

### 2. Dashboard Views
```sql
-- Evaluation dashboard
CREATE VIEW sys_evaluation_dashboard_view AS
SELECT 
    sr.scenario_name,
    sr.object_type,
    se.evaluation_type,
    se.decision,
    COUNT(ecr.*) as checklist_items_completed,
    AVG(ecr.confidence_level) as avg_confidence,
    se.created_at
FROM sys_scenario_requests sr
JOIN sys_scenario_evaluations se ON sr.id = se.scenario_request_id
LEFT JOIN sys_evaluation_checklist_responses ecr ON se.id = ecr.evaluation_id
GROUP BY sr.scenario_name, sr.object_type, se.evaluation_type, se.decision, se.created_at
ORDER BY se.created_at DESC;
```

### 3. Continuous Improvement Analytics
```sql
-- Learn from evaluation patterns
CREATE VIEW sys_evaluation_learnings_view AS
SELECT 
    object_type,
    COUNT(*) FILTER (WHERE decision = 'reject') as rejections,
    COUNT(*) FILTER (WHERE decision = 'approve') as approvals,
    AVG(CASE WHEN decision = 'reject' THEN 1 ELSE 0 END) as rejection_rate,
    ARRAY_AGG(DISTINCT reasoning) as common_rejection_reasons
FROM sys_scenario_evaluations
GROUP BY object_type;
```

This critical evaluation system ensures that every scenario request is thoroughly vetted, every execution is carefully monitored, and every outcome is critically analyzed. It builds institutional learning while protecting the monorepo from unnecessary complexity and bloat.
