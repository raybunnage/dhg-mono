# Learning Interest Matching System - Technical Specification

## Executive Summary

This document outlines the technical methodology for developing a comprehensive learning interest matching system that effectively connects users with relevant presentations from a library of 117 educational sessions. The system aims to create a sophisticated taxonomy and matching algorithm that bridges user learning objectives with available content.

## System Overview

### Core Challenge
- 117 presentations (1-hour each: 40 minutes lecture, 20 minutes discussion)
- Need to match user learning interests with appropriate content
- Critical for product success and user engagement
- Existing assets: audio transcripts and AI-generated summaries

### Key Objectives
1. Develop comprehensive learning interest taxonomy
2. Create sophisticated user profiling system
3. Build intelligent content matching algorithm
4. Enable personalized learning path generation

## Methodology

### 1. Content Analysis & Topic Extraction

#### 1.1 Deep Content Mining

**Entity Extraction**
- Utilize NLP models to extract:
  - Medical/scientific entities
  - Conditions and diseases
  - Treatment methodologies
  - Research techniques
  - Theoretical concepts

**Recommended Tools:**
- spaCy with scispaCy for medical entity recognition
- BioBERT for biomedical text mining
- Custom NER models trained on domain-specific data

**Concept Clustering**
- Generate embeddings using sentence transformers
- Apply clustering algorithms (K-means, DBSCAN)
- Identify natural topic groupings
- Map conceptual relationships

**Frequency Analysis**
- Track topic occurrence across presentations
- Identify core themes (high frequency)
- Isolate specialized topics (low frequency)
- Calculate topic co-occurrence patterns

**Dependency Mapping**
- Identify prerequisite relationships
- Build knowledge dependency graph
- Map complexity progression
- Define learning sequences

#### 1.2 Hierarchical Taxonomy Development

```
Root
├── Clinical Domains
│   ├── Neurological Conditions
│   │   ├── Autism Spectrum Disorders
│   │   │   ├── Pathophysiology
│   │   │   ├── Biomarkers
│   │   │   └── Interventions
│   │   ├── Chronic Fatigue Syndrome
│   │   └── Neurodegenerative Diseases
│   ├── Metabolic Disorders
│   │   ├── Mitochondrial Dysfunction
│   │   ├── Energy Metabolism
│   │   └── Oxidative Stress
│   └── Immune System Disorders
│       ├── Autoimmune Conditions
│       └── Inflammatory Responses
├── Research Methodologies
│   ├── Laboratory Techniques
│   │   ├── Metabolomics
│   │   ├── Proteomics
│   │   └── Genomics
│   ├── Clinical Research
│   │   ├── Study Design
│   │   ├── Data Analysis
│   │   └── Outcome Measures
│   └── Systems Biology Approaches
├── Theoretical Frameworks
│   ├── Cell Danger Response
│   ├── Metabolic Switching
│   ├── Systems Medicine
│   └── Precision Medicine
└── Clinical Applications
    ├── Diagnostic Protocols
    ├── Treatment Planning
    ├── Patient Management
    └── Integrative Approaches
```

### 2. Multi-Dimensional Tagging System

#### 2.1 Dimension Definitions

| Dimension | Description | Example Values |
|-----------|-------------|----------------|
| **Topic/Subject** | Primary content area | Mitochondrial medicine, Autism research |
| **Application Context** | Where/how knowledge is applied | Clinical practice, Research, Education |
| **Complexity Level** | Depth and sophistication | Beginner (1-3), Intermediate (4-6), Advanced (7-9), Expert (10) |
| **Approach Type** | Theoretical vs. practical focus | Theory-heavy, Balanced, Practice-focused |
| **Evidence Level** | Research maturity | Emerging, Established, Controversial |
| **Patient Population** | Relevant demographics | Pediatric, Adult, Geriatric, General |
| **Temporal Relevance** | Currency of information | Historical context, Current standard, Cutting-edge |
| **Learning Modality** | Presentation style | Lecture, Case study, Interactive, Mixed |

#### 2.2 Implementation Schema

```json
{
  "tagSchema": {
    "version": "1.0",
    "dimensions": {
      "topics": {
        "type": "hierarchical",
        "multiple": true,
        "required": true
      },
      "applicationContext": {
        "type": "categorical",
        "multiple": true,
        "required": true
      },
      "complexity": {
        "type": "numeric",
        "range": [1, 10],
        "required": true
      },
      "approach": {
        "type": "scale",
        "range": ["theoretical", "balanced", "practical"],
        "required": true
      },
      "evidenceLevel": {
        "type": "categorical",
        "options": ["emerging", "developing", "established", "controversial"],
        "required": false
      },
      "patientPopulation": {
        "type": "categorical",
        "multiple": true,
        "required": false
      },
      "temporalRelevance": {
        "type": "categorical",
        "options": ["historical", "current", "emerging", "future"],
        "required": true
      }
    }
  }
}
```

### 3. Presentation Fingerprinting

#### 3.1 Fingerprint Structure

```javascript
const presentationFingerprint = {
  // Identification
  presentationId: "string",
  title: "string",
  presenter: "string",
  duration: "number", // in minutes
  recordingDate: "ISO 8601 date",
  
  // Content Classification
  primaryTopics: ["array", "of", "main", "topics"],
  secondaryTopics: ["supporting", "topics"],
  tertiaryMentions: ["briefly", "mentioned", "topics"],
  
  // Knowledge Requirements
  prerequisiteKnowledge: {
    required: ["essential", "prerequisites"],
    recommended: ["helpful", "background"],
    complexity: 7.5 // 1-10 scale
  },
  
  // Learning Outcomes
  conceptsIntroduced: ["new", "concepts", "taught"],
  skillsDeveloped: ["practical", "skills"],
  applicationsDiscussed: ["real-world", "uses"],
  
  // Relationships
  buildsupon: ["presentation-ids"], // Prerequisites
  complementedBy: ["presentation-ids"], // Related content
  advancedBy: ["presentation-ids"], // Follow-up content
  
  // Metadata
  targetAudience: ["clinicians", "researchers", "students"],
  learningObjectives: ["specific", "goals"],
  keyTakeaways: ["main", "points"],
  
  // Engagement Metrics
  estimatedEngagement: "high|medium|low",
  interactivityLevel: 0.3, // 0-1 scale
  practicalExamples: 5, // count
  
  // Search Optimization
  keywords: ["search", "terms"],
  semanticEmbedding: [/* 768-dimensional vector */]
};
```

#### 3.2 Fingerprint Generation Process

1. **Automated Extraction**
   - Process transcripts with NLP pipeline
   - Extract entities, concepts, and relationships
   - Generate embeddings for semantic search

2. **AI-Assisted Enhancement**
   - Use LLM to identify learning objectives
   - Extract key takeaways and summaries
   - Identify prerequisite knowledge

3. **Manual Validation**
   - Expert review of automated tags
   - Correction of misclassifications
   - Addition of nuanced metadata

### 4. Dynamic Interest Profiling

#### 4.1 Progressive Interest Collection

**Stage 1: Broad Domain Selection**
```javascript
const domainSelection = {
  prompt: "Which areas of medicine interest you most?",
  options: [
    {
      id: "clinical-practice",
      label: "Clinical Practice",
      description: "Patient care and treatment approaches"
    },
    {
      id: "research-methods",
      label: "Research Methods",
      description: "Scientific investigation techniques"
    },
    {
      id: "theoretical-foundations",
      label: "Theoretical Foundations",
      description: "Underlying scientific concepts"
    }
  ],
  multiple: true,
  required: true
};
```

**Stage 2: Specific Topic Refinement**
```javascript
const topicRefinement = (selectedDomains) => {
  const relevantTopics = topicHierarchy
    .filter(topic => selectedDomains.includes(topic.domain))
    .map(topic => ({
      ...topic,
      children: topic.children.filter(child => 
        child.relevanceScore > 0.7
      )
    }));
  
  return {
    prompt: "Select specific topics within your areas of interest:",
    options: relevantTopics,
    multiple: true,
    hierarchical: true,
    searchable: true
  };
};
```

**Stage 3: Learning Objective Specification**
```javascript
const learningObjectives = {
  prompt: "What do you hope to achieve?",
  options: [
    "Gain foundational understanding",
    "Update existing knowledge",
    "Learn practical applications",
    "Explore cutting-edge research",
    "Prepare for specific cases",
    "Develop new skills"
  ],
  multiple: true,
  allowCustom: true
};
```

**Stage 4: Knowledge Gap Identification**
```javascript
const knowledgeAssessment = {
  currentLevel: {
    prompt: "Rate your current knowledge in selected areas:",
    type: "scale",
    range: [1, 10],
    labels: {
      1: "No prior knowledge",
      5: "Some familiarity",
      10: "Expert level"
    }
  },
  specificGaps: {
    prompt: "What specific questions do you need answered?",
    type: "freeText",
    optional: true,
    examples: [
      "How do mitochondrial disorders affect autism?",
      "What are the latest biomarkers for CFS?"
    ]
  }
};
```

#### 4.2 Enhanced Profile Schema

```typescript
interface EnhancedUserProfile {
  // Basic Information
  basicInfo: {
    profession: string;
    professionalTitle: string;
    yearsExperience: number;
    industrySectors: string[];
    specialtyAreas: string[];
    credentials: string[];
  };
  
  // Learning Interests
  interests: {
    primaryDomains: Domain[];
    specificTopics: Topic[];
    avoidedTopics: Topic[];
    interestedExperts: string[];
    followingTags: string[];
  };
  
  // Learning Context
  context: {
    objectives: LearningObjective[];
    motivations: string[];
    challenges: string[];
    timeframe: string;
    applicationContext: ApplicationContext[];
  };
  
  // Learning Preferences
  preferences: {
    complexity: ComplexityPreference;
    format: FormatPreference[];
    pace: LearningPace;
    sessionLength: number;
    interactivityLevel: number;
  };
  
  // Knowledge State
  knowledge: {
    selfAssessment: Map<Topic, number>;
    completedPresentations: string[];
    inProgressPresentations: string[];
    savedPresentations: string[];
  };
  
  // Behavioral Data
  behavior: {
    engagementPatterns: EngagementMetrics;
    completionRates: Map<Topic, number>;
    feedbackHistory: Feedback[];
    searchHistory: SearchQuery[];
  };
}
```

### 5. Matching Algorithm Development

#### 5.1 Core Matching Algorithm

```javascript
class PresentationMatcher {
  constructor(userProfile, presentations, config) {
    this.userProfile = userProfile;
    this.presentations = presentations;
    this.config = config;
    this.weights = {
      directTopicMatch: 0.40,
      relatedConcepts: 0.20,
      learningPathCoherence: 0.15,
      complexityAlignment: 0.15,
      applicationRelevance: 0.10
    };
  }
  
  calculateMatchScore(presentation) {
    const scores = {
      directTopic: this.calculateDirectTopicScore(presentation),
      relatedConcepts: this.calculateRelatedConceptScore(presentation),
      pathCoherence: this.calculatePathCoherenceScore(presentation),
      complexity: this.calculateComplexityScore(presentation),
      application: this.calculateApplicationScore(presentation)
    };
    
    return this.weightedAverage(scores, this.weights);
  }
  
  calculateDirectTopicScore(presentation) {
    const userTopics = new Set(this.userProfile.interests.specificTopics);
    const presentationTopics = new Set([
      ...presentation.primaryTopics,
      ...presentation.secondaryTopics
    ]);
    
    const intersection = new Set(
      [...userTopics].filter(x => presentationTopics.has(x))
    );
    
    const primaryBonus = presentation.primaryTopics
      .filter(t => userTopics.has(t)).length * 0.2;
    
    return (intersection.size / userTopics.size) + primaryBonus;
  }
  
  calculateRelatedConceptScore(presentation) {
    // Use semantic embeddings to find conceptually related content
    const userEmbedding = this.getUserInterestEmbedding();
    const presentationEmbedding = presentation.semanticEmbedding;
    
    return this.cosineSimilarity(userEmbedding, presentationEmbedding);
  }
  
  calculatePathCoherenceScore(presentation) {
    const completed = this.userProfile.knowledge.completedPresentations;
    const prerequisites = presentation.prerequisiteKnowledge.required;
    
    const prerequisitesMet = prerequisites.every(prereq => 
      this.isPrerequisiteMet(prereq, completed)
    );
    
    const buildsOnCompleted = presentation.buildsupon
      .filter(id => completed.includes(id)).length;
    
    return prerequisitesMet ? 0.8 + (buildsOnCompleted * 0.1) : 0.3;
  }
  
  calculateComplexityScore(presentation) {
    const userLevel = this.userProfile.preferences.complexity;
    const presentationLevel = presentation.prerequisiteKnowledge.complexity;
    
    const distance = Math.abs(userLevel - presentationLevel);
    return Math.max(0, 1 - (distance / 10));
  }
  
  calculateApplicationScore(presentation) {
    const userContext = new Set(this.userProfile.context.applicationContext);
    const presentationContext = new Set(presentation.applicationsDiscussed);
    
    const overlap = [...userContext]
      .filter(x => presentationContext.has(x)).length;
    
    return overlap / Math.max(userContext.size, 1);
  }
}
```

#### 5.2 Learning Path Generation

```javascript
class LearningPathGenerator {
  constructor(matcher, presentations) {
    this.matcher = matcher;
    this.presentations = presentations;
    this.dependencyGraph = this.buildDependencyGraph(presentations);
  }
  
  generateOptimalPath(userProfile, constraints) {
    const {
      maxPresentations = 10,
      timeframe = '3months',
      sessionFrequency = 'weekly'
    } = constraints;
    
    // Get all relevant presentations
    const candidatePresentations = this.presentations
      .map(p => ({
        presentation: p,
        score: this.matcher.calculateMatchScore(p)
      }))
      .filter(item => item.score > 0.5)
      .sort((a, b) => b.score - a.score);
    
    // Build path considering dependencies
    const path = this.buildPath(
      candidatePresentations,
      maxPresentations,
      userProfile
    );
    
    // Optimize for learning progression
    return this.optimizePath(path, userProfile);
  }
  
  buildPath(candidates, maxSize, userProfile) {
    const path = [];
    const added = new Set();
    const prerequisitesMet = new Set(
      userProfile.knowledge.completedPresentations
    );
    
    for (const candidate of candidates) {
      if (path.length >= maxSize) break;
      
      const presentation = candidate.presentation;
      if (added.has(presentation.presentationId)) continue;
      
      // Check if prerequisites are met
      const prereqs = presentation.prerequisiteKnowledge.required;
      if (!prereqs.every(p => this.canMeetPrerequisite(p, prerequisitesMet, candidates))) {
        continue;
      }
      
      // Add prerequisites first
      const missingPrereqs = this.getMissingPrerequisites(
        presentation,
        prerequisitesMet,
        candidates
      );
      
      for (const prereq of missingPrereqs) {
        if (path.length < maxSize && !added.has(prereq.presentationId)) {
          path.push(prereq);
          added.add(prereq.presentationId);
          prerequisitesMet.add(prereq.presentationId);
        }
      }
      
      // Add the presentation
      if (path.length < maxSize) {
        path.push(presentation);
        added.add(presentation.presentationId);
        prerequisitesMet.add(presentation.presentationId);
      }
    }
    
    return path;
  }
  
  optimizePath(path, userProfile) {
    // Reorder for optimal learning progression
    return path.sort((a, b) => {
      // Prioritize fundamentals
      const complexityDiff = a.prerequisiteKnowledge.complexity - 
                           b.prerequisiteKnowledge.complexity;
      if (Math.abs(complexityDiff) > 1) return complexityDiff;
      
      // Then by dependency relationships
      if (this.dependsOn(b, a)) return -1;
      if (this.dependsOn(a, b)) return 1;
      
      // Finally by match score
      return this.matcher.calculateMatchScore(b) - 
             this.matcher.calculateMatchScore(a);
    });
  }
}
```

### 6. Implementation Roadmap

#### Phase 1: Content Analysis (Weeks 1-3)

**Week 1: Infrastructure Setup**
- Set up NLP pipeline with spaCy/scispaCy
- Configure embedding generation system
- Establish data processing workflows

**Week 2: Initial Analysis**
- Process all 117 presentations
- Extract entities and concepts
- Generate initial topic clusters

**Week 3: Validation & Refinement**
- Expert review of extracted topics
- Refine clustering parameters
- Create initial taxonomy draft

#### Phase 2: Taxonomy Creation (Weeks 4-6)

**Week 4: Hierarchical Structure**
- Build multi-level topic hierarchy
- Define relationships between topics
- Create dependency mappings

**Week 5: Multi-dimensional Tagging**
- Implement tagging schema
- Tag all presentations
- Validate tag accuracy

**Week 6: Testing & Refinement**
- Test with domain experts
- Gather feedback
- Refine taxonomy structure

#### Phase 3: Profile System Enhancement (Weeks 7-9)

**Week 7: UI/UX Development**
- Implement progressive disclosure
- Add dynamic topic filtering
- Create intuitive navigation

**Week 8: Profile Logic**
- Build profile collection system
- Implement validation rules
- Add smart defaults

**Week 9: Integration Testing**
- Test end-to-end flow
- Optimize performance
- Fix edge cases

#### Phase 4: Matching Algorithm (Weeks 10-12)

**Week 10: Core Algorithm**
- Implement matching logic
- Configure scoring weights
- Build path generation

**Week 11: Optimization**
- Performance tuning
- Algorithm refinement
- A/B testing setup

**Week 12: Launch Preparation**
- Final testing
- Documentation
- Deployment preparation

### 7. Continuous Improvement Framework

#### 7.1 Metrics & KPIs

**User Engagement Metrics**
- Profile completion rate
- Time to complete profile
- Presentation start rate
- Presentation completion rate
- User satisfaction scores

**System Performance Metrics**
- Match accuracy (user feedback)
- Path completion rate
- Recommendation acceptance rate
- Search success rate
- Topic coverage distribution

#### 7.2 Feedback Loops

```javascript
class FeedbackCollector {
  collectPresentationFeedback(userId, presentationId, feedback) {
    return {
      relevance: feedback.relevance, // 1-5 scale
      difficulty: feedback.difficulty, // too easy/just right/too hard
      useful: feedback.useful, // boolean
      wouldRecommend: feedback.wouldRecommend, // boolean
      specificComments: feedback.comments,
      timestamp: new Date().toISOString()
    };
  }
  
  collectPathFeedback(userId, pathId, feedback) {
    return {
      progression: feedback.progression, // too slow/just right/too fast
      coherence: feedback.coherence, // 1-5 scale
      gaps: feedback.identifiedGaps, // array of missing topics
      suggestions: feedback.suggestions,
      completionLikelihood: feedback.completionLikelihood // 1-5 scale
    };
  }
}
```

#### 7.3 A/B Testing Framework

**Test Variants**
- Topic collection methods (hierarchical vs. flat)
- Number of profile stages (3 vs. 4 vs. 5)
- Matching algorithm weights
- Path generation strategies

**Success Metrics**
- Conversion rate (profile completion)
- Engagement rate (presentations started)
- Retention rate (users returning)
- Success rate (learning objectives met)

### 8. Technical Architecture

#### 8.1 System Components

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend                              │
├─────────────────────────────────────────────────────────────┤
│  Profile Collection │ Presentation Browser │ Learning Path   │
└──────────┬──────────┴──────────┬───────────┴────────┬───────┘
           │                     │                     │
           ▼                     ▼                     ▼
┌─────────────────────────────────────────────────────────────┐
│                      API Gateway                             │
└──────────┬──────────────────────┬────────────────────┬──────┘
           │                      │                      │
           ▼                      ▼                      ▼
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│  Profile Service │  │ Matching Service │  │Analytics Service │
└──────────────────┘  └──────────────────┘  └──────────────────┘
           │                      │                      │
           ▼                      ▼                      ▼
┌─────────────────────────────────────────────────────────────┐
│                    Data Layer                                │
├─────────────────────────────────────────────────────────────┤
│ User Profiles │ Presentations │ Taxonomies │ Feedback Data  │
└─────────────────────────────────────────────────────────────┘
```

#### 8.2 Technology Stack

**Backend Services**
- Node.js/Python for API services
- PostgreSQL for structured data
- Elasticsearch for search functionality
- Redis for caching
- Vector database (Pinecone/Weaviate) for embeddings

**NLP/ML Pipeline**
- spaCy + scispaCy for medical NLP
- Sentence Transformers for embeddings
- scikit-learn for clustering
- NetworkX for graph algorithms

**Frontend**
- React with TypeScript
- Progressive form framework
- D3.js for learning path visualization

### 9. Success Criteria

#### 9.1 Launch Criteria
- [ ] 95% of presentations accurately tagged
- [ ] Taxonomy validated by 3+ domain experts
- [ ] Profile completion rate > 80% in testing
- [ ] Match accuracy > 85% based on expert evaluation
- [ ] System response time < 500ms for matching

#### 9.2 Post-Launch Goals (3 months)
- User satisfaction score > 4.2/5
- 70% of users start recommended presentations
- 50% completion rate for learning paths
- < 5% mismatch complaints
- 30% of users provide feedback

### 10. Risk Mitigation

#### Technical Risks
- **Inaccurate tagging**: Implement expert validation workflow
- **Poor matching**: Start conservative, gather feedback, iterate
- **Performance issues**: Implement caching, optimize algorithms
- **Complexity overwhelm**: Progressive disclosure, smart defaults

#### User Experience Risks
- **Profile fatigue**: Keep essential fields minimal
- **Choice paralysis**: Limit initial recommendations
- **Mismatch frustration**: Clear feedback mechanism
- **Abandonment**: Save progress, allow skip

### Appendices

#### A. Sample Topic Hierarchy (Partial)
```yaml
- Cellular Medicine:
    - Mitochondrial Function:
        - Energy Production
        - Oxidative Stress
        - Mitochondrial Dynamics
    - Cell Danger Response:
        - CDR Stages
        - Triggers and Mediators
        - Clinical Implications
    - Metabolic Regulation:
        - Nutrient Sensing
        - Metabolic Switching
        - Circadian Rhythms

- Clinical Conditions:
    - Neurodevelopmental:
        - Autism Spectrum Disorders:
            - Biomarkers
            - Metabolic Features
            - Intervention Strategies
        - ADHD
        - Learning Disabilities
    - Chronic Fatigue Syndromes:
        - ME/CFS
        - Post-Viral Fatigue
        - Long COVID
```

#### B. Example Presentation Fingerprint
```json
{
  "presentationId": "pres_2024_001",
  "title": "Mitochondrial Dysfunction in Autism: From Biomarkers to Treatment",
  "presenter": "Dr. Jane Smith",
  "duration": 67,
  "recordingDate": "2024-03-15",
  
  "primaryTopics": [
    "autism-spectrum-disorders",
    "mitochondrial-dysfunction",
    "biomarkers"
  ],
  "secondaryTopics": [
    "oxidative-stress",
    "metabolomics",
    "treatment-protocols"
  ],
  
  "prerequisiteKnowledge": {
    "required": ["basic-biochemistry", "cellular-metabolism"],
    "recommended": ["autism-basics", "laboratory-diagnostics"],
    "complexity": 6.5
  },
  
  "conceptsIntroduced": [
    "mitochondrial-autism-phenotype",
    "metabolomic-profiling-autism",
    "targeted-nutritional-intervention"
  ],
  
  "targetAudience": ["clinicians", "researchers"],
  "estimatedEngagement": "high",
  "practicalExamples": 4
}
```

---

*Document Version: 1.0*  
*Last Updated: [Current Date]*  
*Status: Draft for Review*