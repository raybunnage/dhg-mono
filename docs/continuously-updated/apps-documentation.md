# DHG Monorepo Applications Documentation

> This document is continuously updated to reflect the latest state of all applications in the DHG monorepo.  
> Last updated: 2025-01-06

## Table of Contents

1. [Overview](#overview)
2. [Applications Summary](#applications-summary)
3. [DHG-Hub](#dhg-hub)
4. [DHG-Audio](#dhg-audio)
5. [DHG-Improve-Experts](#dhg-improve-experts)
6. [DHG-Admin-Suite](#dhg-admin-suite)
7. [DHG-Admin-Code](#dhg-admin-code)
8. [DHG-Admin-Google](#dhg-admin-google)
9. [DHG-Hub-Lovable](#dhg-hub-lovable)
10. [DHG-A](#dhg-a)
11. [DHG-B](#dhg-b)
12. [Technical Standards](#technical-standards)
13. [Deployment](#deployment)

## Overview

The DHG monorepo contains multiple React-based applications that serve different purposes within the Dynamic Healing ecosystem. All applications follow a consistent architecture using:

- **React** with TypeScript
- **Vite** as the build tool
- **Tailwind CSS** for styling
- **Supabase** for backend services
- **Shared components and services** from `packages/shared`

## Applications Summary

| Application | Purpose | Status | Key Features |
|-------------|---------|--------|--------------|
| dhg-hub | Main presentation viewer | Active | Video viewing, filtering, presentation management |
| dhg-audio | Audio learning platform | In Development | Audio playback, progress tracking, learning paths |
| dhg-improve-experts | Expert management system | Active | Expert profiles, document processing, AI integration |
| dhg-admin-suite | Administrative dashboard | Active | User management, system monitoring |
| dhg-admin-code | Code management tools | Active | Script management, code analysis |
| dhg-admin-google | Google Drive administration | Active | Drive sync, file management |
| dhg-hub-lovable | Enhanced hub version | Beta | Improved UI, additional features |
| dhg-a | Testing application | Development | Component testing |
| dhg-b | Testing application | Development | Feature prototyping |

## DHG-Hub

### Purpose
DHG-Hub is the primary application for viewing and interacting with presentation videos and their associated content. It serves as the central access point for the Dynamic Healing community.

### Key Features
- **Video Playback**: Stream presentations directly from Google Drive
- **Filter Profiles**: Customizable content filtering based on user preferences
- **Presentation Browser**: Search and browse presentations by topic, expert, or date
- **Asset Management**: View associated documents, slides, and resources
- **AI-Processed Content**: Display Claude-processed summaries and analysis

### Database Integration
- `presentations`: Core presentation metadata
- `sources_google`: Google Drive file information
- `experts`: Presenter information
- `user_filter_profiles`: User filtering preferences
- `subject_classifications`: Topic categorization

### Technical Stack
- React 18 with TypeScript
- React Router for navigation
- Custom hooks for data fetching
- Responsive design with Tailwind CSS

### Recent Updates
- Enhanced filter profile management
- Improved video player integration
- Added presentation asset viewer
- Optimized search functionality

## DHG-Audio

### Purpose
Audio learning application designed to transform presentation content into an accessible, mobile-friendly audio learning platform. Currently in active development.

### Key Features (Planned/In Development)
- **Audio Player**: Custom audio playback with speed control
- **Progress Tracking**: Save and sync listening position
- **Learning Pathways**: Curated content sequences
- **Offline Capabilities**: Download for offline listening
- **Note Taking**: Text and audio notes at timestamps
- **Quiz Integration**: Knowledge checks and assessments

### Database Integration
- `audio_content`: Audio file metadata
- `listening_progress`: User progress tracking
- `user_notes`: Note storage
- `quiz_questions`: Assessment content
- `learning_pathways`: Curated learning paths

### Technical Implementation
- Progressive Web App (PWA) architecture
- Service workers for offline functionality
- IndexedDB for local storage
- Custom audio hooks for playback control

### Development Status
- Core audio player: Complete
- Progress tracking: In development
- Learning pathways: Planned
- Offline mode: Planned

## DHG-Improve-Experts

### Purpose
Comprehensive expert management system for processing, classifying, and managing expert-related content and documents.

### Key Features
- **Expert Profiles**: Detailed expert information management
- **Document Processing**: AI-powered document classification
- **Content Analysis**: Claude integration for content processing
- **Batch Operations**: Bulk processing capabilities
- **Reporting**: Analytics and insights on expert content

### Database Integration
- `experts`: Expert profile data
- `expert_documents`: Processed expert content
- `document_types`: Document classification
- `sources_google_experts`: Expert-source relationships
- `processing_batches`: Batch operation tracking

### Key Components
- Expert listing and search
- Document classification pipeline
- AI content processing
- Batch processing interface
- Analytics dashboard

### Recent Updates
- Enhanced AI classification accuracy
- Improved batch processing performance
- Added new document type categories
- Optimized expert search functionality

## DHG-Admin-Suite

### Purpose
Administrative dashboard providing system monitoring, user management, and configuration tools for the entire DHG ecosystem.

### Key Features
- **User Management**: User profiles, permissions, roles
- **System Monitoring**: Health checks, performance metrics
- **Configuration**: System settings and preferences
- **Audit Logs**: Activity tracking and compliance
- **Report Generation**: System-wide analytics

### Database Integration
- `auth_user_profiles`: User profile management
- `auth_audit_log`: System activity tracking
- `sys_table_definitions`: Database schema monitoring
- `command_tracking`: CLI usage analytics

### Technical Implementation
- Role-based access control (RBAC)
- Real-time monitoring dashboards
- Automated report generation
- Email notification system

## DHG-Admin-Code

### Purpose
Code management and analysis tools for maintaining script quality and documentation across the monorepo.

### Key Features
- **Script Analysis**: AI-powered code analysis
- **Documentation Generation**: Automated documentation
- **Code Quality**: Linting and formatting tools
- **Version Control**: Git integration and history

### Database Integration
- `scripts_registry`: Script metadata and tracking
- `ai_prompts`: Code analysis prompts
- `command_definitions`: CLI command registry

## DHG-Admin-Google

### Purpose
Google Drive administration interface for managing file synchronization and permissions.

### Key Features
- **Drive Synchronization**: Automated file sync
- `sources_google`: File metadata management
- **Permission Management**: Access control
- **Sync Monitoring**: Real-time sync status

### Database Integration
- `google_sources`: Drive file metadata
- `google_sync_history`: Sync operation logs
- `google_sync_statistics`: Performance metrics

## DHG-Hub-Lovable

### Purpose
Enhanced version of DHG-Hub with improved UI/UX and additional features, currently in beta testing.

### Key Features
- All DHG-Hub features plus:
- Enhanced UI with modern design
- Improved performance optimizations
- Additional filtering options
- Advanced search capabilities

### Status
Beta testing with select users

## DHG-A

### Purpose
Testing and development sandbox for new components and features.

### Current Use
- Component library testing
- UI/UX experimentation
- Performance benchmarking

## DHG-B

### Purpose
Secondary testing environment for feature prototyping.

### Current Use
- Feature proof-of-concepts
- Integration testing
- A/B testing experiments

## Technical Standards

### Shared Architecture
All applications follow these standards:

1. **Project Structure**:
   ```
   /app-name
     /src
       /components
       /hooks
       /services
       /utils
       App.tsx
       main.tsx
     index.html
     package.json
     vite.config.ts
   ```

2. **Shared Services**:
   - Use `packages/shared/services` for common functionality
   - Implement singleton pattern for service instances
   - Use dependency injection for testing

3. **Environment Configuration**:
   - Browser apps use `VITE_` prefixed variables
   - Store in `.env.development` and `.env.production`
   - Never commit secrets to repository

4. **TypeScript Standards**:
   - Strict mode enabled
   - Explicit typing for all functions
   - Use types from `supabase/types.ts`

5. **Component Guidelines**:
   - Functional components with hooks
   - Props interfaces for all components
   - Proper error boundaries

### Testing Standards
- Unit tests for utilities and services
- Integration tests for API interactions
- E2E tests for critical user flows

## Deployment

### Build Process
All applications use Vite for building:
```bash
pnpm build --filter=app-name
```

### Deployment Targets
- **Production**: Netlify deployment
- **Staging**: Netlify preview deployments
- **Development**: Local development server

### Environment Management
- Separate `.env` files per environment
- Environment-specific build configurations
- Automated deployment via CI/CD

### Monitoring
- Error tracking with console logs
- Performance monitoring
- User analytics (privacy-compliant)

---

## Update Log

### 2025-01-06
- Initial consolidated documentation created
- Gathered information from multiple documentation sources
- Standardized format across all applications

---

*This document is automatically updated. For manual updates, use the documentation CLI pipeline.*

**Last Updated**: June 8, 2025  
**Area**: Applications  
**Review Frequency**: Every 14-30 days  
**Status**: Active

> ⚠️ **Important Notes**: This is a living document that is continuously monitored and updated. 
> If you notice outdated information or have updates to add, please use the docs CLI pipeline 
> to update this document and reset the review timer.

## 📋 Table of Contents

- [🎯 Latest Lessons Learned & Current Status](#latest-lessons-learned-current-status)\n- [📰 What's Been Happening Lately](#what-s-been-happening-lately)\n- [🚀 Next Phase to Tackle](#next-phase-to-tackle)\n- [📅 Implementation Phases](#implementation-phases)\n- [⚖️ Priorities & Trade-offs](#priorities-trade-offs)\n- [🎨 Original Vision](#original-vision)\n- [📚 Detailed Documentation](#detailed-documentation)

---

## 🎯 Latest Lessons Learned & Current Status

**Last Review**: June 8, 2025

### Key Insights
- *[Add recent lessons learned and insights]*
- *[What worked well in recent implementations]*
- *[What challenges were encountered and how they were resolved]*

### Recent Accomplishments
- *[List recent achievements and completed milestones]*
- *[Successful implementations or improvements]*

### Current State
- *[Brief overview of current implementation status]*
- *[What's working well and what needs attention]*
- *[Any blockers or dependencies]*

---

## 📰 What's Been Happening Lately

*[Paragraph describing what's been happening lately with this area of the project. Include recent changes, implementations, discoveries, or shifts in approach. This should be updated each time the document is reviewed.]*

Recent highlights:
- *[Key recent developments]*
- *[Important changes or updates]*
- *[New insights or approaches]*

---

## 🚀 Next Phase to Tackle

### Immediate Next Steps
- *[Most important items to tackle next]*
- *[Clear actionable items with priority]*
- *[Dependencies that need to be resolved]*

### Success Criteria
- *[How we'll know this phase is complete]*
- *[Measurable outcomes]*

---

## 📅 Implementation Phases

### Phase 2: *[Future phase title]*
- *[Goals and objectives]*
- *[Key deliverables]*

### Phase 3: *[Future phase title]*
- *[Longer-term objectives]*
- *[Strategic improvements]*

---

## ⚖️ Priorities & Trade-offs

### High Priority Items
- *[Most critical areas requiring attention]*
- *[Items with high impact or blocking other work]*

### Pros & Cons of Current Approach
**Pros:**
- *[Benefits of current implementation]*
- *[What's working well]*

**Cons:**
- *[Limitations or challenges]*
- *[Areas for improvement]*

### Trade-offs to Consider
- *[Key decisions and their implications]*
- *[Balance between competing priorities]*

---

## 🎨 Original Vision

*[Original vision and high-level goals for this area. This should remain relatively stable over time and provide context for all the tactical decisions and implementations.]*

### Core Objectives
- *[Primary goals this area aims to achieve]*
- *[Long-term vision for where this should be]*

### Success Metrics
- *[How success will be measured]*
- *[Key performance indicators]*

---

## 📚 Detailed Documentation

## Implementation Details

*[Detailed technical information, procedures, and reference material that supports the above strategic content.]*

---

*This document is managed by the docs CLI pipeline. Use `./scripts/cli-pipeline/docs/docs-cli.sh` to update.*