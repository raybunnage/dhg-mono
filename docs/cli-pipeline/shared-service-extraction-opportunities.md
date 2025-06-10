# Shared Service Extraction Opportunities Analysis

## Executive Summary

After analyzing the apps directory, I've identified several significant opportunities for shared service extraction. The most common patterns involve authentication services, filter services, Google Drive utilities, and various adapter patterns that could be consolidated.

## 1. Authentication Services (HIGH PRIORITY)

### Current Duplication
- **dhg-admin-code** and **dhg-admin-suite** have identical `admin-auth-service.ts` implementations
- **dhg-audio** has multiple auth services: `auth-service.ts`, `light-auth-service.ts`, `dhg-audio-auth-service.ts`
- Multiple apps have similar `useAuth` hooks with duplicated logic

### Extraction Opportunity
**Consolidate into `@shared/services/admin-auth-service`**

```typescript
// Shared admin auth service functionality
export class AdminAuthService {
  async isUserAdmin(): Promise<boolean>
  async getAdminMetadata(): Promise<any>
  async checkAppMetadata(key: string, value: any): Promise<boolean>
}
```

**Affected Apps**: dhg-admin-code, dhg-admin-suite, dhg-audio
**Complexity**: Low - Services are already nearly identical
**Impact**: High - Reduces duplication and standardizes admin authentication

## 2. Filter Service Implementations (HIGH PRIORITY)

### Current Duplication
- **dhg-hub** has a full `filter-service-adapter.ts` (328 lines)
- **dhg-admin-suite** wraps the shared FilterService
- **dhg-admin-google** has its own `filter-service-adapter.ts`
- **dhg-audio** references filter services in multiple components

### Extraction Opportunity
**Enhance existing `@shared/services/filter-service` with browser-specific adapter**

```typescript
// Browser-specific filter service adapter
export class BrowserFilterServiceAdapter {
  constructor(private supabase: SupabaseClient)
  async listProfiles(): Promise<FilterProfile[]>
  async loadActiveProfile(): Promise<FilterProfile | null>
  async setActiveProfile(profileId: string): Promise<boolean>
  async applyFilterToQuery(query: any, activeProfileId?: string): Promise<any>
}
```

**Affected Apps**: dhg-hub, dhg-admin-suite, dhg-admin-google, dhg-audio
**Complexity**: Medium - Need to merge different implementations
**Impact**: High - Central filter management across all apps

## 3. Google Drive Utilities (MEDIUM PRIORITY)

### Current Duplication
- **dhg-audio** has `google-drive-utils.ts` with proxy URL generation
- **dhg-admin-google** wraps shared service but adds additional utilities
- Multiple apps handle Drive ID extraction differently

### Extraction Opportunity
**Create `@shared/utils/google-drive-utils`**

```typescript
// Shared Google Drive utilities
export const googleDriveUtils = {
  extractDriveId(url: string): string | null
  getProxyUrl(driveId: string, type: 'audio' | 'document'): string
  getPreviewUrl(driveId: string): string
  getDownloadUrl(driveId: string): string
  getAudioUrlOptions(webViewLink: string): string[]
}
```

**Affected Apps**: dhg-audio, dhg-admin-google
**Complexity**: Low - Mostly utility functions
**Impact**: Medium - Standardizes Drive URL handling

## 4. Worktree Mapping Utilities (MEDIUM PRIORITY)

### Current Duplication
- **dhg-admin-code** has comprehensive worktree mapping utilities
- Multiple apps could benefit from worktree awareness

### Extraction Opportunity
**Move to `@shared/utils/worktree-utils`**

```typescript
// Shared worktree utilities
export interface WorktreeMapping { ... }
export const worktreeMappings: WorktreeMapping[]
export function getWorktreeByPath(path: string): WorktreeMapping | undefined
export function getAppsForWorktree(path: string): string[]
export function getCliPipelinesForWorktree(path: string): string[]
```

**Affected Apps**: dhg-admin-code, potentially all apps
**Complexity**: Low - Just moving existing code
**Impact**: Medium - Enables worktree-aware features across apps

## 5. Supabase Client Initialization (LOW PRIORITY)

### Current Duplication
- Every app has its own `lib/supabase.ts` file
- Most follow the same pattern with `createSupabaseAdapter`

### Extraction Opportunity
**Standardize initialization pattern (documentation/template)**

Rather than extracting code, provide a standard template and ensure all apps follow it consistently.

**Affected Apps**: All apps
**Complexity**: Low - Documentation and consistency
**Impact**: Low - Pattern is already mostly standardized

## 6. Environment Check Utilities (LOW PRIORITY)

### Current Duplication
- **dhg-audio** has `env-check.ts` for environment validation
- Other apps could benefit from similar checks

### Extraction Opportunity
**Create `@shared/utils/env-check`**

```typescript
// Shared environment validation
export function validateBrowserEnv(requiredVars: string[]): void
export function getEnvVar(key: string, fallback?: string): string
export function isProduction(): boolean
export function isDevelopment(): boolean
```

**Affected Apps**: dhg-audio, potentially all apps
**Complexity**: Low - Simple utility functions
**Impact**: Low - Nice to have for consistency

## 7. Profile Service Patterns (LOW PRIORITY)

### Current Duplication
- **dhg-audio** has `profile-service.ts` and `user-profile-browser-service.ts`
- Profile management logic could be shared

### Extraction Opportunity
**Create `@shared/services/user-profile-service`**

```typescript
// Shared user profile service
export class UserProfileService {
  async getProfile(userId: string): Promise<UserProfile>
  async updateProfile(userId: string, updates: Partial<UserProfile>): Promise<void>
  async createProfile(userId: string, data: UserProfile): Promise<void>
}
```

**Affected Apps**: dhg-audio, potentially dhg-hub, dhg-admin-suite
**Complexity**: Medium - Need to generalize profile structure
**Impact**: Low - Limited current usage

## Implementation Recommendations

### Phase 1 (Immediate - High Impact)
1. **Admin Auth Service** - Extract from dhg-admin-code/suite
2. **Filter Service Adapter** - Consolidate dhg-hub implementation into shared
3. **Google Drive Utils** - Extract from dhg-audio

### Phase 2 (Short Term - Medium Impact)
4. **Worktree Utils** - Move from dhg-admin-code to shared
5. **Environment Check Utils** - Extract from dhg-audio

### Phase 3 (Long Term - Nice to Have)
6. **Profile Service** - Generalize if more apps need it
7. **Supabase Init Templates** - Create documentation

## Estimated Effort

- **Total Extraction Points**: 7 major opportunities
- **High Priority Items**: 3 (1-2 days each)
- **Medium Priority Items**: 2 (0.5-1 day each)
- **Low Priority Items**: 2 (0.5 day each)
- **Total Estimated Effort**: 5-8 days for full implementation

## Benefits

1. **Code Reduction**: Eliminate ~1000+ lines of duplicated code
2. **Consistency**: Standardize implementations across apps
3. **Maintenance**: Single point of updates for shared functionality
4. **Testing**: Test once, use everywhere
5. **New App Development**: Faster bootstrapping with shared services