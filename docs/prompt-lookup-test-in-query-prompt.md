# Prompt Lookup: test-in-query-prompt

Generated: 2025-03-18T13:30:15.841Z

No prompt found in database with name: test-in-query-prompt

Trying to load prompt from disk...
Found prompt file on disk: /Users/raybunnage/Documents/github/dhg-mono/prompts/test-in-query-prompt.md

=== PROMPT CONTENT FROM DISK ===
# Test IN Query Prompt

A simple test prompt to verify SQL IN queries work.

<!--
{
  "database_query": "SELECT * FROM document_types WHERE category IN ('AI', 'Development', 'Integration', 'Operations')",
  "title": "Test IN Query",
  "test_with_file": true
}
-->

=== METADATA FROM PROMPT FILE ===
{
  "database_query": "SELECT * FROM document_types WHERE category IN ('AI', 'Development', 'Integration', 'Operations')",
  "title": "Test IN Query",
  "test_with_file": true
}
Error fetching relationships: Failed to get relationships for prompt: invalid input syntax for type uuid: "local-file"

=== PROMPT METADATA ===
{
  "database_query": "SELECT * FROM document_types WHERE category IN ('AI', 'Development', 'Integration', 'Operations')",
  "title": "Test IN Query",
  "test_with_file": true
}

=== DATABASE QUERY RESULTS ===
Query: SELECT * FROM document_types WHERE category IN ('AI', 'Development', 'Integration', 'Operations')
Executing query: SELECT * FROM document_types WHERE category IN ('AI', 'Development', 'Integration', 'Operations')
Raw IN clause: 'AI', 'Development', 'Integration', 'Operations'
Extracted category matches: ["'AI'","'Development'","'Integration'","'Operations'"]
Detected IN query with categories: AI, Development, Integration, Operations
Found 9 records with specified categories
Records found: 9
[
  {
    "id": "a1dddf8e-1264-4ec0-a5af-52eafb536ee3",
    "document_type": "Deployment Script",
    "current_num_of_type": 0,
    "description": "Scripts for deploying applications to various environments, managing environment configurations, and provisioning resources.",
    "mime_type": "application/x-shellscript,text/javascript,text/x-sh,application/javascript",
    "file_extension": "sh,js,bash,py",
    "document_type_counts": 0,
    "category": "Operations",
    "created_at": "2025-03-16T03:15:07.199+00:00",
    "updated_at": "2025-03-16T03:15:07.199+00:00",
    "required_fields": [
      "deployment_target",
      "script_purpose",
      "author",
      "version"
    ],
    "legacy_document_type_id": null,
    "is_ai_generated": true,
    "content_schema": null,
    "ai_processing_rules": {
      "identify_security_risks": true,
      "check_rollback_mechanisms": true,
      "detect_service_dependencies": true,
      "identify_deployment_targets": true,
      "detect_environment_variables": true,
      "extract_resource_requirements": true
    },
    "validation_rules": {
      "should_have_comments": true,
      "should_include_logging": true,
      "should_check_prerequisites": true,
      "should_have_error_handling": true,
      "should_have_timeout_handling": true,
      "should_have_environment_checks": true
    }
  },
  {
    "id": "83706b48-b7e6-483b-a1c2-f31c4f1fbba6",
    "document_type": "Build Automation Script",
    "current_num_of_type": 0,
    "description": "Scripts for building applications, compiling code, bundling assets, and automating development workflows.",
    "mime_type": "application/x-shellscript,text/javascript,text/x-typescript,text/x-python,application/x-bat,application/x-powershell",
    "file_extension": "sh,js,ts,py,bat,ps1",
    "document_type_counts": 0,
    "category": "Development",
    "created_at": "2025-03-16T03:19:13.173+00:00",
    "updated_at": "2025-03-16T03:19:13.173+00:00",
    "required_fields": [
      "script_purpose",
      "build_targets",
      "environment_requirements"
    ],
    "legacy_document_type_id": null,
    "is_ai_generated": true,
    "content_schema": null,
    "ai_processing_rules": {
      "detect_build_tools": {
        "keywords": [
          "webpack",
          "vite",
          "gulp",
          "grunt",
          "rollup",
          "parcel",
          "babel",
          "tsc",
          "make"
        ],
        "description": "Identify build tools like webpack, vite, gulp, etc."
      },
      "analyze_build_steps": {
        "description": "Identify distinct build phases or steps in the script",
        "section_markers": [
          "function",
          "task",
          "step",
          "phase"
        ]
      },
      "check_optimization_settings": {
        "keywords": [
          "minify",
          "compress",
          "optimize",
          "production",
          "sourcemap"
        ],
        "description": "Identify optimization flags and settings"
      },
      "detect_environment_variables": {
        "pattern": "(process.env|ENV|\\$\\{|\\$[A-Z_]+)",
        "description": "Identify environment variables used by the build script"
      },
      "identify_package_dependencies": {
        "description": "Extract package dependencies referenced in the build script",
        "analyze_imports": true
      }
    },
    "validation_rules": {
      "should_have_clean_exit": true,
      "should_handle_build_errors": true,
      "should_handle_dependencies": true,
      "should_document_build_options": true,
      "should_include_usage_instructions": true
    }
  },
  {
    "id": "9636ee5d-d29e-4c09-982e-ac312994bac8",
    "document_type": "Code Generation Script",
    "current_num_of_type": 0,
    "description": "Scripts that generate code, type definitions, configuration files, or other source code artifacts.",
    "mime_type": "[\"text/javascript\",\"application/x-shellscript\",\"text/x-python\",\"text/x-ruby\"]",
    "file_extension": "[\"js\",\"ts\",\"sh\",\"py\",\"rb\"]",
    "document_type_counts": 0,
    "category": "Development",
    "created_at": "2025-03-16T03:22:24.007+00:00",
    "updated_at": "2025-03-16T03:22:24.007+00:00",
    "required_fields": [
      "script_purpose",
      "output_language",
      "input_parameters",
      "execution_environment"
    ],
    "legacy_document_type_id": null,
    "is_ai_generated": true,
    "content_schema": null,
    "ai_processing_rules": {
      "check_code_style": true,
      "extract_usage_patterns": true,
      "detect_hardcoded_values": true,
      "identify_security_risks": true,
      "analyze_input_validation": true,
      "identify_output_language": true,
      "detect_templating_patterns": true,
      "detect_error_handling_patterns": true,
      "evaluate_documentation_quality": true,
      "suggest_performance_improvements": true
    },
    "validation_rules": {
      "max_complexity_score": 25,
      "min_documentation_ratio": 0.15,
      "should_have_error_handling": true,
      "should_have_usage_examples": true,
      "should_specify_dependencies": true,
      "should_validate_generated_code": true,
      "should_document_input_requirements": true,
      "should_include_version_compatibility": true
    }
  },
  {
    "id": "f7e83857-8bb8-4b18-9d8f-16d5cb783650",
    "document_type": "Environment Setup Script",
    "current_num_of_type": 0,
    "description": "Scripts for setting up development environments, installing dependencies, configuring permissions, and preparing workspaces.",
    "mime_type": "application/x-shellscript,text/javascript,application/x-powershell,application/x-bat,text/x-python",
    "file_extension": "sh,js,ps1,bat,py",
    "document_type_counts": 0,
    "category": "Operations",
    "created_at": "2025-03-16T03:23:20.197+00:00",
    "updated_at": "2025-03-16T03:23:20.197+00:00",
    "required_fields": [
      "script_purpose",
      "target_environment",
      "prerequisite_checks"
    ],
    "legacy_document_type_id": null,
    "is_ai_generated": true,
    "content_schema": null,
    "ai_processing_rules": {
      "analyze_idempotency": true,
      "extract_execution_flow": true,
      "flag_security_concerns": true,
      "identify_error_handling": true,
      "identify_permission_changes": true,
      "check_environment_validation": true,
      "detect_resource_requirements": true,
      "detect_dependency_installation": true
    },
    "validation_rules": {
      "should_be_idempotent": true,
      "should_have_comments": true,
      "should_have_version_info": true,
      "should_check_prerequisites": true,
      "should_have_error_handling": true,
      "should_have_usage_instructions": true
    }
  },
  {
    "id": "53f42e7d-78bd-4bde-8106-dc12a4835695",
    "document_type": "Document Processing Script",
    "current_num_of_type": 0,
    "description": "Scripts for generating, analyzing, or transforming documentation files such as markdown documents, reports, and documentation databases.",
    "mime_type": "application/x-shellscript,text/javascript,text/x-python,text/x-ruby",
    "file_extension": "sh,js,py,rb",
    "document_type_counts": 0,
    "category": "Operations",
    "created_at": "2025-03-16T03:17:54.567+00:00",
    "updated_at": "2025-03-16T03:36:41.973+00:00",
    "required_fields": [
      "script_purpose",
      "input_format",
      "output_format",
      "execution_instructions"
    ],
    "legacy_document_type_id": null,
    "is_ai_generated": true,
    "content_schema": null,
    "ai_processing_rules": {
      "detect_file_operations": true,
      "check_database_integration": true,
      "identify_markdown_processing": true,
      "extract_documentation_patterns": true,
      "identify_report_generation_logic": true,
      "detect_document_classification_methods": true
    },
    "validation_rules": {
      "should_specify_dependencies": true,
      "should_handle_file_not_found": true,
      "should_document_output_format": true,
      "should_include_error_handling": true,
      "should_have_usage_instructions": true
    }
  },
  {
    "id": "682afaf1-1f16-4afe-a706-dc8e5ac2cf90",
    "document_type": "Api Integration Script",
    "current_num_of_type": 0,
    "description": "Scripts that interact with external APIs, web services, or third-party systems to exchange data or trigger actions. Examples include API clients, webhook handlers, and integration testers.",
    "mime_type": "text/javascript,application/x-shellscript,text/x-python,text/x-ruby,text/x-php,text/typescript",
    "file_extension": "js,sh,py,rb,php,ts",
    "document_type_counts": 0,
    "category": "Integration",
    "created_at": "2025-03-16T03:28:09.573+00:00",
    "updated_at": "2025-03-16T03:28:09.573+00:00",
    "required_fields": [
      "script_purpose",
      "api_endpoint",
      "authentication_method"
    ],
    "legacy_document_type_id": null,
    "is_ai_generated": true,
    "content_schema": null,
    "ai_processing_rules": {
      "detect_api_endpoints": true,
      "extract_dependencies": true,
      "analyze_error_handling": true,
      "identify_rate_limiting": true,
      "check_response_handling": true,
      "identify_data_transformations": true,
      "detect_security_vulnerabilities": true,
      "identify_authentication_methods": true
    },
    "validation_rules": {
      "should_validate_input": true,
      "should_handle_timeouts": true,
      "should_include_logging": true,
      "should_handle_api_errors": true,
      "should_handle_pagination": true,
      "should_have_rate_limiting": true
    }
  },
  {
    "id": "95390c42-2048-41f7-ba30-59d48d3f1075",
    "document_type": "AI Workflow Script",
    "current_num_of_type": 0,
    "description": "Scripts that manage AI-related workflows, such as model serving, prompt processing, or AI service integration.",
    "mime_type": "application/x-shellscript,text/javascript,text/x-python",
    "file_extension": "sh,js,py",
    "document_type_counts": 0,
    "category": "AI",
    "created_at": "2025-03-16T03:29:47.413+00:00",
    "updated_at": "2025-03-16T03:29:47.413+00:00",
    "required_fields": [
      "script_purpose",
      "ai_model",
      "input_format",
      "output_handling"
    ],
    "legacy_document_type_id": null,
    "is_ai_generated": true,
    "content_schema": null,
    "ai_processing_rules": {
      "detect_ai_service_calls": true,
      "extract_model_parameters": true,
      "identify_prompt_templates": true,
      "check_token_usage_estimation": true,
      "identify_error_handling_patterns": true
    },
    "validation_rules": {
      "should_include_logging": true,
      "should_sanitize_user_inputs": true,
      "should_handle_api_rate_limits": true,
      "should_include_error_handling": true,
      "should_document_model_parameters": true
    }
  },
  {
    "id": "4fdbd8be-fe5a-4341-934d-2b6bd43be7be",
    "document_type": "CI CD Pipeline Script",
    "current_num_of_type": 0,
    "description": "Scripts designed to run in continuous integration and deployment pipelines, including testing, validation, and release automation.",
    "mime_type": "application/x-shellscript,text/javascript,text/yaml,text/x-python,text/x-ruby,application/x-powershell",
    "file_extension": "sh,js,yml,yaml,ps1,py,rb",
    "document_type_counts": 0,
    "category": "Operations",
    "created_at": "2025-03-16T03:24:20.474+00:00",
    "updated_at": "2025-03-16T03:32:46.456+00:00",
    "required_fields": [
      "script_purpose",
      "pipeline_stage",
      "execution_environment"
    ],
    "legacy_document_type_id": null,
    "is_ai_generated": true,
    "content_schema": null,
    "ai_processing_rules": {
      "detect_ci_platform": {
        "platforms": [
          "github_actions",
          "jenkins",
          "gitlab_ci",
          "azure_devops",
          "circle_ci",
          "travis_ci"
        ]
      },
      "detect_security_risks": true,
      "analyze_error_handling": true,
      "detect_pipeline_stages": true,
      "identify_resource_usage": true,
      "identify_test_execution": true,
      "check_notification_mechanisms": true,
      "extract_environment_variables": true
    },
    "validation_rules": {
      "should_be_idempotent": true,
      "should_include_comments": true,
      "should_have_clear_exit_codes": true,
      "should_have_timeout_handling": true,
      "should_log_execution_progress": true,
      "should_handle_errors_gracefully": true
    }
  },
  {
    "id": "561a86b0-7064-4c20-a40e-2ec6905c4a42",
    "document_type": "Database Management Script",
    "current_num_of_type": 0,
    "description": "Scripts for database operations including migrations, schema management, backups, and query execution.",
    "mime_type": "application/x-shellscript,text/javascript,application/sql,text/x-python,text/x-ruby",
    "file_extension": "sh,js,sql,py,rb",
    "document_type_counts": 0,
    "category": "Operations",
    "created_at": "2025-03-16T03:13:54.493+00:00",
    "updated_at": "2025-03-16T03:37:15.774+00:00",
    "required_fields": [
      "script_purpose",
      "database_type",
      "execution_environment"
    ],
    "legacy_document_type_id": null,
    "is_ai_generated": true,
    "content_schema": null,
    "ai_processing_rules": {
      "detect_db_operations": true,
      "identify_sql_queries": true,
      "detect_error_handling": true,
      "analyze_schema_changes": true,
      "identify_security_risks": true,
      "analyze_query_performance": true,
      "check_transaction_handling": true,
      "detect_sensitive_data_handling": true
    },
    "validation_rules": {
      "should_have_logging": true,
      "should_have_error_handling": true,
      "should_document_db_dependencies": true,
      "should_include_rollback_mechanism": true,
      "should_validate_connection_parameters": true
    }
  }
]
