# Database Tables Overview by Functional Group

## Documentation Management
| Table Name | Table Type | Size | Row Count | Description |
|------------|------------|------|-----------|-------------|
| documentation_files | BASE TABLE | 624 kB | 225 | Primary table for storing documentation files |
| documentation_files_missing_doc_ids | BASE TABLE | 952 kB | 299 | Documentation files with missing document IDs |
| documentation_files_missing_doc_ids2 | BASE TABLE | 568 kB | 346 | Secondary table for documentation files with missing IDs |
| documentation_sections | BASE TABLE | 120 kB | 51 | Sections or components of documentation files |
| documentation_processing_queue | BASE TABLE | 96 kB | 51 | Queue for documents waiting to be processed |
| documentation_relations | BASE TABLE | 48 kB | 0 | Relationships between documentation items |
| document_types | BASE TABLE | 144 kB | 24 | Types or categories of documents |
| document_type_aliases | BASE TABLE | 48 kB | 0 | Alternative names for document types |

## Documentation Backups
| Table Name | Table Type | Size | Row Count | Description |
|------------|------------|------|-----------|-------------|
| documentation_files_backup_20240317_snapshot_20240318 | BASE TABLE | 424 kB | 196 | Backup from March 2024 |
| documentation_files_backup_20250216 | BASE TABLE | 368 kB | 157 | Backup from February 2025 |
| documentation_files_backup_20250318 | BASE TABLE | 424 kB | 196 | Backup from March 18, 2025 |
| documentation_files_backup_20250318b | BASE TABLE | 368 kB | 151 | Secondary backup from March 18, 2025 |
| documentation_files_backup_20250321 | BASE TABLE | 240 kB | 100 | Backup from March 21, 2025 |
| documentation_files_backup_20250324 | BASE TABLE | 392 kB | 171 | Backup from March 24, 2025 |

## Expert and Knowledge Management
| Table Name | Table Type | Size | Row Count | Description |
|------------|------------|------|-----------|-------------|
| expert_documents | BASE TABLE | 1752 kB | 122 | Documents associated with experts or knowledge domains |
| experts | BASE TABLE | 160 kB | 0 | Information about subject matter experts |
| citation_expert_aliases | BASE TABLE | 64 kB | 0 | Alternative names for citation experts |

## Source Management
| Table Name | Table Type | Size | Row Count | Description |
|------------|------------|------|-----------|-------------|
| sources | BASE TABLE | 64 kB | 0 | General source information |
| sources_google | BASE TABLE | 9520 kB | 724 | Sources from Google (largest table) |
| sources_google_backup | BASE TABLE | 1232 kB | 908 | Backup of Google sources |
| temp_sources | BASE TABLE | 16 kB | 0 | Temporary source storage |

## Prompt and Script Management
| Table Name | Table Type | Size | Row Count | Description |
|------------|------------|------|-----------|-------------|
| prompts | BASE TABLE | 192 kB | 4 | Stored prompts or templates |
| prompt_categories | BASE TABLE | 48 kB | 1 | Categories for organizing prompts |
| prompt_relationships | BASE TABLE | 80 kB | 1 | Relationships between prompts |
| prompt_relationships_backup_20250309_205247 | BASE TABLE | 24 kB | 0 | Backup of prompt relationships |
| prompt_usage | BASE TABLE | 16 kB | 0 | Usage statistics for prompts |
| scripts | BASE TABLE | 848 kB | 131 | Stored scripts or code snippets |
| scripts_backup_20250216 | BASE TABLE | 32 kB | 73 | Backup of scripts |

## Command Management
| Table Name | Table Type | Size | Row Count | Description |
|------------|------------|------|-----------|-------------|
| command_categories | BASE TABLE | 48 kB | 7 | Categories for organizing commands |
| command_history | BASE TABLE | 40 kB | 0 | History of executed commands |
| command_patterns | BASE TABLE | 32 kB | 5 | Patterns for command recognition |
| command_suggestions | VIEW | 0 bytes | - | View for suggested commands |
| favorite_commands | BASE TABLE | 16 kB | 0 | User's favorite commands |

## Presentation Management
| Table Name | Table Type | Size | Row Count | Description |
|------------|------------|------|-----------|-------------|
| presentations | BASE TABLE | 88 kB | 0 | Main presentations table |
| presentation_assets | BASE TABLE | 32 kB | 0 | Assets used in presentations |
| presentation_collections | BASE TABLE | 16 kB | 0 | Collections of presentations |
| presentation_collection_items | BASE TABLE | 16 kB | 0 | Items within presentation collections |
| presentation_relationships | BASE TABLE | 48 kB | 0 | Relationships between presentations |
| presentation_search_index | BASE TABLE | 48 kB | 0 | Search index for presentations |
| presentation_tags | BASE TABLE | 24 kB | 0 | Tags for categorizing presentations |
| presentation_tag_links | BASE TABLE | 8192 bytes | 0 | Links between presentations and tags |
| presentation_themes | BASE TABLE | 24 kB | 0 | Themes for presentations |
| presentation_theme_links | BASE TABLE | 8192 bytes | 0 | Links between presentations and themes |

## Application Management
| Table Name | Table Type | Size | Row Count | Description |
|------------|------------|------|-----------|-------------|
| app_pages | BASE TABLE | 64 kB | 2 | Pages within the application |
| app_state | BASE TABLE | 40 kB | 0 | Application state information |
| page_dependencies | BASE TABLE | 32 kB | 0 | Dependencies for pages |
| page_function_usage | BASE TABLE | 32 kB | 0 | Function usage on pages |
| page_guts_raw_data | VIEW | 0 bytes | - | View of page raw data |
| page_table_usage | BASE TABLE | 32 kB | 0 | Table usage on pages |
| profiles | BASE TABLE | 32 kB | 1 | User or application profiles |

## Email Management
| Table Name | Table Type | Size | Row Count | Description |
|------------|------------|------|-----------|-------------|
| emails | BASE TABLE | 14 MB | 0 | Stored emails (largest table by size) |
| email_addresses | BASE TABLE | 264 kB | 0 | Email address information |
| lionya_emails | BASE TABLE | 32 kB | 0 | Specialized email category |

## Audio Processing
| Table Name | Table Type | Size | Row Count | Description |
|------------|------------|------|-----------|-------------|
| audio_processing_configs | BASE TABLE | 32 kB | 0 | Configuration for audio processing |
| audio_processing_stages | BASE TABLE | 48 kB | 0 | Stages in audio processing pipeline |
| audio_processor_steps | BASE TABLE | 16 kB | 0 | Steps within audio processing stages |
| audio_segments | BASE TABLE | 40 kB | 0 | Segmented audio data |
| speaker_profiles | BASE TABLE | 16 kB | 0 | Profiles for different speakers |
| transcription_feedback | BASE TABLE | 16 kB | 0 | Feedback on transcription quality |

## Function and Asset Management
| Table Name | Table Type | Size | Row Count | Description |
|------------|------------|------|-----------|-------------|
| function_registry | BASE TABLE | 176 kB | 0 | Registry of available functions |
| function_relationships | BASE TABLE | 64 kB | 0 | Relationships between functions |
| asset_types | BASE TABLE | 48 kB | 6 | Types of assets in the system |

## Processing and AI
| Table Name | Table Type | Size | Row Count | Description |
|------------|------------|------|-----------|-------------|
| ai_processing_attempts | BASE TABLE | 24 kB | 0 | Records of AI processing attempts |
| processing_batches | BASE TABLE | 88 kB | 0 | Batches of items for processing |
| processing_templates | BASE TABLE | 16 kB | 0 | Templates for processing operations |
| batch_processing_status | VIEW | 0 bytes | - | View of batch processing status |

## Synchronization and Querying
| Table Name | Table Type | Size | Row Count | Description |
|------------|------------|------|-----------|-------------|
| sync_history | BASE TABLE | 40 kB | 0 | History of synchronization operations |
| sync_history_backup | BASE TABLE | 16 kB | 17 | Backup of synchronization history |
| sync_statistics | BASE TABLE | 16 kB | 0 | Statistics about synchronization |
| sql_query_history | BASE TABLE | 144 kB | 4 | History of SQL queries |
| sql_query_tags | BASE TABLE | 32 kB | 0 | Tags for categorizing SQL queries |
| sql_query_tag_mappings | BASE TABLE | 24 kB | 0 | Mappings between queries and tags |

## Miscellaneous
| Table Name | Table Type | Size | Row Count | Description |
|------------|------------|------|-----------|-------------|
| domains | BASE TABLE | 112 kB | 0 | Domain information |
| google_auth_tokens | BASE TABLE | 16 kB | 0 | Authentication tokens for Google services |
| user_annotations | BASE TABLE | 16 kB | 0 | User annotations or notes |
