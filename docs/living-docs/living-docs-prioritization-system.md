# Living Documents Prioritization System

## Metadata
- **Last Updated**: 2025-06-11
- **Next Review**: 2025-06-12
- **Status**: Active
- **Priority**: High
- **Category**: Documentation
- **Related Tasks**: #758a41d1-2aff-4969-adbb-1706baa0a26a

## Executive Summary
A system for prioritizing and managing 40+ living documents with Phase 1 analysis, value/effort assessment, and automated dashboard generation to help choose the next work items effectively.

## Phase 1: Complete Basic Prioritization Dashboard

### Summary
Implement the prioritization service, CLI commands, and UI integration to generate and display a priority dashboard that ranks all living documents by their Phase 1 value/effort ratio.

### Value Proposition
**Potential Gains:**
- Clear visibility into which Phase 1 tasks offer the best ROI
- Automated analysis of 40+ documents to find duplicates and gaps
- One-click dashboard generation for quick decision making
- Reduced time spent manually reviewing documents

**Implementation Effort:**
- **Estimated Time**: 4-6 hours
- **Complexity**: Medium
- **Dependencies**: Living docs server, existing UI components

**Risks & Challenges:**
- Parsing variations in document formats may require adjustments
- Initial template migration for non-compliant documents
- Performance with large number of documents

### Priority Score: High
**Justification**: High value for decision-making with moderate implementation effort. Enables systematic approach to managing technical debt and feature development.

### Success Criteria
- [x] Created enhanced living docs template with Phase 1 pros/cons
- [x] Implemented prioritization service with duplicate detection
- [x] Added CLI pipeline for living docs management
- [x] Integrated priority dashboard into UI
- [ ] Migrated all 40 documents to new template format
- [ ] Generated first priority dashboard

## Current State
- Created `LivingDocsPrioritizationService` with metadata extraction and duplicate detection
- Added `living-docs-cli.sh` with prioritize, analyze, and consolidate commands
- Enhanced living docs server with `/api/living-docs/priority-dashboard` endpoint
- Updated UI with "Priority Dashboard" button and display capability
- Ready for document migration and first dashboard generation

## Future Phases

### Phase 2: Automated Document Updates
- **Summary**: Implement automated template updates and consistency checks
- **Prerequisites**: Phase 1 completion, all documents following template
- **Estimated Value**: High

### Phase 3: Integration with Dev Tasks
- **Summary**: Auto-create dev tasks from high-priority Phase 1 items
- **Prerequisites**: Phase 2 completion, task priority scoring
- **Estimated Value**: Medium

## Implementation History
- 2025-06-11: Created prioritization service and CLI pipeline
- 2025-06-11: Added UI integration for priority dashboard
- 2025-06-11: Implemented duplicate detection algorithm

## Notes & Considerations
- Consider adding a "snooze" feature for Phase 1 items that aren't ready
- May want to add tags or labels for cross-cutting concerns
- Dashboard could be enhanced with charts/visualizations in future
- Integration with task system would enable automatic work queue generation