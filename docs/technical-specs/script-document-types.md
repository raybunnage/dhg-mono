# Script Document Types for Classification

This document outlines a comprehensive categorization system for script files in a monorepo environment. These categories are designed to be used as document types for automatic classification of script files (.sh, .js, .py, etc.) by AI analysis.

## Overview

The following script document types are designed to:
1. Provide clear categorization of scripts by their primary purpose
2. Facilitate discovery and maintenance of scripts in a large codebase
3. Help identify duplicate or redundant scripts
4. Support script assessment and lifecycle management

## Script Document Types

### 1. Database Management Script

**Name**: `database_management_script`  
**Category**: Database  
**Description**: Scripts for database operations including migrations, schema management, backups, and query execution.  
**Examples**: Migration runners, SQL executors, backup/restore scripts  
**Typical Extensions**: `.sh`, `.js`, `.sql`  
**Key Identifiers**: Keywords like "database", "migration", "SQL", "schema", "psql", "supabase"

```json
{
  "name": "Database Management Script",
  "document_type": "database_management_script",
  "category": "Database",
  "description": "Scripts for database operations including migrations, schema management, backups, and query execution.",
  "mime_type": "application/x-shellscript,text/javascript",
  "file_extension": "sh,js,sql",
  "ai_processing_rules": {
    "detect_db_operations": true,
    "identify_sql_queries": true,
    "check_transaction_handling": true,
    "detect_error_handling": true
  },
  "validation_rules": {
    "should_have_error_handling": true,
    "should_document_db_dependencies": true
  },
  "required_fields": [
    "script_purpose",
    "database_type"
  ]
}
```

### 2. Deployment Script

**Name**: `deployment_script`  
**Category**: Operations  
**Description**: Scripts for deploying applications to various environments, managing environment configurations, and provisioning resources.  
**Examples**: Deploy to dev/prod, backup configurations, setup environments  
**Typical Extensions**: `.sh`, `.js`  
**Key Identifiers**: Keywords like "deploy", "environment", "config", "setup", "provision"

```json
{
  "name": "Deployment Script",
  "document_type": "deployment_script",
  "category": "Operations",
  "description": "Scripts for deploying applications to various environments, managing environment configurations, and provisioning resources.",
  "mime_type": "application/x-shellscript,text/javascript",
  "file_extension": "sh,js",
  "ai_processing_rules": {
    "detect_environment_variables": true,
    "identify_deployment_targets": true,
    "check_rollback_mechanisms": true
  },
  "validation_rules": {
    "should_have_environment_checks": true,
    "should_have_error_handling": true
  },
  "required_fields": [
    "deployment_target",
    "script_purpose"
  ]
}
```

### 3. Document Processing Script

**Name**: `Document Processing Script`  
**Category**: Documentation  
**Description**: Scripts for generating, analyzing, or transforming documentation files such as markdown documents, reports, and documentation databases.  
**Examples**: Generate markdown reports, classify documents, sync docs database  
**Typical Extensions**: `.sh`, `.js`  
**Key Identifiers**: Keywords like "markdown", "docs", "classify", "report", "documentation"

```json
{
  "name": "Document Processing Script",
  "document_type": "document_processing_script",
  "category": "Documentation",
  "description": "Scripts for generating, analyzing, or transforming documentation files such as markdown documents, reports, and documentation databases.",
  "mime_type": "application/x-shellscript,text/javascript",
  "file_extension": "sh,js",
  "ai_processing_rules": {
    "detect_file_operations": true,
    "identify_markdown_processing": true,
    "check_database_integration": true
  },
  "validation_rules": {
    "should_handle_file_not_found": true,
    "should_document_output_format": true
  },
  "required_fields": [
    "script_purpose",
    "output_format"
  ]
}
```

### 4. Build Automation Script

**Name**: `Build Automation Script`  
**Category**: Development  
**Description**: Scripts for building applications, compiling code, bundling assets, and automating development workflows.  
**Examples**: Bundle assets, compile code, run dev servers  
**Typical Extensions**: `.sh`, `.js`  
**Key Identifiers**: Keywords like "build", "compile", "bundle", "webpack", "vite"

```json
{
  "name": "Build Automation Script",
  "document_type": "build_automation_script",
  "category": "Development",
  "description": "Scripts for building applications, compiling code, bundling assets, and automating development workflows.",
  "mime_type": "application/x-shellscript,text/javascript",
  "file_extension": "sh,js",
  "ai_processing_rules": {
    "detect_build_tools": true,
    "identify_package_dependencies": true,
    "check_optimization_settings": true
  },
  "validation_rules": {
    "should_handle_build_errors": true,
    "should_document_build_options": true
  },
  "required_fields": [
    "script_purpose",
    "build_targets"
  ]
}
```

### 5. Data Processing Script

**Name**: `data_processing_script`  
**Category**: Data  
**Description**: Scripts for processing, transforming, analyzing, or migrating data between systems.  
**Examples**: CSV processors, data importers/exporters, data analyzers  
**Typical Extensions**: `.sh`, `.js`, `.py`  
**Key Identifiers**: Keywords like "data", "csv", "import", "export", "transform", "analysis"

```json
{
  "name": "Data Processing Script",
  "document_type": "Data Processing Script",
  "category": "Data",
  "description": "Scripts for processing, transforming, analyzing, or migrating data between systems.",
  "mime_type": "application/x-shellscript,text/javascript,text/x-python",
  "file_extension": "sh,js,py",
  "ai_processing_rules": {
    "detect_data_formats": true,
    "identify_transformation_operations": true,
    "check_data_validation": true
  },
  "validation_rules": {
    "should_validate_input_data": true,
    "should_handle_malformed_data": true
  },
  "required_fields": [
    "data_format",
    "script_purpose"
  ]
}
```

### 6. Code Generation Script

**Name**: `code_generation_script`  
**Category**: Development  
**Description**: Scripts that generate code, type definitions, configuration files, or other source code artifacts.  
**Examples**: Type generators, API client generators, config generators  
**Typical Extensions**: `.js`, `.ts`, `.sh`  
**Key Identifiers**: Keywords like "generate", "types", "interfaces", "code gen"

```json
{
  "name": "Code Generation Script",
  "document_type": "code_generation_script",
  "category": "Development",
  "description": "Scripts that generate code, type definitions, configuration files, or other source code artifacts.",
  "mime_type": "text/javascript,application/x-shellscript",
  "file_extension": "js,ts,sh",
  "ai_processing_rules": {
    "detect_templating_patterns": true,
    "identify_output_language": true,
    "check_code_style": true
  },
  "validation_rules": {
    "should_document_input_requirements": true,
    "should_validate_generated_code": true
  },
  "required_fields": [
    "script_purpose",
    "output_language"
  ]
}
```

### 7. Environment Setup Script

**Name**: `environment_setup_script`  
**Category**: Operations  
**Description**: Scripts for setting up development environments, installing dependencies, configuring permissions, and preparing workspaces.  
**Examples**: Dev environment setup, permission setters, workspace initializers  
**Typical Extensions**: `.sh`, `.js`  
**Key Identifiers**: Keywords like "setup", "install", "init", "permissions", "environment"

```json
{
  "name": "Environment Setup Script",
  "document_type": "environment_setup_script",
  "category": "Operations",
  "description": "Scripts for setting up development environments, installing dependencies, configuring permissions, and preparing workspaces.",
  "mime_type": "application/x-shellscript,text/javascript",
  "file_extension": "sh,js",
  "ai_processing_rules": {
    "detect_dependency_installation": true,
    "identify_permission_changes": true,
    "check_environment_validation": true
  },
  "validation_rules": {
    "should_check_prerequisites": true,
    "should_have_idempotency": true
  },
  "required_fields": [
    "script_purpose",
    "target_environment"
  ]
}
```

### 8. CI/CD Pipeline Script

**Name**: `ci_cd_pipeline_script`  
**Category**: DevOps  
**Description**: Scripts designed to run in continuous integration and deployment pipelines, including testing, validation, and release automation.  
**Examples**: Test runners, linters, release automators  
**Typical Extensions**: `.sh`, `.js`, `.yml`  
**Key Identifiers**: Keywords like "CI", "CD", "pipeline", "test", "github", "workflow"

```json
{
  "name": "CI/CD Pipeline Script",
  "document_type": "ci_cd_pipeline_script",
  "category": "DevOps",
  "description": "Scripts designed to run in continuous integration and deployment pipelines, including testing, validation, and release automation.",
  "mime_type": "application/x-shellscript,text/javascript",
  "file_extension": "sh,js,yml",
  "ai_processing_rules": {
    "detect_pipeline_stages": true,
    "identify_test_execution": true,
    "check_notification_mechanisms": true
  },
  "validation_rules": {
    "should_have_clear_exit_codes": true,
    "should_log_execution_progress": true
  },
  "required_fields": [
    "script_purpose",
    "pipeline_stage"
  ]
}
```

### 9. Utility Script

**Name**: `utility_script`  
**Category**: Utility  
**Description**: General-purpose utility scripts that provide commonly needed functionality across the codebase or development workflow.  
**Examples**: File manipulators, text processors, search tools  
**Typical Extensions**: `.sh`, `.js`  
**Key Identifiers**: Keywords like "utility", "helper", "tool", "search", "find"

```json
{
  "name": "Utility Script",
  "document_type": "utility_script",
  "category": "Utility",
  "description": "General-purpose utility scripts that provide commonly needed functionality across the codebase or development workflow.",
  "mime_type": "application/x-shellscript,text/javascript",
  "file_extension": "sh,js",
  "ai_processing_rules": {
    "detect_common_operations": true,
    "identify_reusability_patterns": true,
    "check_argument_handling": true
  },
  "validation_rules": {
    "should_have_help_documentation": true,
    "should_handle_input_validation": true
  },
  "required_fields": [
    "script_purpose",
    "usage_examples"
  ]
}
```

### 10. System Monitoring Script


**Name**: `utility_script`  
**Category**: Utility  
**Description**: General-purpose utility scripts that provide commonly needed functionality across the codebase or development workflow.  
**Examples**: File manipulators, text processors, search tools  
**Typical Extensions**: `.sh`, `.js`  
**Key Identifiers**: Keywords like "utility", "helper", "tool", "search", "find"

```json
{
  "name": "Utility Script",
  "document_type": "utility_script",
  "category": "Utility",
  "description": "General-purpose utility scripts that provide commonly needed functionality across the codebase or development workflow.",
  "mime_type": "application/x-shellscript,text/javascript",
  "file_extension": "sh,js",
  "ai_processing_rules": {
    "detect_common_operations": true,
    "identify_reusability_patterns": true,
    "check_argument_handling": true
  },
  "validation_rules": {
    "should_have_help_documentation": true,
    "should_handle_input_validation": true
  },
  "required_fields": [
    "script_purpose",
    "usage_examples"
  ]
}
```

### 11. API Integration Script

**Name**: `api_integration_script`  
**Category**: Integration  
**Description**: Scripts that interact with external APIs, web services, or third-party systems to exchange data or trigger actions.  
**Examples**: API clients, webhook handlers, integration testers  
**Typical Extensions**: `.js`, `.sh`, `.py`  
**Key Identifiers**: Keywords like "API", "fetch", "request", "endpoint", "integration"

```json
{
  "name": "API Integration Script",
  "document_type": "api_integration_script",
  "category": "Integration",
  "description": "Scripts that interact with external APIs, web services, or third-party systems to exchange data or trigger actions.",
  "mime_type": "text/javascript,application/x-shellscript,text/x-python",
  "file_extension": "js,sh,py",
  "ai_processing_rules": {
    "detect_api_endpoints": true,
    "identify_authentication_methods": true,
    "check_response_handling": true
  },
  "validation_rules": {
    "should_handle_api_errors": true,
    "should_have_rate_limiting": true
  },
  "required_fields": [
    "script_purpose",
    "api_endpoint"
  ]
}
```

### 12. AI Workflow Script

**Name**: `ai_workflow_script`  
**Category**: AI  
**Description**: Scripts that manage AI-related workflows, such as model serving, prompt processing, or AI service integration.  
**Examples**: Claude API callers, prompt processors, AI output analyzers  
**Typical Extensions**: `.sh`, `.js`, `.py`  
**Key Identifiers**: Keywords like "AI", "Claude", "prompt", "model", "anthropic"

```json
{
  "name": "AI Workflow Script",
  "document_type": "ai_workflow_script",
  "category": "AI",
  "description": "Scripts that manage AI-related workflows, such as model serving, prompt processing, or AI service integration.",
  "mime_type": "application/x-shellscript,text/javascript,text/x-python",
  "file_extension": "sh,js,py",
  "ai_processing_rules": {
    "detect_ai_service_calls": true,
    "identify_prompt_templates": true,
    "check_token_usage": true
  },
  "validation_rules": {
    "should_handle_api_rate_limits": true,
    "should_document_model_parameters": true
  },
  "required_fields": [
    "script_purpose",
    "ai_model"
  ]
}
```

## Implementation Guide

To implement these document types in your system:

1. Create each document type in your database (document_types table)
2. Update your script analysis prompt to categorize scripts according to these types
3. Ensure that any script assessment processes check for the specific characteristics of each script type
4. Consider adding specialized validation rules for each script type

## Mapping Strategy

When mapping scripts to these document types, consider the following hierarchy:

1. First, examine script filename and path for obvious clues
2. Next, analyze script content for keywords and patterns
3. Check for references in package.json files to understand usage context
4. Consider database migrations, API references, and other specialized indicators
5. Default to "Utility Script" when no clear category is evident

## Complete JSON Format for Database Import

The following JSON format can be used for importing all script document types into your database at once:

```json
[
  {
    "name": "Database Management Script",
    "document_type": "database_management_script",
    "category": "Database",
    "description": "Scripts for database operations including migrations, schema management, backups, and query execution."
  },
  {
    "name": "Deployment Script",
    "document_type": "deployment_script",
    "category": "Operations",
    "description": "Scripts for deploying applications to various environments, managing environment configurations, and provisioning resources."
  },
  {
    "name": "Document Processing Script",
    "document_type": "document_processing_script",
    "category": "Documentation",
    "description": "Scripts for generating, analyzing, or transforming documentation files such as markdown documents, reports, and documentation databases."
  },
  {
    "name": "Build Automation Script",
    "document_type": "build_automation_script",
    "category": "Development",
    "description": "Scripts for building applications, compiling code, bundling assets, and automating development workflows."
  },
  {
    "name": "Data Processing Script",
    "document_type": "data_processing_script",
    "category": "Data",
    "description": "Scripts for processing, transforming, analyzing, or migrating data between systems."
  },
  {
    "name": "Code Generation Script",
    "document_type": "code_generation_script",
    "category": "Development",
    "description": "Scripts that generate code, type definitions, configuration files, or other source code artifacts."
  },
  {
    "name": "Environment Setup Script",
    "document_type": "environment_setup_script",
    "category": "Operations",
    "description": "Scripts for setting up development environments, installing dependencies, configuring permissions, and preparing workspaces."
  },
  {
    "name": "CI/CD Pipeline Script",
    "document_type": "ci_cd_pipeline_script",
    "category": "DevOps",
    "description": "Scripts designed to run in continuous integration and deployment pipelines, including testing, validation, and release automation."
  },
  {
    "name": "Utility Script",
    "document_type": "utility_script",
    "category": "Utility",
    "description": "General-purpose utility scripts that provide commonly needed functionality across the codebase or development workflow."
  },
  {
    "name": "System Monitoring Script",
    "document_type": "monitoring_script",
    "category": "Operations",
    "description": "Scripts for monitoring system health, resource usage, logs, and application status."
  },
  {
    "name": "API Integration Script",
    "document_type": "api_integration_script",
    "category": "Integration",
    "description": "Scripts that interact with external APIs, web services, or third-party systems to exchange data or trigger actions."
  },
  {
    "name": "AI Workflow Script",
    "document_type": "ai_workflow_script",
    "category": "AI",
    "description": "Scripts that manage AI-related workflows, such as model serving, prompt processing, or AI service integration."
  }
]
```
