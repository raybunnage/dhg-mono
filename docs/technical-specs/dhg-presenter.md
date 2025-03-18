# DHG Presenter Database Schema Specification

This document provides a comprehensive specification for the DHG Presenter database schema, focusing on tables related to the audio processing pipeline. Each section describes a key table, its fields, relationships, and usage within the application.

## Table of Contents

1. [Google Drive Sources](#1-sources_google)
2. [Processing Batches](#2-processing_batches)
3. [Audio Processing Stages](#3-audio_processing_stages) 
4. [Expert Documents](#4-expert_documents)
5. [Audio Segments](#5-audio_segments)
6. [Speaker Profiles](#6-speaker_profiles)
7. [AI Processing Attempts](#7-ai_processing_attempts)
8. [Audio Processing Configs](#8-audio_processing_configs)
9. [Audio Processor Steps](#9-audio_processor_steps)
10. [Presentations](#10-presentations)
11. [Presentation Assets](#11-presentation_assets)
12. [User Annotations](#12-user_annotations)
13. [Tags and Tagging](#13-tags-and-tagging)
14. [Data Flow & Relationships](#14-data-flow--relationships)

## 1. sources_google

**Purpose:** Tracks files from Google Drive, particularly MP4 videos that need audio extraction and processing.

| Field | Type | Description | Usage |
|-------|------|-------------|-------|
| id | uuid | Primary key | Unique identifier for the record |
| drive_id | text | Google Drive file ID | Used to locate and download the file from Google Drive |
| name | text | File name | Display name and reference |
| mime_type | text | MIME type | Identifies video files (video/mp4) that need processing |
| parent_folder_id | uuid | Reference to parent folder | Maintains folder hierarchy |
| audio_extracted | boolean | Extraction status | Tracks whether audio has been extracted |
| audio_extraction_path | text | Path to extracted audio | Location of the extracted M4A file |
| audio_duration_seconds | float | Audio duration | Length of audio in seconds |
| audio_channels | integer | Number of audio channels | Audio quality metadata |
| audio_bitrate | integer | Audio bitrate | Audio quality metadata |
| audio_quality_metrics | jsonb | Quality metrics | Detailed audio quality information |
| size_bytes | bigint | File size | Size of the original file |
| web_view_link | text | Google Drive web link | Direct link to file in Google Drive |
| thumbnail_link | text | Thumbnail URL | Preview image of the file |
| created_at | timestamp | Creation timestamp | When record was created |
| updated_at | timestamp | Update timestamp | When record was last updated |
| created_by | uuid | Creator ID | User who created the record |
| updated_by | uuid | Updater ID | User who last updated the record |
| expert_id | uuid | Associated expert | Links to the expert if applicable |
| document_type_id | uuid | Document type reference | Categories the document type |

**Relationships:**
- Links to `experts` via `expert_id`
- Links to `document_types` via `document_type_id`
- Referenced by `audio_processing_stages` via `source_id`
- Referenced by `expert_documents` via `source_id`
- Self-reference via `parent_folder_id` to `drive_id` for folder hierarchy

**Usage:** This table is the entry point for the processing pipeline. The application scans Google Drive for video files, creates records here, and then processes them for audio extraction.

## 2. processing_batches

**Purpose:** Manages groups of processing jobs, providing a way to track and monitor bulk operations.

| Field | Type | Description | Usage |
|-------|------|-------------|-------|
| id | uuid | Primary key | Unique identifier for the batch |
| type | batch_type | Batch type | Identifies the type of processing (extraction, transcription, etc.) |
| status | processing_status | Current status | Overall status of the batch |
| started_at | timestamp | Start time | When processing started |
| completed_at | timestamp | Completion time | When processing completed |
| file_count | integer | Number of files | Count of files in this batch |
| processor_config | jsonb | Processing configuration | Configuration settings for this batch |
| error_details | text | Error information | Details if batch processing failed |
| total_duration_seconds | float | Total audio duration | Total duration of all files in batch |
| processed_duration_seconds | float | Processed duration | Duration of processed audio so far |
| created_at | timestamp | Creation timestamp | When batch was created |
| created_by | uuid | Creator ID | User who created the batch |

**Relationships:**
- Referenced by `audio_processing_stages` via `batch_id`
- Referenced by `expert_documents` via `batch_id`

**Usage:** When processing multiple files, a batch record is created to group them together. This allows for monitoring progress, handling errors, and providing overall status of multi-file operations.

## 3. audio_processing_stages

**Purpose:** Tracks individual stages of processing for a file, providing detailed progress monitoring.

| Field | Type | Description | Usage |
|-------|------|-------------|-------|
| id | uuid | Primary key | Unique identifier for the processing stage |
| batch_id | uuid | Batch reference | Links to the batch this stage belongs to |
| source_id | uuid | Source reference | Links to the Google Drive file being processed |
| stage_name | text | Stage name | Name of the processing stage (e.g., "extract", "transcribe") |
| status | text | Current status | Status of this specific stage |
| started_at | timestamp | Start time | When this stage started |
| completed_at | timestamp | Completion time | When this stage completed |
| error_message | text | Error details | Error information if stage failed |
| output_data | jsonb | Stage output | Data produced by this processing stage |
| metrics | jsonb | Performance metrics | Detailed performance information |
| created_at | timestamp | Creation timestamp | When this stage record was created |

**Relationships:**
- Links to `processing_batches` via `batch_id`
- Links to `sources_google` via `source_id`

**Usage:** Each file goes through multiple processing stages. This table tracks each stage individually, allowing for detailed monitoring, error handling, and performance analysis.

## 4. expert_documents

**Purpose:** Stores processed documents including transcripts and summaries generated from audio files.

| Field | Type | Description | Usage |
|-------|------|-------------|-------|
| id | uuid | Primary key | Unique identifier for the document |
| source_id | uuid | Source reference | Links to original Google Drive file |
| document_type_id | uuid | Document type | Identifies the type of document (transcript, summary) |
| expert_id | uuid | Expert reference | Links to the expert associated with this content |
| content | text | Document content | The actual transcript or summary text |
| title | text | Document title | Display title for the document |
| status | processing_status | Processing status | Current status of document processing |
| batch_id | uuid | Batch reference | Links to the processing batch |
| previous_version_id | uuid | Previous version | References an earlier version of this document |
| transcription_complete | boolean | Transcription status | Whether transcription is complete |
| diarization_complete | boolean | Diarization status | Whether speaker identification is complete |
| summary_complete | boolean | Summary status | Whether summary generation is complete |
| whisper_model_used | text | Whisper model | Name of the Whisper model used for transcription |
| ai_processing_details | jsonb | Processing details | Detailed information about AI processing |
| confidence_score | float | Confidence level | Overall confidence score for the processing |
| token_count | integer | Token count | Number of tokens in the document |
| model_used | text | AI model | Name of the AI model used |
| prompt_used | text | AI prompt | Prompt used for AI processing |
| created_at | timestamp | Creation timestamp | When document was created |
| updated_at | timestamp | Update timestamp | When document was last updated |
| created_by | uuid | Creator ID | User who created the document |
| updated_by | uuid | Updater ID | User who last updated the document |

**Relationships:**
- Links to `sources_google` via `source_id`
- Links to `document_types` via `document_type_id`
- Links to `experts` via `expert_id`
- Links to `processing_batches` via `batch_id`
- Self-reference via `previous_version_id` for version history
- Referenced by `audio_segments` via `expert_document_id`
- Referenced by `ai_processing_attempts` via `expert_document_id`
- Referenced by `presentation_assets` via `expert_document_id`

**Usage:** This table stores the results of processing audio files, including transcripts and summaries. It tracks processing status and maintains version history of documents.

## 5. audio_segments

**Purpose:** Stores individual segments of audio with transcription and speaker information.

| Field | Type | Description | Usage |
|-------|------|-------------|-------|
| id | uuid | Primary key | Unique identifier for the segment |
| expert_document_id | uuid | Document reference | Links to the transcript document |
| start_time | float | Start timestamp | Start time of segment in seconds |
| end_time | float | End timestamp | End time of segment in seconds |
| transcript | text | Segment text | Transcribed text for this segment |
| speaker | text | Speaker identifier | Speaker label (e.g., "Speaker 1") |
| speaker_profile_id | uuid | Speaker profile | Links to identified speaker profile |
| confidence | float | Confidence score | Confidence level of transcription |
| created_at | timestamp | Creation timestamp | When segment was created |
| updated_at | timestamp | Update timestamp | When segment was last updated |

**Relationships:**
- Links to `expert_documents` via `expert_document_id`
- Links to `speaker_profiles` via `speaker_profile_id`
- Referenced by `transcription_feedback` via `segment_id`

**Usage:** When audio is transcribed and diarized, it's broken into segments with speaker identification. This table stores each segment with timing information for synchronized playback.

## 6. speaker_profiles

**Purpose:** Manages speaker identification across presentations to consistently identify the same speakers.

| Field | Type | Description | Usage |
|-------|------|-------------|-------|
| id | uuid | Primary key | Unique identifier for the speaker profile |
| name | text | Speaker name | Name of the identified speaker |
| voice_characteristics | jsonb | Voice data | Voice fingerprint and characteristics |
| expert_id | uuid | Expert reference | Links to an expert if this speaker is a known expert |
| created_at | timestamp | Creation timestamp | When profile was created |

**Relationships:**
- Links to `experts` via `expert_id`
- Referenced by `audio_segments` via `speaker_profile_id`

**Usage:** Speaker profiles enable consistent speaker identification across multiple presentations. They store voice fingerprints and can be linked to known experts in the system.

## 7. ai_processing_attempts

**Purpose:** Tracks individual AI processing attempts with detailed metrics on token usage, cost, and performance.

| Field | Type | Description | Usage |
|-------|------|-------------|-------|
| id | uuid | Primary key | Unique identifier for the processing attempt |
| expert_document_id | uuid | Document reference | Links to the document being processed |
| model_name | text | AI model name | Name of the AI model used |
| prompt | text | AI prompt | Text of the prompt sent to the AI |
| input_tokens | integer | Token count | Number of input tokens used |
| output_tokens | integer | Token count | Number of output tokens generated |
| duration_ms | integer | Duration | Processing time in milliseconds |
| cost | numeric | Processing cost | Cost of this processing attempt |
| success | boolean | Success flag | Whether the attempt was successful |
| error_message | text | Error details | Error information if attempt failed |
| created_at | timestamp | Creation timestamp | When attempt was recorded |

**Relationships:**
- Links to `expert_documents` via `expert_document_id`

**Usage:** This table provides detailed tracking of AI usage for analytics, debugging, and cost monitoring. Each API call to an AI service is recorded here.

## 8. audio_processing_configs

**Purpose:** Stores configuration templates for audio processing pipelines.

| Field | Type | Description | Usage |
|-------|------|-------------|-------|
| id | uuid | Primary key | Unique identifier for the configuration |
| name | text | Config name | Name of this configuration template |
| description | text | Description | Details about this configuration |
| configuration | jsonb | Configuration data | The actual configuration parameters |
| document_type_id | uuid | Document type | The document type this config produces |
| is_default | boolean | Default flag | Whether this is the default configuration |
| created_at | timestamp | Creation timestamp | When configuration was created |
| updated_at | timestamp | Update timestamp | When configuration was last updated |
| created_by | uuid | Creator ID | User who created the configuration |

**Relationships:**
- Links to `document_types` via `document_type_id`
- Referenced by `audio_processor_steps` via `config_id`

**Usage:** These configurations define how audio should be processed, including parameters for extraction, transcription, and diarization. They provide reusable templates for different processing requirements.

## 9. audio_processor_steps

**Purpose:** Defines the sequence of steps in an audio processing pipeline.

| Field | Type | Description | Usage |
|-------|------|-------------|-------|
| id | uuid | Primary key | Unique identifier for the step |
| config_id | uuid | Config reference | Links to the parent configuration |
| step_name | text | Step name | Name of this processing step |
| processor_type | text | Processor type | Type of processor to use |
| settings | jsonb | Step settings | Configuration for this specific step |
| sequence_order | integer | Order | Position in the sequence of steps |
| retry_policy | jsonb | Retry policy | How to handle retries for this step |
| created_at | timestamp | Creation timestamp | When step was created |

**Relationships:**
- Links to `audio_processing_configs` via `config_id`

**Usage:** Processing pipelines consist of multiple ordered steps. This table defines each step, its configuration, and its position in the sequence.

## 10. presentations

**Purpose:** Manages presentation metadata and links to the main video source.

| Field | Type | Description | Usage |
|-------|------|-------------|-------|
| id | uuid | Primary key | Unique identifier for the presentation |
| title | text | Presentation title | Display title |
| description | text | Description | Detailed description |
| main_video_id | uuid | Video reference | Links to the main video source |
| duration_seconds | float | Duration | Length of the presentation |
| is_published | boolean | Published flag | Whether presentation is published |
| created_at | timestamp | Creation timestamp | When presentation was created |
| updated_at | timestamp | Update timestamp | When presentation was last updated |
| created_by | uuid | Creator ID | User who created the presentation |
| updated_by | uuid | Updater ID | User who last updated the presentation |

**Relationships:**
- Links to `sources_google` via `main_video_id`
- Referenced by `presentation_assets` via `presentation_id`
- Referenced by `user_annotations` via `presentation_id`

**Usage:** This table represents a presentation that users can view, with links to its video source and associated assets.

## 11. presentation_assets

**Purpose:** Links various assets (transcripts, summaries, etc.) to presentations.

| Field | Type | Description | Usage |
|-------|------|-------------|-------|
| id | uuid | Primary key | Unique identifier for the asset |
| presentation_id | uuid | Presentation reference | Links to the presentation |
| source_id | uuid | Source reference | Links to original source if applicable |
| expert_document_id | uuid | Document reference | Links to expert document if applicable |
| asset_type_id | uuid | Asset type | Type of asset (transcript, summary, etc.) |
| asset_type | text | Type name | Name of the asset type |
| asset_role | text | Asset role | Role this asset plays in the presentation |
| metadata | jsonb | Asset metadata | Additional information about the asset |
| importance_level | integer | Importance | Priority/importance level (1-10) |
| user_notes | text | Notes | User-provided notes about this asset |
| timestamp_start | float | Start time | Start time of asset in presentation |
| timestamp_end | float | End time | End time of asset in presentation |
| created_at | timestamp | Creation timestamp | When asset was created |
| updated_at | timestamp | Update timestamp | When asset was last updated |
| created_by | uuid | Creator ID | User who created the asset |
| updated_by | uuid | Updater ID | User who last updated the asset |

**Relationships:**
- Links to `presentations` via `presentation_id`
- Links to `sources_google` via `source_id`
- Links to `expert_documents` via `expert_document_id`
- Links to `asset_types` via `asset_type_id`
- Referenced by `user_annotations` via `asset_id`

**Usage:** This table associates various assets with presentations, including timing information for synchronized display during playback.

## 12. user_annotations

**Purpose:** Stores user-created annotations and notes associated with specific moments in presentations.

| Field | Type | Description | Usage |
|-------|------|-------------|-------|
| id | uuid | Primary key | Unique identifier for the annotation |
| presentation_id | uuid | Presentation reference | Links to the presentation |
| asset_id | uuid | Asset reference | Links to the specific asset being annotated |
| user_id | uuid | User reference | User who created the annotation |
| annotation_type | text | Type of annotation | Categorizes the annotation (note, highlight, question, etc.) |
| content | text | Annotation content | The actual text of the annotation |
| timestamp | float | Time reference | Specific time in the presentation |
| duration | float | Duration | Length of time the annotation covers |
| visibility | text | Visibility setting | Controls who can see this annotation |
| metadata | jsonb | Additional data | Extra information about the annotation |
| created_at | timestamp | Creation timestamp | When annotation was created |
| updated_at | timestamp | Update timestamp | When annotation was last updated |

**Relationships:**
- Links to `presentations` via `presentation_id`
- Links to `presentation_assets` via `asset_id`
- Links to `auth.users` via `user_id`

**Usage:** This table allows users to create personal or shared annotations at specific points in a presentation. These annotations can be notes, questions, highlights, or other types of engagement with the content.

## 13. Tags and Tagging

### 13.1 tags

**Purpose:** Stores reusable tags for categorizing and organizing content.

| Field | Type | Description | Usage |
|-------|------|-------------|-------|
| id | uuid | Primary key | Unique identifier for the tag |
| name | text | Tag name | Display name of the tag |
| description | text | Tag description | Optional description of the tag's purpose |
| color | text | Color code | Visual identifier for the tag |
| icon | text | Icon reference | Visual icon for the tag |
| tag_type | text | Tag category | Categorizes the type of tag |
| created_at | timestamp | Creation timestamp | When tag was created |
| created_by | uuid | Creator ID | User who created the tag |

**Relationships:**
- Referenced by `tagged_items` via `tag_id`

**Usage:** Tags provide a flexible way to categorize and organize presentations, experts, and other content. They can be used for filtering, searching, and grouping related items.

### 13.2 tagged_items

**Purpose:** Junction table that associates tags with various content items.

| Field | Type | Description | Usage |
|-------|------|-------------|-------|
| id | uuid | Primary key | Unique identifier for the tagging |
| tag_id | uuid | Tag reference | Links to the tag |
| item_id | uuid | Item reference | ID of the tagged item |
| item_type | text | Item type | Type of item being tagged (presentation, expert, etc.) |
| created_at | timestamp | Creation timestamp | When tagging was created |
| created_by | uuid | Creator ID | User who created the tagging |

**Relationships:**
- Links to `tags` via `tag_id`
- Polymorphic relationship to various tables via `item_id` and `item_type`

**Usage:** This table implements a polymorphic tagging system, allowing tags to be applied to different types of content (presentations, experts, documents, etc.) while maintaining a single tags table.

## 14. Presentation Management

The presentation management system uses several interconnected tables to organize and deliver content:

1. **Content Organization**
   - `presentations` define the overall presentation container
   - `presentation_assets` link various content pieces to presentations
   - `tags` and `tagged_items` provide flexible categorization

2. **User Interaction**
   - `user_annotations` allow users to engage with specific content
   - Visibility controls determine which annotations are shared vs. private

3. **Content Discovery**
   - Tags facilitate searching and filtering presentations
   - Metadata in various tables supports advanced search capabilities
   - Relationships between experts, documents, and presentations create a connected knowledge graph

The audio processing pipeline follows these steps, represented by relationships between tables:

1. **Source Discovery**
   - Files are discovered in Google Drive and recorded in `sources_google`
   - MP4 files are identified for audio extraction

2. **Batch Creation**
   - A new record is created in `processing_batches` to group files
   - The batch type is set to "audio_extraction"

3. **Processing Stages**
   - For each file, stages are created in `audio_processing_stages`
   - Stages track progress through extraction, transcription, and diarization

4. **Audio Extraction**
   - Audio is extracted temporarily from MP4 files
   - M4A files are stored and their paths recorded in `sources_google.audio_extraction_path`
   - `sources_google.audio_extracted` is set to true

5. **Transcription & Diarization**
   - Extracted audio is processed through Whisper for transcription
   - Speaker diarization identifies different speakers
   - Results are stored in `expert_documents` with type "transcript"

6. **Segment Creation**
   - The transcript is split into segments in `audio_segments`
   - Each segment has timing and speaker information
   - Speakers are linked to `speaker_profiles` when identified

7. **AI Processing**
   - Additional AI processing creates summaries and other derivatives
   - Each AI call is tracked in `ai_processing_attempts`
   - Results are stored as new records in `expert_documents`

8. **Presentation Connection**
   - Processed content is linked to presentations via `presentation_assets`
   - Assets are given timing information for synchronized display
   - Different asset types (transcript, summary) are identified by `asset_type`

This workflow is configured through `audio_processing_configs` and `audio_processor_steps`, which define the processing pipeline and its parameters.