# Prompt Lookup: markdown-document-classification-prompt

Generated: 2025-03-22T04:34:51.440Z


=== PROMPT DETAILS FROM DATABASE ===
ID: 880480a9-3241-48f0-bb83-a93a81de8553
Name: markdown-document-classification-prompt
Description: No description
Created: 3/9/2025, 6:45:28 PM
Updated: 3/22/2025, 3:55:57 AM

=== PROMPT CONTENT FROM DATABASE ===
"# Document Classification and Assessment Prompt\n\nYou are an expert document manager on a development team tasked with classifying and assessing markdown documentation files. Your job is to analyze the provided markdown file and determine which document type it best matches, then create a detailed assessment of its quality, relevance, and recommended status.\n\n## Input Context\n\nYou'll be provided with:\n1. A markdown file to analyze\n2. A list of document types defined in your system\n3. Current development architecture documentation\n4. Optional metadata about existing files in the repository\n\n## Instructions\n\n1. Carefully read the markdown file content.\n2. Compare against the provided document types to determine the most appropriate classification.\n3. Assess the document's quality, relevance, and potential value.\n4. Generate appropriate tags that capture the document's key topics.\n5. Determine a recommended status (KEEP, UPDATE, ARCHIVE, DELETE).\n6. Structure your response in the specified JSON format.\n\nYour assessment should consider:\n- How well the document aligns with current development architecture\n- The document's creation/modification date and its recency\n- The document's completeness and adherence to documentation standards\n- The document's practical value to developers\n\n## Response Format\n\nProvide your assessment in the following JSON format:\n\n```json\n{\n  \"id\": \"{{auto-generated UUID}}\",\n  \"file_path\": \"{{file_path}}\",\n  \"title\": \"{{document title}}\",\n  \"summary\": {\n    \"brief\": \"{{brief summary of the document}}\",\n    \"detailed\": {\n      \"purpose\": \"{{document purpose}}\",\n      \"key_components\": \"{{main sections/elements}}\",\n      \"practical_application\": \"{{how the document would be used}}\"\n    }\n  },\n  \"ai_generated_tags\": [\"{{tag1}}\", \"{{tag2}}\", \"{{tag3}}\", \"{{tag4}}\", \"{{tag5}}\"],\n  \"manual_tags\": null,\n  \"last_modified_at\": \"{{last_modified_date if available}}\",\n  \"last_indexed_at\": \"{{current_datetime}}\",\n  \"file_hash\": \"{{file_hash if available}}\",\n  \"metadata\": {\n    \"size\": {{file_size_in_bytes}},\n    \"isPrompt\": false\n  },\n  \"created_at\": \"{{creation_date if available, otherwise current_datetime}}\",\n  \"updated_at\": \"{{current_datetime}}\",\n  \"is_deleted\": false,\n  \"document_type_id\": \"{{matched document type id or null if UNCLASSIFIED}}\",\n  \"ai_assessment\": {\n    \"document_type\": \"{{matched document type or 'UNCLASSIFIED'}}\",\n    \"current_relevance\": {\n      \"score\": {{1-10 score}},\n      \"reasoning\": \"{{brief explanation of current relevance score}}\"\n    },\n    \"potential_relevance\": {\n      \"score\": {{1-10 score}},\n      \"reasoning\": \"{{brief explanation of potential future relevance}}\"\n    },\n    \"status_recommendation\": \"{{KEEP|UPDATE|ARCHIVE|DELETE}}\",\n    \"confidence\": {{1-10 score}},\n    \"reasoning\": \"{{explanation of the overall assessment and recommendations}}\"\n  },\n  \"assessment_quality_score\": {{1-10 overall quality score}},\n  \"assessment_created_at\": \"{{current_datetime}}\",\n  \"assessment_updated_at\": \"{{current_datetime}}\",\n  \"assessment_model\": \"Claude 3.7 Sonnet\",\n  \"assessment_version\": 1,\n  \"assessment_date\": \"{{current_date}}\"\n}\n```\n\nIf the document doesn't match any predefined document types, explain why in your reasoning and classify as \"UNCLASSIFIED\".\n\nFor the status recommendation:\n- KEEP: Document is relevant, accurate, and valuable as-is\n- UPDATE: Document contains useful information but needs updates\n- ARCHIVE: Document has historical value but is no longer actively relevant\n- DELETE: Document has little or no value and should be removed\n\nScore definitions:\n- Current/Potential Relevance (1-10): How valuable the document is now/could be in future\n- Confidence (1-10): How confident you are in your assessment\n- Assessment Quality Score (1-10): Overall quality of your assessment\n\n## Example Workflow\n\nWhen analyzing a document, follow this general process:\n1. First understand the document's content and structure\n2. Compare against document types to find the best match\n3. Evaluate quality based on completeness, clarity, and accuracy\n4. Assess relevance to current development practices\n5. Generate meaningful tags based on content\n6. Make a status recommendation with supporting reasoning\n\nFor JSONB storage compatibility, ensure:\n- All JSON is properly formatted and validated\n- Nested objects are used for structured data\n- Text fields have reasonable length limitations\n- Date fields follow ISO 8601 format (YYYY-MM-DDTHH:MM:SS.sss+00:00)\n- Numeric scores are integers in the specified ranges\n"

=== RELATIONSHIPS (1) ===

Relationship ID: 104d308d-2197-4301-9b60-52972730e19c
Type: reference
Asset Path: prompts/development-process-specification.md
Context: Provides the core evaluation material to help the prompt evauate the value of the particular file being analyzed in relation to the goals defibned in the tech specification
File Content (228 lines, 10131 bytes):
---
# DHG Development Process Specification

## Overview

This document outlines the design, build, and iteration process for the DHG application ecosystem. It serves as a reference for development practices, architectural decisions, and technical dependencies. This specification can be used to evaluate existing documentation against current development practices to identify gaps and prioritize documentation efforts.

## Development Paradigm

Our development approach follows a pragmatic, component-based methodology focused on rapid iteration and functional deliverables. Key aspects include:

1. **Component-First Development**: Building discrete, reusable UI components that can be composed into complex interfaces
2. **Debug-Driven Development**: Implementing extensive debugging capabilities throughout components to aid in development
3. **Incremental Enhancement**: Starting with minimal viable functionality and iteratively enhancing based on feedback
4. **Documentation Through Demonstration**: Creating working examples that serve as both development artifacts and documentation

## Technical Stack

### Frontend

- **Framework**: React with functional components and hooks
- **Bundling**: Vite for fast builds and hot module replacement
- **Styling**: Tailwind CSS for utility-first styling approach
- **State Management**: React hooks (useState, useContext) for local and shared state
- **Routing**: React Router for client-side navigation
- **Component Library**: Custom components based on shadcn/ui primitives

### Backend

- **Database**: Supabase (PostgreSQL) for data storage and retrieval
- **Authentication**: Supabase Auth for user authentication
- **API**: RESTful endpoints via Supabase functions
- **Storage**: Supabase Storage for file storage
- **Functions**: Edge Functions for serverless compute

### Integration

- **Google Drive**: Integration for document synchronization and metadata extraction
- **OpenAI**: AI processing for document analysis and content extraction
- **Claude**: Advanced text analysis and context-aware processing

### Development Tools

- **Package Management**: pnpm for efficient dependency management in monorepo structure
- **Monorepo**: Workspace-based organization of multiple applications
- **TypeScript**: Static typing for improved development experience and error prevention
- **ESLint/Prettier**: Code style enforcement and formatting
- **Git**: Version control with feature branch workflow

## Design and Build Process

### 1. Component Design

1. **Initial Specification**: Define the component's purpose, inputs, outputs, and expected behavior
2. **Prototype Development**: Create a minimal implementation with essential functionality
3. **Debug Integration**: Add debug panels, logging, and state visualization
4. **Edge Case Handling**: Implement error states, loading states, and empty states

### 2. Page Assembly

1. **Layout Design**: Define the page structure and component arrangement
2. **Component Integration**: Assemble components with appropriate data flow
3. **State Management**: Implement state sharing between components as needed
4. **Navigation Flow**: Define and implement navigation between pages

### 3. Data Integration

1. **Schema Definition**: Define database schema for required entities
2. **Query Implementation**: Create typed queries for data retrieval
3. **Mutation Implementation**: Implement data modification operations
4. **Caching Strategy**: Define appropriate caching mechanisms for improved performance

### 4. External Integrations

1. **Authentication Flow**: Implement user authentication and session management
2. **Google Drive Integration**: Set up synchronization with document sources
3. **AI Processing Flow**: Implement pipelines for document analysis and content extraction
4. **Metadata Synchronization**: Maintain consistency between external data and local storage

### 5. Testing and Validation

1. **Component Testing**: Verify component behavior in isolation
2. **Integration Testing**: Validate interactions between components
3. **User Flow Testing**: Ensure complete user journeys function as expected
4. **Performance Validation**: Check for performance bottlenecks and optimize as needed

### 6. Iteration and Refinement

1. **Feedback Collection**: Gather user feedback on implemented features
2. **Issue Identification**: Document bugs, edge cases, and limitations
3. **Enhancement Planning**: Prioritize improvements based on impact and effort
4. **Implementation Cycle**: Apply changes in small, focused iterations

## File and Directory Structure

### Monorepo Organization

```
dhg-mono/
├── apps/
│   └── dhg-improve-experts/  # Main application
├── docs/                    # Documentation
├── packages/                # Shared libraries
└── supabase/               # Database definitions
```

### Application Structure

```
dhg-improve-experts/
├── public/                 # Static assets
├── src/
│   ├── api/                # API endpoints
│   ├── app/                # Application-specific code
│   ├── components/         # Reusable UI components
│   ├── config/             # Configuration constants
│   ├── hooks/              # Custom React hooks
│   ├── integrations/       # External service integrations
│   ├── lib/                # Utility functions
│   ├── pages/              # Page components
│   ├── schemas/            # Data validation schemas
│   ├── services/           # Service abstractions
│   ├── styles/             # Global styles
│   ├── types/              # TypeScript type definitions
│   └── utils/              # Utility functions and helpers
└── tests/                  # Test files
```

## Component Taxonomy

### UI Components

- **Layout Components**: Page structure, navigation, and content organization
- **Form Components**: User input collection and validation
- **Display Components**: Data visualization and presentation
- **Interactive Components**: User interaction and feedback

### Functional Components

- **Data Fetching**: API integration and data retrieval
- **State Management**: Application state handling
- **Authentication**: User identity and access control
- **Processing**: Data transformation and analysis

### Integration Components

- **Google Drive**: Document synchronization and retrieval
- **AI Processing**: Content analysis and extraction
- **Batch Processing**: Background task management
- **Notification**: User alerting and feedback

## Development Practices

### Code Organization

- **Component Modularity**: Each component should have a single responsibility
- **Typed Interfaces**: All component props and state should be typed
- **Consistent Naming**: Follow established naming conventions
- **Archival Practice**: Deprecated code is archived with date suffixes (Component.YYYY-MM-DD.tsx)

### Styling Approach

- **Utility-First**: Prefer Tailwind utility classes for styling
- **Component Variants**: Use variants for component state variations
- **Responsive Design**: Implement mobile-first responsive layouts
- **Accessibility**: Ensure proper contrast, keyboard navigation, and screen reader support

### State Management

- **Local State**: Use useState for component-specific state
- **Shared State**: Use useContext for cross-component state sharing
- **API State**: Use SWR or React Query for server state management
- **Form State**: Use controlled components for form inputs

### Error Handling

- **Graceful Degradation**: Components should handle error states elegantly
- **User Feedback**: Provide clear error messages to users
- **Logging**: Log errors for debugging purposes
- **Recovery**: Implement retry mechanisms where appropriate

## Documentation Standards

### Component Documentation

- **Purpose**: Clear description of the component's role
- **Props**: Complete documentation of all props and their types
- **Example Usage**: Concrete examples of component implementation
- **Edge Cases**: Description of how edge cases are handled

### API Documentation

- **Endpoints**: List of all available endpoints
- **Parameters**: Required and optional parameters
- **Response Format**: Expected response structure
- **Error Handling**: Possible error states and codes

### Integration Documentation

- **Setup Requirements**: Prerequisites for integration
- **Authentication**: Authentication flow details
- **Data Flow**: Description of data exchange
- **Limitations**: Known limitations and constraints

## Evaluation Criteria

This specification can be used to evaluate existing documentation against the following criteria:

1. **Completeness**: Does the documentation cover all aspects of the development process?
2. **Accuracy**: Is the documentation aligned with current practices?
3. **Clarity**: Is the documentation easy to understand and follow?
4. **Actionability**: Does the documentation provide clear guidance for implementation?
5. **Maintenance**: Is the documentation up-to-date and regularly maintained?

## Implementation Examples

The following recent implementations exemplify our development approach:

1. **Viewer2**: Enhanced file browser with root folder filtering and hierarchical display
2. **FileTree2**: Specialized tree component with expanded debugging capabilities
3. **BatchProcessing**: Background task management with status monitoring
4. **DocumentExtraction**: AI-powered content analysis and extraction
5. **GoogleDriveSync**: External content synchronization and metadata management

## Conclusion

This specification describes our current development process, emphasizing component-based design, incremental enhancement, and extensive debugging capabilities. By evaluating existing documentation against this specification, we can identify gaps and prioritize documentation efforts to better support ongoing development.

Documentation should focus on providing practical guidance, code examples, and clear explanations of design decisions to facilitate both current development and future maintenance.
---

=== PROMPT METADATA ===
{
  "hash": "JTIzJTIwRG9jdW1lbnQlMjBDbGFzc2lmaWNhdGlv",
  "usage": {
    "inputSchema": {},
    "outputSchema": "text"
  },
  "source": {
    "gitInfo": {
      "branch": "main",
      "commitId": "none"
    },
    "fileName": "markdown-document-classification-prompt.md",
    "createdAt": "2025-03-09T18:45:28.401Z",
    "lastModified": "2025-03-11T15:34:43.423Z"
  },
  "aiEngine": {
    "model": "claude-3-sonnet-20240229",
    "maxTokens": 4000,
    "temperature": 0.7
  },
  "function": {
    "purpose": "",
    "dependencies": [],
    "estimatedCost": "",
    "successCriteria": ""
  },
  "databaseQuery": "select * from document_types where category = 'Documentation';",
  "relatedAssets": [
    "40f9d0d9-029b-4e42-a37b-d8c1cf0d5a89"
  ],
  "databaseQuery2": "SELECT metadata FROM documentation_files WHERE id = :script_id;",
  "packageJsonFiles": []
}

=== DATABASE QUERY RESULTS ===
Query: select * from document_types where category = 'Documentation';
Executing query: select * from document_types where category = 'Documentation'
Detected Documentation category query - using direct table access
Found 11 records with category=Documentation
Records found: 11
[
  {
    "id": "73ee8695-2750-453f-ad6a-929a6b64bc74",
    "document_type": "README",
    "current_num_of_type": 0,
    "description": "A markdown document that serves as the primary introduction and documentation for a project or repository. It typically contains project overview, installation instructions, usage examples, and contribution guidelines.",
    "mime_type": "text/markdown",
    "file_extension": "md",
    "document_type_counts": 0,
    "category": "Documentation",
    "created_at": "2025-03-09T11:41:42.719+00:00",
    "updated_at": "2025-03-09T11:41:42.719+00:00",
    "required_fields": [
      "title",
      "project_description",
      "installation_section"
    ],
    "legacy_document_type_id": null,
    "is_ai_generated": true,
    "content_schema": null,
    "ai_processing_rules": {
      "analyzers": {
        "clarity_assessment": {
          "output": "qualitative evaluation",
          "description": "Assess how clear and understandable the instructions are"
        },
        "completeness_score": {
          "output": "score 0-100",
          "description": "Evaluate how complete the README is based on presence of key sections"
        }
      },
      "extractors": {
        "dependencies": {
          "format": "array",
          "description": "Identify and list any dependencies mentioned in installation instructions"
        },
        "code_examples": {
          "format": "array",
          "description": "Extract code examples for indexing and reference"
        },
        "project_summary": {
          "max_length": 200,
          "description": "Extract a concise summary of the project's purpose and features"
        }
      },
      "generators": {
        "table_of_contents": {
          "trigger": "missing_toc",
          "description": "Generate a table of contents based on headings if not present"
        },
        "improvement_suggestions": {
          "trigger": "low_clarity_score",
          "description": "Suggest improvements for unclear sections or missing information"
        }
      }
    },
    "validation_rules": {
      "max_length": 50000,
      "min_length": 300,
      "required_sections": [
        "Introduction/Overview",
        "Installation",
        "Usage"
      ],
      "markdown_validation": {
        "require_headings": true,
        "max_heading_depth": 4,
        "require_code_blocks": false
      }
    }
  },
  {
    "id": "e54ebd13-79d1-4fe2-93db-6f25c9b6a9d0",
    "document_type": "Deployment Environment Guide",
    "current_num_of_type": 0,
    "description": "Comprehensive documentation for managing project deployment processes, environment configurations, and deployment workflows across different stages (development, staging, production).",
    "mime_type": "[\"text/markdown\",\"application/pdf\",\"application/vnd.openxmlformats-officedocument.wordprocessingml.document\"]",
    "file_extension": "[\"md\",\"pdf\",\"docx\"]",
    "document_type_counts": 0,
    "category": "Documentation",
    "created_at": "2025-03-09T11:50:15.504+00:00",
    "updated_at": "2025-03-09T11:50:15.504+00:00",
    "required_fields": [
      "title",
      "environment_types",
      "deployment_process",
      "configuration_details",
      "prerequisites"
    ],
    "legacy_document_type_id": null,
    "is_ai_generated": true,
    "content_schema": null,
    "ai_processing_rules": {
      "generate_summary": "Create an executive summary of the deployment process for quick reference",
      "suggest_improvements": "Analyze the deployment process and suggest optimizations based on best practices",
      "detect_security_risks": "Flag potential security issues in the deployment process",
      "version_compatibility": "Identify software version dependencies and potential compatibility issues",
      "identify_deployment_commands": "Extract all deployment commands and scripts for automation purposes",
      "extract_environment_variables": "Identify and list all environment variables mentioned in the document"
    },
    "validation_rules": {
      "environment_types": "Must include at least development and production environments",
      "deployment_process": "Must contain step-by-step instructions with command examples",
      "configuration_details": "Must include environment variables and configuration file locations",
      "security_considerations": "Should include access control and credential management information"
    }
  },
  {
    "id": "3e00c51b-acad-457a-b3b9-cdd3b6f15a4f",
    "document_type": "Git Repository Journal",
    "current_num_of_type": 0,
    "description": "A structured log for tracking Git operations, commit history, and command reference for a repository. Helps developers document what was checked in, when changes occurred, and which Git commands to use for specific situations.",
    "mime_type": "text/markdown",
    "file_extension": "md",
    "document_type_counts": 0,
    "category": "Documentation",
    "created_at": "2025-03-09T11:52:53.145+00:00",
    "updated_at": "2025-03-09T11:52:53.145+00:00",
    "required_fields": [
      "repository_name",
      "entries"
    ],
    "legacy_document_type_id": null,
    "is_ai_generated": true,
    "content_schema": null,
    "ai_processing_rules": {
      "analysis": {
        "command_usage": "Analyze command usage to recommend more efficient alternatives",
        "commit_patterns": "Identify patterns in commit frequency and types",
        "workflow_optimization": "Suggest improvements to Git workflow based on journal entries"
      },
      "extraction": {
        "from_git_log": "Parse `git log` output to automatically populate entries",
        "from_git_status": "Extract current repository status information"
      },
      "generation": {
        "explanations": "Provide clear explanations for complex Git operations",
        "best_practices": "Generate best practices for common Git workflows based on repository activity patterns",
        "command_suggestions": "Suggest appropriate Git commands based on described scenarios"
      }
    },
    "validation_rules": {
      "entries": {
        "type": "array",
        "items": {
          "type": "object",
          "required": [
            "date",
            "action_type",
            "description"
          ],
          "properties": {
            "date": {
              "type": "string",
              "format": "date-time"
            },
            "action_type": {
              "enum": [
                "commit",
                "merge",
                "branch",
                "rebase",
                "pull",
                "push",
                "tag",
                "other"
              ],
              "type": "string"
            },
            "branch_name": {
              "type": "string"
            },
            "commit_hash": {
              "type": "string",
              "pattern": "^[0-9a-f]{7,40}$",
              "required_if": {
                "action_type": [
                  "commit",
                  "merge"
                ]
              }
            },
            "description": {
              "type": "string",
              "min_length": 5
            },
            "commands_used": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "notes": {
                    "type": "string"
                  },
                  "command": {
                    "type": "string"
                  },
                  "purpose": {
                    "type": "string"
                  }
                }
              }
            },
            "files_changed": {
              "type": "array",
              "items": {
                "type": "string"
              }
            }
          }
        },
        "min_items": 1
      },
      "best_practices": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "scenario": {
              "type": "string"
            },
            "explanation": {
              "type": "string"
            },
            "recommended_commands": {
              "type": "array",
              "items": {
                "type": "string"
              }
            }
          }
        }
      },
      "repository_name": {
        "type": "string",
        "max_length": 100,
        "min_length": 1
      }
    }
  },
  {
    "id": "e9d3e473-5315-4837-9f5f-61f150cbd137",
    "document_type": "Code Documentation Markdown",
    "current_num_of_type": 0,
    "description": "Markdown files specifically for documenting project code, including function descriptions, parameter details, usage examples, and implementation notes.",
    "mime_type": "text/markdown",
    "file_extension": "md",
    "document_type_counts": 0,
    "category": "Documentation",
    "created_at": "2025-03-07T06:36:28.847+00:00",
    "updated_at": "2025-03-09T11:43:03.896+00:00",
    "required_fields": [
      "title",
      "description",
      "module_or_class_reference"
    ],
    "legacy_document_type_id": null,
    "is_ai_generated": true,
    "content_schema": null,
    "ai_processing_rules": {
      "linking": {
        "link_to_dependency_docs": true,
        "identify_cross_references": true,
        "suggest_related_documentation": true
      },
      "analysis": {
        "complexity_assessment": true,
        "documentation_coverage": true,
        "api_stability_indicators": true
      },
      "extraction": {
        "detect_code_examples": true,
        "identify_dependencies": true,
        "extract_parameter_types": true,
        "identify_functions_and_methods": true
      },
      "enhancement": {
        "verify_example_validity": true,
        "generate_missing_examples": false,
        "suggest_missing_documentation": true,
        "check_documentation_completeness": true
      }
    },
    "validation_rules": {
      "links": {
        "internal_links_must_be_valid": true,
        "external_links_must_be_labeled": true
      },
      "content": {
        "max_heading_depth": 4,
        "must_include_code_examples": true,
        "must_have_function_descriptions": true
      },
      "structure": {
        "min_sections": 3,
        "must_have_heading": true,
        "required_sections": [
          "Overview",
          "Usage",
          "API Reference"
        ]
      }
    }
  },
  {
    "id": "adbe8042-dcc4-4402-977a-1fa04688945d",
    "document_type": "Technical Specification",
    "current_num_of_type": 0,
    "description": "Structured markdown documentation that describes software specifications, implementation details, and coding guidelines to facilitate AI-assisted code generation.",
    "mime_type": "text/markdown",
    "file_extension": "md",
    "document_type_counts": 0,
    "category": "Documentation",
    "created_at": "2025-03-09T11:46:09.967+00:00",
    "updated_at": "2025-03-09T11:46:09.967+00:00",
    "required_fields": [
      "title",
      "overview",
      "requirements",
      "implementation_guidelines"
    ],
    "legacy_document_type_id": null,
    "is_ai_generated": true,
    "content_schema": null,
    "ai_processing_rules": {
      "code_extraction": {
        "validate_syntax": true,
        "identify_languages": true,
        "extract_code_blocks": true
      },
      "requirement_analysis": {
        "detect_ambiguities": true,
        "identify_functional_requirements": true,
        "identify_non_functional_requirements": true
      },
      "code_generation_hints": {
        "identify_return_values": true,
        "extract_parameter_types": true,
        "detect_error_handling_requirements": true
      },
      "implementation_guidance": {
        "detect_technology_stack": true,
        "extract_design_patterns": true,
        "identify_architecture_components": true
      }
    },
    "validation_rules": {
      "max_length": 50000,
      "min_length": 500,
      "content_checks": {
        "code_blocks_present": true,
        "technical_specificity": "high"
      },
      "required_sections": [
        "# Overview",
        "# Requirements",
        "# Implementation Guidelines"
      ],
      "recommended_sections": [
        "# API Specifications",
        "# Code Examples",
        "# Testing Strategy",
        "# Performance Considerations"
      ]
    }
  },
  {
    "id": "c903f553-baf2-482b-bfc9-bade16d683d1",
    "document_type": "External Library Documentation",
    "current_num_of_type": 0,
    "description": "Markdown documentation files that describe external libraries, frameworks, or APIs. These documents contain explanations, usage examples, and reference information for third-party code that is used within projects but not developed internally.",
    "mime_type": "text/markdown",
    "file_extension": "md",
    "document_type_counts": 0,
    "category": "Documentation",
    "created_at": "2025-03-15T20:54:39.943+00:00",
    "updated_at": "2025-03-15T20:54:39.943+00:00",
    "required_fields": [
      "library_name",
      "version",
      "purpose",
      "main_features"
    ],
    "legacy_document_type_id": null,
    "is_ai_generated": true,
    "content_schema": null,
    "ai_processing_rules": {
      "detect_api_changes": true,
      "identify_dependencies": true,
      "suggest_usage_patterns": true,
      "extract_library_details": true,
      "tag_relevant_technologies": true,
      "highlight_breaking_changes": true,
      "generate_comparison_with_alternatives": false
    },
    "validation_rules": {
      "max_heading_depth": 4,
      "must_contain_code_examples": true,
      "must_reference_external_source": true,
      "must_include_version_information": true,
      "should_include_installation_section": true
    }
  },
  {
    "id": "ad9336a0-613f-4632-906b-b691dc39c7df",
    "document_type": "Solution Guide",
    "current_num_of_type": 0,
    "description": "Structured markdown files documenting specific coding fixes, workarounds, and solutions that have been verified to work. These guides help the AI learn from past successes when facing similar technical challenges.",
    "mime_type": "text/markdown",
    "file_extension": "md",
    "document_type_counts": 0,
    "category": "Documentation",
    "created_at": "2025-03-09T11:48:10.007+00:00",
    "updated_at": "2025-03-09T11:48:10.007+00:00",
    "required_fields": [
      "title",
      "problem_statement",
      "solution_approach",
      "code_examples",
      "verification_method"
    ],
    "legacy_document_type_id": null,
    "is_ai_generated": true,
    "content_schema": null,
    "ai_processing_rules": {
      "extract_error_patterns": true,
      "categorize_by_root_cause": true,
      "link_to_related_solutions": true,
      "identify_solution_patterns": true,
      "index_for_similarity_search": true,
      "extract_programming_concepts": true
    },
    "validation_rules": {
      "max_length": 10000,
      "min_length": 200,
      "must_contain_code_block": true,
      "must_include_verification": true,
      "must_have_problem_solution_structure": true
    }
  },
  {
    "id": "50c810a3-c4a6-4243-a7a4-6381eb42e0a3",
    "document_type": "Script Report",
    "current_num_of_type": 0,
    "description": "A markdown document that contains both script output/results and documentation of the script development process itself. These documents serve as living artifacts that capture both the technical findings and the evolution of the script's development.",
    "mime_type": "text/markdown",
    "file_extension": "md",
    "document_type_counts": 0,
    "category": "Documentation",
    "created_at": "2025-03-09T11:55:50.863+00:00",
    "updated_at": "2025-03-09T11:55:50.863+00:00",
    "required_fields": [
      "title",
      "script_purpose",
      "development_notes",
      "output_results"
    ],
    "legacy_document_type_id": null,
    "is_ai_generated": true,
    "content_schema": null,
    "ai_processing_rules": {
      "extract_metrics": {
        "action": "data_extraction",
        "description": "Identify and extract quantitative metrics or results from the output section"
      },
      "summarize_findings": {
        "action": "text_summarization",
        "description": "Create a concise summary of the script's key findings or outputs"
      },
      "extract_code_blocks": {
        "action": "extract_structured_data",
        "description": "Identify and extract all code blocks with their language specification"
      },
      "suggest_improvements": {
        "action": "recommendation_generation",
        "description": "Based on development notes and results, suggest potential improvements to the script"
      },
      "identify_development_stages": {
        "action": "semantic_classification",
        "description": "Analyze development notes to identify distinct stages of script evolution"
      }
    },
    "validation_rules": {
      "max_size_mb": 10,
      "min_sections": 3,
      "must_include_code_blocks": true,
      "must_have_results_section": true,
      "must_have_development_section": true
    }
  },
  {
    "id": "effb10c6-7608-442b-8c33-4aac5d721528",
    "document_type": "Cli Pipeline Markdown",
    "current_num_of_type": 0,
    "description": "Markdown documentation files used in the CLI pipeline services located under the packages\\cli folder structure. These documents contain implementation details, usage instructions, and configuration information for CLI components.",
    "mime_type": "text/markdown",
    "file_extension": "md",
    "document_type_counts": 0,
    "category": "Documentation",
    "created_at": "2025-03-18T04:43:35.631+00:00",
    "updated_at": "2025-03-18T04:43:35.631+00:00",
    "required_fields": [
      "title",
      "description",
      "usage_example"
    ],
    "legacy_document_type_id": null,
    "is_ai_generated": true,
    "content_schema": null,
    "ai_processing_rules": {
      "cross_reference": "Identify connections to other CLI components and services",
      "extract_commands": "Identify and extract all CLI commands and their syntax",
      "generate_summary": "Create a concise summary of the CLI component functionality",
      "update_detection": "Flag when documentation appears outdated compared to implementation",
      "suggest_improvements": "Analyze documentation for completeness and suggest improvements",
      "identify_dependencies": "Extract any dependencies mentioned in the documentation"
    },
    "validation_rules": {
      "content": {
        "max_line_length": "Lines should not exceed 120 characters for readability",
        "no_broken_links": "All internal links must resolve to valid paths",
        "code_blocks_have_language": "Code blocks should specify a language for proper syntax highlighting"
      },
      "structure": {
        "has_title": "Document must start with a level 1 heading (#)",
        "has_description": "Document must contain a description section after the title",
        "has_usage_example": "Document must include at least one code block showing usage example",
        "has_proper_sections": "Sections must be properly nested (h1 > h2 > h3)"
      }
    }
  },
  {
    "id": "d98330a0-431f-4230-bda6-31f78795f484",
    "document_type": "ai_prompt_template",
    "current_num_of_type": 0,
    "description": "Markdown files containing prompt templates for AI systems. These templates can be uploaded to AI engines along with content and support files to generate specific outputs.",
    "mime_type": "text/markdown",
    "file_extension": "md",
    "document_type_counts": 0,
    "category": "Documentation",
    "created_at": "2025-03-08T01:39:59.678+00:00",
    "updated_at": "2025-03-20T01:33:33.508+00:00",
    "required_fields": [
      "title",
      "description",
      "target_model",
      "prompt_body"
    ],
    "legacy_document_type_id": null,
    "is_ai_generated": true,
    "content_schema": null,
    "ai_processing_rules": {
      "version_control": {
        "track_changes": true,
        "suggest_merges": true
      },
      "template_analysis": {
        "enabled": true,
        "detect_tone": true,
        "detect_complexity": true,
        "suggest_improvements": true
      },
      "variable_detection": {
        "enabled": true,
        "pattern": "\\{\\{([A-Za-z0-9_]+)\\}\\}",
        "extract_as": "variables"
      },
      "compatibility_check": {
        "enabled": true,
        "check_token_limits": true,
        "validate_against_model": true
      },
      "metadata_extraction": {
        "enabled": true,
        "extract_tags": true,
        "generate_summary": true
      }
    },
    "validation_rules": {
      "title": {
        "type": "string",
        "pattern": "^[A-Za-z0-9\\s\\-_]+$",
        "max_length": 100,
        "min_length": 3
      },
      "variables": {
        "type": "array",
        "items": {
          "type": "string",
          "pattern": "^\\{\\{[A-Za-z0-9_]+\\}\\}$"
        },
        "required": false
      },
      "max_tokens": {
        "type": "integer",
        "maximum": 32000,
        "minimum": 1,
        "required": false
      },
      "description": {
        "type": "string",
        "max_length": 500,
        "min_length": 10
      },
      "prompt_body": {
        "type": "string",
        "max_length": 10000,
        "min_length": 10
      },
      "temperature": {
        "type": "number",
        "maximum": 2,
        "minimum": 0,
        "required": false
      },
      "target_model": {
        "enum": [
          "gpt-3.5-turbo",
          "gpt-4",
          "claude-2",
          "llama-2",
          "mistral",
          "other"
        ],
        "type": "string"
      }
    }
  },
  {
    "id": "f8a40488-43e1-4c1c-8b19-c02d03d7a612",
    "document_type": "api_context_support",
    "current_num_of_type": 0,
    "description": "Markdown files containing contextual information to enhance API prompt calls. These documents provide reference material, examples, or domain knowledge that can be included in API requests to generate more accurate and relevant results.",
    "mime_type": "text/markdown",
    "file_extension": "md",
    "document_type_counts": 0,
    "category": "Documentation",
    "created_at": "2025-03-08T01:43:33.149+00:00",
    "updated_at": "2025-03-20T01:33:48.022+00:00",
    "required_fields": [
      "title",
      "context_type",
      "content"
    ],
    "legacy_document_type_id": null,
    "is_ai_generated": true,
    "content_schema": null,
    "ai_processing_rules": {
      "indexing": {
        "enabled": true,
        "overlap": 200,
        "chunk_size": 1000
      },
      "preprocessing": [
        "remove_markdown_formatting",
        "extract_code_blocks",
        "identify_key_concepts"
      ],
      "usage_tracking": {
        "track_api_calls": true,
        "track_performance_impact": true
      },
      "embedding_model": "text-embedding-3-small",
      "retrieval_guidelines": {
        "prioritize_recent": false,
        "max_context_chunks": 5,
        "relevance_threshold": 0.75
      }
    },
    "validation_rules": {
      "size_limit": 1048576,
      "format_validation": "markdown",
      "required_sections": [
        "description",
        "usage_examples"
      ],
      "max_content_length": 100000,
      "min_content_length": 50,
      "prohibited_content": [
        "api_keys",
        "credentials",
        "personal_data"
      ]
    }
  }
]

=== DATABASE QUERY2 RESULTS ===
Query: SELECT metadata FROM documentation_files WHERE id = :script_id
Replacing :script_id parameter with: 40f9d0d9-029b-4e42-a37b-d8c1cf0d5a89
Modified query: SELECT metadata FROM documentation_files WHERE id = '40f9d0d9-029b-4e42-a37b-d8c1cf0d5a89'
Executing query: SELECT metadata FROM documentation_files WHERE id = '40f9d0d9-029b-4e42-a37b-d8c1cf0d5a89'
Query execution successful via RPC
Records found: 1
[
  {
    "metadata": {
      "size": 10131,
      "isPrompt": false
    }
  }
]

=== PACKAGE.JSON FILES ===
