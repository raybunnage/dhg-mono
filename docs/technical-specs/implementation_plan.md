# DHG Application Implementation Specification

## Overview

This document outlines the implementation plan for the DHG application, providing detailed specifications for each page and its interactions with the Supabase database. The application serves as a comprehensive tool for managing audio content processing, AI analysis, and presentation creation based on expert content.

## Table of Contents

1. [Application Architecture](#application-architecture)
2. [Main Navigation Structure](#main-navigation-structure)
3. [Page Specifications](#page-specifications)
   - [Dashboard](#1-dashboard)
   - [Content Library](#2-content-library)
   - [Google Drive Sync](#3-google-drive-sync)
   - [Audio Processing Pipeline](#4-audio-processing-pipeline)
   - [AI Processing](#5-ai-processing)
   - [Expert Profiles](#6-expert-profiles)
   - [Presentations](#7-presentations)
   - [Analytics](#8-analytics)
   - [Settings](#9-settings)
4. [Implementation Priorities](#implementation-priorities)
5. [Database Integration](#database-integration)
6. [Security Considerations](#security-considerations)

## Application Architecture

The DHG application is built using:

- **Frontend**: React with Vite, using functional components and hooks
- **Styling**: Tailwind CSS for responsive design
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **File Storage**: Supabase Storage and Google Drive API
- **AI Integration**: OpenAI API for content processing

## Main Navigation Structure

```
Main Navbar
├── Dashboard
├── Content Library
├── Google Drive Sync
├── Audio Processing Pipeline
├── AI Processing
├── Expert Profiles
├── Presentations
├── Analytics
└── Settings
```

## Page Specifications

### 1. Dashboard

**Purpose:** Provide an overview of the system status and quick access to key functions.

**Key Components:**
- System status cards showing processing jobs, sync status, and overall health
- Recent activity feed displaying latest user actions and system events
- Quick action buttons for common tasks
- Performance metrics visualizations

**Supabase Tables:**
- `processing_batches` - For tracking ongoing processes
- `audio_processing_stages` - For pipeline status
- `ai_processing_attempts` - For AI processing status
- `sources_google` - For recent content

**UI Components:**
```jsx
<DashboardLayout>
  <StatusCardsGrid>
    <StatusCard title="Processing Jobs" value={activeJobs} icon={<ProcessingIcon />} />
    <StatusCard title="Sync Status" value={syncStatus} icon={<SyncIcon />} />
    <StatusCard title="Content Items" value={contentCount} icon={<ContentIcon />} />
    <StatusCard title="AI Credits" value={aiCredits} icon={<AIIcon />} />
  </StatusCardsGrid>
  
  <ActivityTimeline activities={recentActivities} />
  
  <MetricsSection>
    <ProcessingMetricsChart data={processingMetrics} />
    <ContentGrowthChart data={contentGrowth} />
  </MetricsSection>
  
  <QuickActionPanel>
    <ActionButton label="New Sync" onClick={handleNewSync} />
    <ActionButton label="Process Audio" onClick={handleProcessAudio} />
    <ActionButton label="Create Presentation" onClick={handleCreatePresentation} />
    <ActionButton label="View Reports" onClick={handleViewReports} />
  </QuickActionPanel>
</DashboardLayout>
```

**Implementation Details:**
- Real-time updates using Supabase subscriptions
- Configurable dashboard widgets
- Role-based visibility of metrics and actions
- Performance-optimized data loading with pagination

---

### 2. Content Library

**Purpose:** Browse, search, and manage all content synced from Google Drive and processed documents.

**Key Components:**
- Filterable/searchable content grid with advanced filtering options
- Content preview panel
- Batch operations for tagging and categorizing content
- Status indicators showing processing state

**Supabase Tables:**
- `sources_google` - Primary content source
- `expert_documents` - Processed documents
- `document_types` - For filtering by type
- `tags` and `tagged_items` - For tagging functionality
- `experts` - For filtering by expert

**UI Components:**
```jsx
<ContentLibraryLayout>
  <FilterPanel>
    <SearchInput placeholder="Search content..." onChange={handleSearch} />
    <FilterDropdown label="Type" options={documentTypes} onSelect={handleTypeFilter} />
    <FilterDropdown label="Expert" options={experts} onSelect={handleExpertFilter} />
    <FilterDropdown label="Tags" options={tags} onSelect={handleTagFilter} multiple />
    <DateRangePicker onChange={handleDateFilter} />
  </FilterPanel>
  
  <ContentGrid>
    {content.map(item => (
      <ContentCard 
        key={item.id}
        title={item.name}
        type={item.type}
        thumbnail={item.thumbnail}
        status={item.status}
        onClick={() => handleSelectContent(item)}
        selected={selectedContent?.id === item.id}
      />
    ))}
  </ContentGrid>
  
  <PreviewPane content={selectedContent}>
    {selectedContent?.type === 'audio' && <AudioPlayer url={selectedContent.url} />}
    {selectedContent?.type === 'document' && <DocumentPreview document={selectedContent} />}
    {selectedContent?.type === 'video' && <VideoPlayer url={selectedContent.url} />}
  </PreviewPane>
  
  <BatchOperationToolbar>
    <BatchButton icon="tag" label="Tag Selected" onClick={handleBatchTag} />
    <BatchButton icon="folder" label="Categorize" onClick={handleBatchCategorize} />
    <BatchButton icon="process" label="Process Selected" onClick={handleBatchProcess} />
    <BatchButton icon="delete" label="Delete Selected" onClick={handleBatchDelete} />
  </BatchOperationToolbar>
</ContentLibraryLayout>
```

**Implementation Details:**
- Infinite scroll for large content libraries
- Thumbnail generation for visual content
- Drag-and-drop functionality for organizing content
- Advanced filtering with combinable criteria
- Batch operations with progress indicators

---

### 3. Google Drive Sync

**Purpose:** Manage synchronization between Google Drive and the application.

**Key Components:**
- Sync status dashboard showing last sync time and results
- Folder selection interface for choosing which folders to sync
- Manual sync controls with options for different sync types
- Sync history log showing past synchronization jobs
- Error resolution interface for handling sync issues

**Supabase Tables:**
- `sources_google` - For Google Drive content
- `processing_batches` - For sync jobs
- `document_types` - For document classification
- `experts` - For associating content with experts

**UI Components:**
```jsx
<SyncPageLayout>
  <SyncStatusDashboard>
    <LastSyncCard timestamp={lastSync.timestamp} status={lastSync.status} />
    <SyncStatsCard newFiles={syncStats.new} updatedFiles={syncStats.updated} />
    <ConnectionStatusCard connected={googleDriveConnected} />
  </SyncStatusDashboard>
  
  <FolderSelectionPanel>
    <GoogleDriveFolderTree 
      folders={availableFolders}
      selectedFolders={syncConfig.folders}
      onFolderSelect={handleFolderSelect}
    />
    <SyncConfigOptions>
      <ConfigSwitch label="Include Subfolders" checked={syncConfig.includeSubfolders} />
      <ConfigSwitch label="Sync Deleted Files" checked={syncConfig.syncDeleted} />
      <ConfigSwitch label="Auto-Categorize" checked={syncConfig.autoCategorize} />
      <MimeTypeSelector 
        selected={syncConfig.mimeTypes} 
        onChange={handleMimeTypeChange} 
      />
    </SyncConfigOptions>
  </FolderSelectionPanel>
  
  <SyncActionPanel>
    <SyncButton 
      label="Full Sync" 
      onClick={() => handleSync('full')} 
      disabled={isSyncing}
    />
    <SyncButton 
      label="Metadata Only" 
      onClick={() => handleSync('metadata')} 
      disabled={isSyncing}
    />
    <SyncButton 
      label="Selected Folders" 
      onClick={() => handleSync('selected')} 
      disabled={isSyncing || !hasSelectedFolders}
    />
    {isSyncing && <SyncProgressIndicator progress={syncProgress} />}
  </SyncActionPanel>
  
  <SyncHistoryLog>
    <SyncHistoryTable history={syncHistory} onViewDetails={handleViewSyncDetails} />
  </SyncHistoryLog>
  
  <ErrorResolutionPanel errors={syncErrors}>
    {syncErrors.map(error => (
      <ErrorCard 
        key={error.id}
        error={error}
        onResolve={() => handleResolveError(error.id)}
        onIgnore={() => handleIgnoreError(error.id)}
      />
    ))}
  </ErrorResolutionPanel>
</SyncPageLayout>
```

**Implementation Details:**
- OAuth integration with Google Drive API
- Background sync processes with progress reporting
- Configurable sync rules and filters
- Intelligent file change detection
- Error categorization and guided resolution

---

### 4. Audio Processing Pipeline

**Purpose:** Manage and monitor audio content processing through various stages.

**Key Components:**
- Visual pipeline showing processing stages
- Job queue management interface
- Configuration panel for processing settings
- Error handling and reprocessing interface

**Supabase Tables:**
- `audio_processing_stages` - For tracking progress
- `audio_processor_steps` - For specific processing steps
- `audio_processing_configs` - For configuration
- `audio_segments` - For processed segments
- `speaker_profiles` - For speaker diarization
- `expert_documents` - Processed audio documents

**UI Components:**
```jsx
<AudioPipelineLayout>
  <PipelineVisualization>
    {processingStages.map(stage => (
      <StageNode 
        key={stage.id}
        name={stage.name}
        status={stage.status}
        completedItems={stage.completedCount}
        totalItems={stage.totalCount}
      />
    ))}
  </PipelineVisualization>
  
  <QueueManagementPanel>
    <QueuedItemsTable 
      items={queuedItems}
      onPrioritize={handlePrioritize}
      onRemove={handleRemoveFromQueue}
    />
    <BatchControlButtons>
      <BatchButton label="Pause All" onClick={handlePauseAll} />
      <BatchButton label="Resume All" onClick={handleResumeAll} />
      <BatchButton label="Clear Errors" onClick={handleClearErrors} />
    </BatchControlButtons>
  </QueueManagementPanel>
  
  <ConfigurationPanel>
    <ProcessorConfigForm 
      config={processingConfig}
      onChange={handleConfigChange}
      onSave={handleSaveConfig}
    />
    <PipelineStepsEditor 
      steps={pipelineSteps}
      onChange={handleStepsChange}
      onAddStep={handleAddStep}
      onRemoveStep={handleRemoveStep}
    />
  </ConfigurationPanel>
  
  <ErrorHandlingInterface>
    <ErrorList 
      errors={processingErrors}
      onRetry={handleRetryFailed}
      onSkip={handleSkipFailed}
    />
    <ErrorStatistics stats={errorStats} />
  </ErrorHandlingInterface>
</AudioPipelineLayout>
```

**Implementation Details:**
- WebSocket connections for real-time processing updates
- Modular pipeline steps that can be added/removed/reordered
- Automatic error recovery mechanisms
- Progress visualization with estimated completion times
- Comprehensive logging for debugging

---

### 5. AI Processing

**Purpose:** Apply and manage AI processing to content, including expert profiles and document classification.

**Key Components:**
- AI model selection interface
- Prompt template editor for customizing AI instructions
- Processing queue for batching content
- Results viewer with approve/reject functionality
- Cost and performance metrics

**Supabase Tables:**
- `ai_processing_attempts` - Processing history
- `expert_documents` - Documents to process
- `experts` - For expert profile generation
- `document_types` - For classification
- `function_registry` - For AI functions

**UI Components:**
```jsx
<AIProcessingLayout>
  <ModelSelectionPanel>
    <ModelCard 
      name="GPT-4"
      description="Most advanced model, best for complex tasks"
      costPerToken="$0.06 / 1K tokens"
      recommended={selectedTask === 'expert_profiles'}
      selected={selectedModel === 'gpt-4'}
      onClick={() => setSelectedModel('gpt-4')}
    />
    <ModelCard 
      name="GPT-3.5"
      description="Balanced performance, good for most tasks"
      costPerToken="$0.002 / 1K tokens"
      recommended={selectedTask === 'document_classification'}
      selected={selectedModel === 'gpt-3.5'}
      onClick={() => setSelectedModel('gpt-3.5')}
    />
    <ModelCard 
      name="Whisper"
      description="Audio transcription model"
      costPerToken="$0.006 / minute"
      recommended={selectedTask === 'transcription'}
      selected={selectedModel === 'whisper'}
      onClick={() => setSelectedModel('whisper')}
    />
  </ModelSelectionPanel>
  
  <PromptTemplateEditor
    template={selectedTemplate}
    onTemplateChange={handleTemplateChange}
    onSaveTemplate={handleSaveTemplate}
    variables={availableVariables}
    examples={templateExamples}
  />
  
  <ProcessingQueuePanel>
    <ContentSelector 
      availableContent={unprocessedContent}
      selectedContent={queuedContent}
      onSelect={handleAddToQueue}
      onRemove={handleRemoveFromQueue}
    />
    <QueuedItemsList items={queuedContent} />
    <ProcessingControls>
      <Button label="Process Queue" onClick={handleProcessQueue} />
      <PrioritySelector value={priority} onChange={setPriority} />
      <CostEstimate queue={queuedContent} model={selectedModel} />
    </ProcessingControls>
  </ProcessingQueuePanel>
  
  <ResultsViewer>
    {processedResults.map(result => (
      <ResultCard 
        key={result.id}
        original={result.original}
        processed={result.processed}
        status={result.status}
        onApprove={() => handleApproveResult(result.id)}
        onReject={() => handleRejectResult(result.id)}
        onEdit={() => handleEditResult(result.id)}
      />
    ))}
  </ResultsViewer>
  
  <MetricsPanel>
    <CostBreakdownChart data={costMetrics} />
    <PerformanceComparisonChart data={performanceMetrics} />
    <UsageStatisticsTable stats={usageStats} />
  </MetricsPanel>
</AIProcessingLayout>
```

**Implementation Details:**
- Integration with OpenAI API
- Templating system for reusable prompts
- Cost tracking and budget controls
- Result comparison and approval workflow
- AI model performance analytics

---

### 6. Expert Profiles

**Purpose:** Manage expert information, profiles, and associated content.

**Key Components:**
- Expert profile editor
- Content association interface
- Statistics dashboard
- Speaker profile management
- AI-enhanced bio generation

**Supabase Tables:**
- `experts` - Primary expert data
- `expert_documents` - Associated documents
- `speaker_profiles` - For audio associations
- `citation_expert_aliases` - For alternate names
- `domains` - For expertise domains
- `sources_google` - For original content

**UI Components:**
```jsx
<ExpertProfilesLayout>
  <ExpertsList 
    experts={experts}
    onSelectExpert={setSelectedExpert}
    onCreateNew={handleCreateExpert}
  />
  
  <ExpertProfileEditor expert={selectedExpert}>
    <ProfileImageUploader 
      currentImage={selectedExpert?.image_url}
      onUpload={handleImageUpload}
    />
    <ProfileForm 
      data={selectedExpert}
      onChange={handleProfileChange}
      onSave={handleSaveProfile}
    />
    <ExpertiseDomainsSelector 
      available={availableDomains}
      selected={selectedExpert?.domains}
      onChange={handleDomainsChange}
    />
    <AliasManager 
      aliases={expertAliases}
      onAdd={handleAddAlias}
      onRemove={handleRemoveAlias}
    />
  </ExpertProfileEditor>
  
  <ContentAssociationPanel>
    <AssociatedContentList 
      content={expertContent}
      onRemove={handleRemoveContent}
    />
    <ContentSearch 
      results={contentSearchResults}
      onSearch={handleContentSearch}
      onAssociate={handleAssociateContent}
    />
  </ContentAssociationPanel>
  
  <SpeakerProfilesPanel>
    <SpeakerProfilesList 
      profiles={speakerProfiles}
      onSelect={handleSelectSpeakerProfile}
    />
    <AudioSamplePlayer 
      samples={selectedSpeakerProfile?.samples}
      onPlay={handlePlaySample}
    />
    <SpeakerSettings 
      settings={speakerSettings}
      onChange={handleSpeakerSettingsChange}
    />
  </SpeakerProfilesPanel>
  
  <StatisticsDashboard>
    <ContentTypeChart data={contentTypeStats} />
    <ContentTimelineChart data={contentTimeline} />
    <TopicsWordCloud topics={expertTopics} />
  </StatisticsDashboard>
  
  <AIBioGenerator>
    <TemplateSelector 
      templates={bioTemplates}
      selected={selectedBioTemplate}
      onChange={setSelectedBioTemplate}
    />
    <GeneratedBioPreview bio={generatedBio} />
    <GeneratorControls>
      <Button label="Generate Bio" onClick={handleGenerateBio} />
      <Button label="Apply to Profile" onClick={handleApplyBio} />
    </GeneratorControls>
  </AIBioGenerator>
</ExpertProfilesLayout>
```

**Implementation Details:**
- Comprehensive expert profile management
- AI-assisted profile generation and enhancement
- Speech analysis for speaker profile creation
- Expertise domain visualization
- Content association with intelligent matching

---

### 7. Presentations

**Purpose:** Create, manage, and deliver presentations based on processed content.

**Key Components:**
- Presentation builder interface
- Asset library for adding content elements
- Arrangement tools for organizing content
- Preview mode for testing presentations
- Sharing and export controls

**Supabase Tables:**
- `presentations` - Presentation metadata
- `presentation_assets` - Content elements
- `presentation_collections` - Grouping presentations
- `presentation_tags` and `presentation_tag_links` - For categorization
- `presentation_themes` - For visual styling
- `user_annotations` - For notes on content

**UI Components:**
```jsx
<PresentationsLayout>
  <PresentationsList 
    presentations={presentations}
    onSelect={setSelectedPresentation}
    onCreateNew={handleCreatePresentation}
  />
  
  <PresentationBuilder presentation={selectedPresentation}>
    <PresentationMetadataEditor 
      metadata={presentationMetadata}
      onChange={handleMetadataChange}
    />
    <Timeline 
      assets={presentationAssets}
      onReorder={handleReorderAssets}
      onSelect={setSelectedAsset}
      onDurationChange={handleAssetDurationChange}
    />
    <AssetEditor 
      asset={selectedAsset}
      onChange={handleAssetChange}
      onRemove={handleRemoveAsset}
    />
  </PresentationBuilder>
  
  <AssetLibrary>
    <AssetSearch onSearch={handleAssetSearch} />
    <AssetTypeFilter 
      options={assetTypes}
      selected={selectedAssetTypes}
      onChange={setSelectedAssetTypes}
    />
    <AssetGrid 
      assets={availableAssets}
      onSelect={handleAddAsset}
    />
  </AssetLibrary>
  
  <ArrangementTools>
    <LayoutTemplateSelector 
      templates={layoutTemplates}
      onApply={handleApplyTemplate}
    />
    <TransitionSelector 
      transitions={availableTransitions}
      onApply={handleApplyTransition}
    />
    <SectionDivider 
      onAddDivider={handleAddDivider}
    />
  </ArrangementTools>
  
  <PreviewMode 
    presentation={selectedPresentation}
    playing={isPlaying}
    currentTime={currentTime}
    onPlay={handlePlay}
    onPause={handlePause}
    onSeek={handleSeek}
  />
  
  <SharingControls>
    <VisibilitySelector 
      visibility={presentationVisibility}
      onChange={setVisibility}
    />
    <CollaboratorsSelector 
      collaborators={presentationCollaborators}
      onAdd={handleAddCollaborator}
      onRemove={handleRemoveCollaborator}
    />
    <ExportOptions 
      formats={exportFormats}
      onExport={handleExport}
    />
    <SharingLinks 
      links={sharingLinks}
      onGenerate={handleGenerateLink}
      onCopy={handleCopyLink}
    />
  </SharingControls>
</PresentationsLayout>
```

**Implementation Details:**
- Drag-and-drop interface for presentation building
- Timeline-based content arrangement
- Real-time collaboration features
- Multiple export formats (PDF, video, interactive)
- Advanced sharing controls with granular permissions

---

### 8. Analytics

**Purpose:** View metrics and analytics on content, processing, and usage.

**Key Components:**
- Usage statistics and trends
- Processing performance metrics
- Content popularity and engagement
- AI performance and cost analysis
- User activity tracking

**Supabase Tables:**
- All tables with audit fields (for timing analysis)
- `ai_processing_attempts` (for AI metrics)
- `audio_processing_stages` (for processing metrics)
- `presentation_assets` (for content usage)

**UI Components:**
```jsx
<AnalyticsLayout>
  <DateRangeSelector 
    range={dateRange}
    onChange={setDateRange}
    presets={datePresets}
  />
  
  <UsageDashboard>
    <UsageMetricsCards>
      <MetricCard 
        title="Content Processed" 
        value={metrics.contentProcessed} 
        change={metrics.contentProcessedChange}
      />
      <MetricCard 
        title="AI Operations" 
        value={metrics.aiOperations} 
        change={metrics.aiOperationsChange}
      />
      <MetricCard 
        title="Presentations Created" 
        value={metrics.presentationsCreated} 
        change={metrics.presentationsCreatedChange}
      />
      <MetricCard 
        title="Active Users" 
        value={metrics.activeUsers} 
        change={metrics.activeUsersChange}
      />
    </UsageMetricsCards>
    
    <UsageTrendsChart data={usageTrends} />
  </UsageDashboard>
  
  <ProcessingPerformance>
    <ProcessingTimeChart data={processingTimeData} />
    <ErrorRateChart data={errorRateData} />
    <ProcessingVolumeByType data={volumeByTypeData} />
  </ProcessingPerformance>
  
  <ContentAnalytics>
    <PopularContentTable content={popularContent} />
    <ContentGrowthChart data={contentGrowthData} />
    <ContentTypeDistribution data={contentTypeData} />
  </ContentAnalytics>
  
  <AIPerformance>
    <AIModelComparisonChart data={modelComparisonData} />
    <CostBreakdownChart data={costBreakdownData} />
    <TokenUsageChart data={tokenUsageData} />
  </AIPerformance>
  
  <ExportControls>
    <FormatSelector 
      formats={exportFormats}
      selected={selectedFormat}
      onChange={setSelectedFormat}
    />
    <Button label="Export Report" onClick={handleExportReport} />
    <ScheduleReportButton onClick={handleScheduleReport} />
  </ExportControls>
</AnalyticsLayout>
```

**Implementation Details:**
- Interactive data visualizations
- Custom date range selection
- Comparative analysis (current vs. previous periods)
- Downloadable reports in multiple formats
- Automated reporting via email or notification

---

### 9. Settings

**Purpose:** Configure system settings and user preferences.

**Key Components:**
- User profile management
- API keys and integrations configuration
- Default processing settings
- UI preferences
- Access control management

**Supabase Tables:**
- `audio_processing_configs` (for defaults)
- `profiles` (user settings)
- `function_registry` (available functions)

**UI Components:**
```jsx
<SettingsLayout>
  <SettingsTabs
    tabs={[
      { id: 'profile', label: 'Profile' },
      { id: 'integrations', label: 'Integrations' },
      { id: 'processing', label: 'Processing' },
      { id: 'appearance', label: 'Appearance' },
      { id: 'access', label: 'Access Control' }
    ]}
    activeTab={activeTab}
    onTabChange={setActiveTab}
  />
  
  {activeTab === 'profile' && (
    <ProfileSettings>
      <UserProfileForm 
        user={currentUser}
        onUpdate={handleUpdateProfile}
      />
      <PasswordChangeForm onChangePassword={handlePasswordChange} />
      <NotificationPreferences 
        preferences={notificationPrefs}
        onChange={handleNotificationPrefsChange}
      />
    </ProfileSettings>
  )}
  
  {activeTab === 'integrations' && (
    <IntegrationsSettings>
      <APIKeyManager 
        keys={apiKeys}
        onGenerate={handleGenerateKey}
        onRevoke={handleRevokeKey}
      />
      <IntegrationConnector 
        integrations={availableIntegrations}
        connected={connectedIntegrations}
        onConnect={handleConnectIntegration}
        onDisconnect={handleDisconnectIntegration}
      />
      <WebhookConfigurator 
        webhooks={configuredWebhooks}
        onAdd={handleAddWebhook}
        onEdit={handleEditWebhook}
        onRemove={handleRemoveWebhook}
      />
    </IntegrationsSettings>
  )}
  
  {activeTab === 'processing' && (
    <ProcessingSettings>
      <DefaultModelSelector 
        models={availableModels}
        selected={defaultModel}
        onChange={setDefaultModel}
      />
      <ProcessingQueueSettings 
        settings={queueSettings}
        onChange={handleQueueSettingsChange}
      />
      <StorageRetentionSettings 
        settings={retentionSettings}
        onChange={handleRetentionSettingsChange}
      />
    </ProcessingSettings>
  )}
  
  {activeTab === 'appearance' && (
    <AppearanceSettings>
      <ThemeSelector 
        themes={availableThemes}
        selected={selectedTheme}
        onChange={setSelectedTheme}
      />
      <LayoutPreferences 
        preferences={layoutPrefs}
        onChange={handleLayoutPrefsChange}
      />
      <DashboardCustomizer 
        widgets={availableWidgets}
        layout={dashboardLayout}
        onChange={handleDashboardLayoutChange}
      />
    </AppearanceSettings>
  )}
  
  {activeTab === 'access' && (
    <AccessControlSettings>
      <UserManagement 
        users={systemUsers}
        onInvite={handleInviteUser}
        onRemove={handleRemoveUser}
      />
      <RoleManager 
        roles={systemRoles}
        onAdd={handleAddRole}
        onEdit={handleEditRole}
        onRemove={handleRemoveRole}
      />
      <PermissionMatrix 
        permissions={permissionMatrix}
        onChange={handlePermissionChange}
      />
    </AccessControlSettings>
  )}
</SettingsLayout>
```

**Implementation Details:**
- User-specific settings saved to profiles
- System-wide configuration management
- Role-based access control
- Integration management with OAuth support
- Theme customization and layout preferences

---

## Implementation Priorities

### Phase 1: Core Infrastructure
1. **Google Drive Sync** - Essential for getting content into the system
2. **Audio Processing Pipeline** - Core functionality for processing content
3. **Content Library** - Basic browsing and organization

### Phase 2: Content Enhancement
4. **AI Processing** - Add intelligence to the content
5. **Expert Profiles** - Organize content by expert

### Phase 3: Content Delivery
6. **Presentations** - Create deliverable content
7. **Analytics** - Understand usage patterns

### Phase 4: Optimization
8. **Dashboard** - Improve user experience with overview
9. **Settings** - Fine-tune the system

## Database Integration

For each page, proper database integration should follow these guidelines:

1. **Audit Fields Usage**
   - All tables include standardized `created_at`, `updated_at`, `created_by`, and `updated_by` fields
   - Frontend ensures authentication context is available for all database operations

2. **Error Handling**
   - Implement consistent error handling and retry logic
   - Log errors to both console and database for traceability

3. **Real-time Updates**
   - Use Supabase subscriptions for real-time UI updates
   - Implement optimistic UI updates for better user experience

4. **Transaction Safety**
   - Use transactions for operations that modify multiple tables
   - Implement proper error recovery for failed transactions

## Security Considerations

1. **Authentication**
   - All routes should enforce authentication
   - Implement proper session handling and token refresh

2. **Authorization**
   - Apply row-level security policies consistently
   - Use role-based access control for feature access

3. **Data Protection**
   - Sanitize user inputs to prevent injection attacks
   - Implement rate limiting for API endpoints

4. **External Services**
   - Securely store and manage API keys for external services
   - Implement proper OAuth flow for Google Drive integration

5. **Content Security**
   - Apply proper access controls to user-generated content
   - Validate file uploads for security threats