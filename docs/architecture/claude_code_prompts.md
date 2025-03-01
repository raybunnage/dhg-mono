# DHG Application Design Specification

## Overview
This document outlines the design specifications for three main dashboard pages in the DHG application: Sync, Classify, and Transcribe. Each dashboard serves a specific purpose in the content processing pipeline.

## 1. Sync Dashboard
The foundation of our content processing pipeline, handling Google Drive synchronization.

### Core Requirements
1. **Multiple Folder Support**
   - Support for 5+ Google folders initially, scaling to 20+
   - Folders identified by unique ID and human-readable name
   - Dashboard layout similar to classify page

### Key Functions
1. **New Folder Processing**
   - Recursive identification of subfolders and files
   - Creation of matching sync records
   - Integration with sources_google table
   - Google metadata recording
   - Statistics tracking across multiple tables

2. **Existing Folder Management**
   - Sync record maintenance
   - New file identification
   - Soft delete for unavailable files

3. **Sync History**
   - Display of sync history
   - Status updates post-sync
   - Progress tracking

4. **Token Management**
   - Google token status display
   - One-hour token lifecycle tracking
   - Token expiration timer
   - Optional token refresh functionality
   - Pre-sync token validation

5. **Batch Processing Integration**
   - Support for syncing operations
   - File copying management
   - Audio processing preparation
   - Transcription readiness

### File Processing Workflows
1. **Content Extraction**
   - DOCX processing via Mammoth
   - Direct TXT file reading
   - Mime-type specific strategies

2. **File Management**
   - New file detection
   - sources_google record creation
   - AI classification integration

3. **Audio Processing**
   - M4A file local copying
   - MP4 audio extraction
   - Temporary storage management
   - Optional Google Drive M4A storage

4. **Batch Processing**
   - Processing table utilization
   - Enum support
   - UI integration

## 2. Classify Dashboard

### Core Functions
1. **File Classification**
   - AI classification for unclassified files
   - Initial support: DOCX and TXT files
   - Future expansion to PDF support

2. **Content Processing**
   - Presentation document content extraction
   - expert_documents record creation
   - AI-based expert JSON extraction
   - processed_documents field management

### Document Type Management
1. **Dynamic Type System**
   - New document type addition support
   - Immediate UI updates
   - Category-based pill filtering
   - JSON-based document type support

### Status Tracking
1. **Processing Status**
   - sources_google processing status
   - expert_documents AI processing status
   - Document type association tracking

## 3. Transcribe Dashboard

### Purpose
Clean transcription generation from MP4 files with comprehensive audio processing.

### Core Components
1. **Audio Processing**
   - MP4 audio extraction
   - Timestamp identification
   - Speaker identification
   - Speaker file creation
   - Content merging and processing

### Technical Implementation
1. **Processing Architecture**
   - Dedicated Python processing folder
   - Handoff functionality
   - Integration with existing dashboards

### Design Principles
1. **Consistency**
   - Follow Sync and Classify dashboard patterns
   - Maintain existing functionality
   - Support transcription pipeline steps

### Future Considerations
1. **Presentation Layer**
   - Multiple element integration
   - Layout planning
   - Content organization

## Implementation Guidelines
1. **Progressive Development**
   - Preserve existing functionality
   - Intuitive layout design
   - Logical process flow
   - Batch processing integration

2. **UI/UX Considerations**
   - Clear process visualization
   - Status tracking
   - Progress indicators
   - User-friendly controls

3. **Technical Requirements**
   - Python processing integration
   - Google Drive API integration
   - Batch processing support
   - Error handling
   - Token management

## Notes
- All changes should preserve existing functionality
- Dashboard layouts should follow logical processing order
- Batch processing integration is critical across all components
- Future expansion should be considered in initial design





## original code
I need you to add a new experts page soon.  But before you do that I need you to sysematically go through my code and find references to previous work on experts - I think can just search for any thing that has the word expert in it.  I believe there are a lot of orphaned functions and ui dealing with example calls and previous attempts at managing experts. I will be wanting to archive and get rid of those.

To help me do so  Generate a thorough report in markdown syntax that I can put into my docs folder that will assess all the experts code and make suggestikons about wht is needed and what can be removed - and even provide commands to do so I can paste into my terminal


Now that I've cleaned up the experts code I need you to add a new experts page.  It will be a dashboard that will allow me to manage experts similar to all the other dashboards you created for me. I have an existing experts table and I have an existing experts_documents table.  I need to be able to add new experts, edit their information, and delete them.  I will also need to be able to see a list of all experts and select one to view their details.  I will also need to be able to add new expert documents and edit their information, and delete them.  I will also need to be able to see a list of all expert documents and select one to view their details.

The thing about experts is the the information for them comes from many documents. Our goal is to build up and keep current important information about them and even update it periodically. We already have an "experts" table but we need to make it more robust.  Please add the fields you think are neceessary to do this.

Some of our information comes from the presentation announcement docx files which we have in our sources_google table.  We are processing with ai and extracting out the unstructured information that comes from presentation documents that are cvs and bios.  Some of it comes from their research papers. Some of it could come from the web sites that are extracted from some of these documents such as their lab page. Yes, we could even get their linked in profiles.  Basically the experts who create our content videos are the heart of our operation and keeping up to date information about them is crucial.  We also will be building an associated set of tables and ai processing around their research papers and content but that will be a later step.

  We have to take all these sources and extract out the unstructureed (but mostly similar and consistent information ) and put it into the experts table.  We also need to be able to add new experts and edit their information, and delete them.  I will also need to be able to see a list of all experts and select one to view their details.  I will also need to be able to add new expert documents and edit their information, and delete those files. 

  here are the fields in the current experts table

   experts: {
        Row: {
          bio: string | null
          created_at: string
          email_address: string | null
          experience_years: number | null
          expert_name: string
          expertise_area: string | null
          full_name: string | null
          google_email: string | null
          google_profile_data: Json | null
          google_user_id: string | null
          id: string
          is_in_core_group: boolean
          last_synced_at: string | null
          legacy_expert_id: number | null
          starting_ref_id: number | null
          sync_error: string | null
          sync_status: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          bio?: string | null
          created_at?: string
          email_address?: string | null
          experience_years?: number | null
          expert_name: string
          expertise_area?: string | null
          full_name?: string | null
          google_email?: string | null
          google_profile_data?: Json | null
          google_user_id?: string | null
          id?: string
          is_in_core_group?: boolean
          last_synced_at?: string | null
          legacy_expert_id?: number | null
          starting_ref_id?: number | null
          sync_error?: string | null
          sync_status?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          bio?: string | null
          created_at?: string
          email_address?: string | null
          experience_years?: number | null
          expert_name?: string
          expertise_area?: string | null
          full_name?: string | null
          google_email?: string | null
          google_profile_data?: Json | null
          google_user_id?: string | null
          id?: string
          is_in_core_group?: boolean
          last_synced_at?: string | null
          legacy_expert_id?: number | null
          starting_ref_id?: number | null
          sync_error?: string | null
          sync_status?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }




I need you to improve the supabase page.  It is all about the supabase design and how we can improve it to make it more efficient and easier to use.  It needs to be more intuitive and follow the steps required to get the job done.  

Just as you did for now three other pages - classify, sync and transcribe - I need you to do the same for the supabase page.  I want to see all the tables and sql objects that a person managing a sophisticated postgres database needs to know - what we currently have, what is missing or inconsistent, what needs to be added and what needs to be removed. 

I want to see a summary of the tables and their current status and then be able to generate objects such as tables, views, enums, etc. that will make the database more efficient and easier to use.

I need to be able a section that will allow me to manage migrations better - but it doesn't have to follow the traditional up and down path.  It seems I like to have you first generate the commands based on mp prompts and then paste them in the supabase ai and to use the SQL editor to run them.  Usually a mistake in the sql crops up and I paste it into you to troubleshoot and run it until it is successful. It's hard to keep track of that using the traditional up and down migrations, plus the final version of the code that actually worked is usually not in the final migration sql.

Also, I like to generate new versions of the schema and all database objects to paste into the coding ai to help it write better code.  Then in the terminal I regularly export all the types and hand off the current types.ts file to the ai to help it write better code.  My local command always generates the types.ts file in supabase/types.ts.   

Try to keep existing functionality as much as possible and not break anything, but make it more intuitive and easier to use. This will be a very sophisticated supabase database that drives a sophisticated file processing system.





the processing for this will be in python we will have a dedicated folder for the pyton processing to handoff the fujnctionalithy to.  

However this transcribe page will follow in the footstetps of the 2 other dashboards you just did for classify and sync and help us move along the various steps required for the transcription pipeline.  Try not to break existing functionality on this transcribe page.




I need you to improve the entire sync page layout of buttons and functionality - it is too fragmented. It all starts here. 

Let's review - we will have multiple google folders we will be syncing with - 5 I can think of so far and maybe another 15 coming down the pipe. So we will need a way to identify which highe level folder we will be syncing - I know each high level folder has a unique id and that's good but we're going to need to refer to it by name.

I think we need a dashboard similar to the classify page that you just made a dashboard for.  That is an awesome dashboard but here is where it all starts 

1) new folder - recurivesly identify all its subfolders and files and create matching sync files to keep them in sync in the future.  The syncing function heavily uses sources_google but also a cluster of other tables which are used to keep statistics.  we also need the google metadata to be recorded.

2) existing folder - once the sync records are created we have to keep them in sync - identify any new ones, mark the ones no longer available with a soft delet

3) and then we need the summaries - we need to show the sync history - to be able to see where we stand from previous syncs and after syncing again we need to ujpdate that status - you have code and tables for that already

4) sonmething that will tell us about our token status, currently we get one hour based google tokens to do our dev work, the timer shoujld show us when that will expire and evne provide an optional way to refresh our token - because if we try to sync and haven't got the token we'll just fail - in fact we should not proceeed with any sync function that redquires access to the google drvie unless we have an unexpired token

5) batching of all this syncing and copyikng and audio processing and audio extraction and eventually transcrioption - will all be part of this and should be considered from the get go

6) all of this should be thought through carefully and presented in a logical order in the dashboard because I will be coming to it regularly to check on syncikng and to process any new material -

Given that synching with multiple folders is the foundation of our efforts this sync dashboard is really important.  All of these materials processed and generated will be later presented in a special presentation layer which we will design once we have all the elements

5) Just a refresher on what we do with syncing
a) it allows us to access the content of files, for docx files we use mammoth and for txt files I think you read them direclty.   
b) however we have various strategies once we get the content extracted and it varies by mime-type
c) once we have fouind new files that aren't in sources_google we have to make new records for them
d) we then need to apply our ai classification prompt that figures out which document type they are and updates the sources_google record with that informatoin.  Once it is done we don't need to redo it, and to start with it is jusrt for docx files and txt files, but eventually we will do it for pdfs
e) for m4a files that already exist on the google drive - we need to copy them locally on our dev machine from the google drive - then we will process them to get ai summaries of the videos they hold the audio for - this is the audio processing we'll be doing in our python code 
f) for mp4 files that don't have an associated m4a file we'll need to copy them temporarily (just a few at a time) and temporarily store them locally.  Then we will extract the m4a file from them so we can make the ai assisstend summaries from the videos.  I don't know whether it makes sense to copy these m4a files to the google drive after we created them locally as it would save having to do the ffmpeg extraction from the mp4 file in the future once it is done.  Also, long term storage of mp4 files in particular - but even m4a files might not be advisable - wherease we can always just read them from teh google drive  
g) all of this will use batching for the processing - and there are processing tables you have ready to use for this, and we have created all the enums and the ui will need to support this
h) just to know that after we get all the m4a files procedssed, and the ai summaries created we will return to the mp4s and create full blown transcrioptions which will require high quality audio and diaraization and intensive gpu and cpu processing if possible (and of course done proably in python).  Also there are speaker files which will be needed to sync the speakers to the transcripot so we can then process them with sophisticated ai to extract out content to go along with the video presentations - by the sync dashboard I don't think should do this last transcerioptoin processing - that will be a separte page in the app deciated to creating those cleaned and ai processed transcriptions. So you deon't need to do anything on that on the sync page for now


Let me know what else you need to know to imropve the layout and design to make it more intutive and follow the steps required.  When you redo things, try veryh hard to not break functionality if you can.







there are certain functions I need in cclassifying - here they are.  1) from the newly synced files - apply the ai to them that classifies them if they aren't calssified - right now it is just for docx files and txt files - but more will be later.   THen for any that are prsentation documents I need to run sojmething that will extract the content out - I think it is mammoth in the case of docx files and perhaps just reading the txt file from the google drive for text files, but in both cases I need to put the content into  expert_documents records and then run the ai that is specific for extracting expert json info from presentation announement documents only - and write them out to the processed_documents field if they are not alrady there, and skip if they are.

Also I need to be able to add new  document types as needed and have them show up as soon as I add them.  I like seeing all the document types at the bottom , but they could use pills based on their cateogry field so I could filter to just those that I wanted to see at a given tome.  

Some of these new document types will be json based to extract the less sturctured json into the processed_contents field and I will be needing additional document types such as these as new prompts are  created that are specific to certain document types.

I need a status of processed versus unprocssed documents from the sources_google table, but then I also need a status on the ai procssed fields that have expert_documents that have been ai processed and their new document type associated.  I guess I need this classify page to be a dashboard that helps me manage all my document classification needs - and I keep discovering them

I need a better way to organize this functionality as I will always be classifying files once I get them synced from the google drive and then subsets will be further processed by ai according to their document type

Let me know what else you need to know to imropve the layout and design to make it more intutive and follow the steps required - you have the screen shot of all the buttons I've created so far, but it is quite messy now.  When you redo things, try veryh hard to not break functionality if you can.