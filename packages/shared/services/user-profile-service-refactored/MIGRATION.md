# UserProfileService Migration Guide

## Overview

The UserProfileService has been refactored from a singleton pattern to a BusinessService with dependency injection. This migration improves testability, maintainability, and follows the established service architecture patterns.

## Migration Summary

- **From**: Singleton pattern with getInstance()
- **To**: BusinessService with constructor dependency injection
- **Impact**: Major breaking change requiring updates to all consumers
- **Benefits**: Better testability, dependency management, metrics tracking, health checks

## Breaking Changes

### 1. Service Instantiation

**Before (Singleton Pattern)**:
```typescript
import { userProfileService } from '@shared/services/user-profile-service';

// Service was automatically instantiated
const result = await userProfileService.getProfile(userId);
```

**After (Dependency Injection)**:
```typescript
import { UserProfileService } from '@shared/services/user-profile-service-refactored';
import { SupabaseClientService } from '@shared/services/supabase-client';
import { Logger } from '@shared/utils/logger';

const supabase = SupabaseClientService.getInstance().getClient();
const logger = new Logger('UserProfile');

const userProfileService = new UserProfileService(supabase, logger);
const result = await userProfileService.getProfile(userId);
```

### 2. Constructor Requirements

The new service requires explicit dependency injection:

```typescript
constructor(
  private supabase: SupabaseClient<any>,
  logger?: Logger
)
```

## New Features

### 1. Comprehensive Metrics

```typescript
const metrics = userProfileService.getMetrics();
console.log(`Profiles created: ${metrics.profilesCreated}`);
console.log(`Average completeness: ${metrics.averageProfileCompleteness}%`);
console.log(`Onboarding completions: ${metrics.onboardingCompletions}`);
```

### 2. Health Checks

```typescript
const health = await userProfileService.healthCheck();
if (!health.healthy) {
  console.error('Service is unhealthy:', health.details);
}
```

### 3. Structured Logging

```typescript
import { Logger } from '@shared/utils/logger';

const logger = new Logger('UserProfileWorkflow');
const service = new UserProfileService(supabase, logger);

// All operations are now logged with context
await service.saveProfile(userId, profileData);
```

## Migration Steps

### Step 1: Update Imports

Replace singleton import with class import:

```diff
- import { userProfileService } from '@shared/services/user-profile-service';
+ import { UserProfileService } from '@shared/services/user-profile-service-refactored';
```

### Step 2: Set Up Dependencies

Create the required dependencies:

```typescript
import { SupabaseClientService } from '@shared/services/supabase-client';
import { Logger } from '@shared/utils/logger';

const supabase = SupabaseClientService.getInstance().getClient();
const logger = new Logger('UserProfile');
```

### Step 3: Create Service Instance

```typescript
const userProfileService = new UserProfileService(supabase, logger);
```

### Step 4: Update Method Calls

The API remains the same, but now called on the instance:

```diff
- const result = await userProfileService.getProfile(userId);
+ const result = await userProfileService.getProfile(userId);
```

## Example Migrations

### React Component Migration

**Before**:
```typescript
// components/ProfileForm.tsx
import { userProfileService } from '@shared/services/user-profile-service';

export function ProfileForm({ userId }: { userId: string }) {
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    const loadProfile = async () => {
      const result = await userProfileService.getProfile(userId);
      if (result.success) {
        setProfile(result.profile);
      }
    };
    loadProfile();
  }, [userId]);

  const handleSave = async (data: ProfileFormData) => {
    await userProfileService.saveProfile(userId, data);
  };

  // ... rest of component
}
```

**After**:
```typescript
// components/ProfileForm.tsx
import { UserProfileService } from '@shared/services/user-profile-service-refactored';
import { useSupabase } from '../hooks/useSupabase';

export function ProfileForm({ userId }: { userId: string }) {
  const [profile, setProfile] = useState(null);
  const supabase = useSupabase();
  const userProfileService = useMemo(() => 
    new UserProfileService(supabase), [supabase]
  );

  useEffect(() => {
    const loadProfile = async () => {
      const result = await userProfileService.getProfile(userId);
      if (result.success) {
        setProfile(result.profile);
      }
    };
    loadProfile();
  }, [userId, userProfileService]);

  const handleSave = async (data: ProfileFormData) => {
    await userProfileService.saveProfile(userId, data);
    
    // New: Access metrics
    const metrics = userProfileService.getMetrics();
    console.log('Profile save metrics:', metrics);
  };

  // ... rest of component
}
```

### CLI Script Migration

**Before**:
```typescript
// scripts/user-profiles.ts
import { userProfileService } from '@shared/services/user-profile-service';

async function main() {
  const userId = 'user-123';
  const profile = await userProfileService.getProfile(userId);
  
  if (profile.success) {
    console.log('Profile completeness:', profile.profile?.profile_completeness);
  }
}
```

**After**:
```typescript
// scripts/user-profiles.ts
import { UserProfileService } from '@shared/services/user-profile-service-refactored';
import { SupabaseClientService } from '@shared/services/supabase-client';
import { Logger } from '@shared/utils/logger';

async function main() {
  const logger = new Logger('UserProfileScript');
  const supabase = SupabaseClientService.getInstance().getClient();
  const userProfileService = new UserProfileService(supabase, logger);
  
  const userId = 'user-123';
  const profile = await userProfileService.getProfile(userId);
  
  if (profile.success) {
    console.log('Profile completeness:', profile.profile?.profile_completeness);
    
    // New: Health check before operations
    const health = await userProfileService.healthCheck();
    logger.info('Service health:', health);
    
    // New: Access comprehensive metrics
    const metrics = userProfileService.getMetrics();
    logger.info('Service metrics:', metrics);
  }
}
```

### Service Integration Migration

**Before**:
```typescript
// Another service using user profiles
export class LearningRecommendationService {
  async getPersonalizedContent(userId: string) {
    const topics = await userProfileService.getRecommendedTopics(userId);
    return this.findContentForTopics(topics);
  }
}
```

**After**:
```typescript
import { UserProfileService } from '@shared/services/user-profile-service-refactored';

export class LearningRecommendationService {
  constructor(
    private userProfileService: UserProfileService,
    private logger?: Logger
  ) {}
  
  async getPersonalizedContent(userId: string) {
    // New: Health check before critical operations
    const health = await this.userProfileService.healthCheck();
    if (!health.healthy) {
      throw new Error('User profile service is unhealthy');
    }
    
    const topics = await this.userProfileService.getRecommendedTopics(userId);
    return this.findContentForTopics(topics);
  }
}

// Usage with dependency injection
const userProfileService = new UserProfileService(supabase, logger);
const recommendationService = new LearningRecommendationService(userProfileService, logger);
```

## Testing Migration

### Before (Limited Testing)

The singleton pattern made testing difficult with shared state.

### After (Comprehensive Testing)

Dependency injection enables easy mocking:

```typescript
import { UserProfileService } from './UserProfileService';

describe('UserProfileService', () => {
  let service: UserProfileService;
  let mockSupabase: any;

  beforeEach(() => {
    mockSupabase = createMockSupabase();
    service = new UserProfileService(mockSupabase);
  });

  it('should retrieve profile successfully', async () => {
    mockSupabase.from.mockReturnValue({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: mockProfile, error: null })
        })
      })
    });

    const result = await service.getProfile('user-123');
    expect(result.success).toBe(true);
  });
});
```

## Performance Improvements

The refactored service includes:

1. **Metrics Tracking**: Detailed performance monitoring
2. **Health Monitoring**: Proactive service health management
3. **Structured Logging**: Enhanced observability
4. **Memory Efficiency**: No singleton global state

### Benchmark Results

Run the benchmark to see performance improvements:

```bash
cd packages/shared/services/user-profile-service-refactored
ts-node benchmark.ts
```

Expected improvements:
- Better memory management (no global singleton state)
- Improved error handling and recovery
- Enhanced observability through metrics
- More predictable performance characteristics

## API Compatibility

All public methods maintain the same signatures:

- `getProfile(allowedEmailId: string): Promise<ProfileResult>`
- `saveProfile(allowedEmailId: string, profileData: ProfileFormData): Promise<ProfileResult>`
- `updateProfile(allowedEmailId: string, updates: UserProfileUpdate): Promise<ProfileResult>`
- `hasCompletedOnboarding(allowedEmailId: string): Promise<boolean>`
- `getRecommendedTopics(allowedEmailId: string): Promise<string[]>`
- `getProfileStats(allowedEmailId: string): Promise<ProfileStats>`

New methods:
- `getMetrics(): UserProfileServiceMetrics`
- `healthCheck(): Promise<HealthCheckResult>`

## Rollback Plan

If issues arise during migration:

1. **Immediate Rollback**: Change imports back to original service
2. **Gradual Migration**: Migrate components one at a time
3. **Testing in Isolation**: Use feature flags to test new service

```typescript
// Rollback import
import { userProfileService } from '@shared/services/user-profile-service';

// Resume using original service
const result = await userProfileService.getProfile(userId);
```

## Common Migration Patterns

### 1. Hook-Based Dependency Injection (React)

```typescript
// hooks/useUserProfileService.ts
import { useMemo } from 'react';
import { UserProfileService } from '@shared/services/user-profile-service-refactored';
import { useSupabase } from './useSupabase';

export function useUserProfileService() {
  const supabase = useSupabase();
  
  return useMemo(() => 
    new UserProfileService(supabase), 
    [supabase]
  );
}

// Usage in components
const userProfileService = useUserProfileService();
```

### 2. Service Factory Pattern

```typescript
// services/ServiceFactory.ts
export class ServiceFactory {
  private static userProfileService?: UserProfileService;
  
  static getUserProfileService(): UserProfileService {
    if (!this.userProfileService) {
      const supabase = SupabaseClientService.getInstance().getClient();
      const logger = new Logger('UserProfile');
      this.userProfileService = new UserProfileService(supabase, logger);
    }
    return this.userProfileService;
  }
}
```

### 3. Dependency Injection Container

```typescript
// di/container.ts
export class Container {
  private services = new Map();
  
  registerUserProfileService(supabase: SupabaseClient, logger?: Logger) {
    this.services.set('userProfile', new UserProfileService(supabase, logger));
  }
  
  getUserProfileService(): UserProfileService {
    return this.services.get('userProfile');
  }
}
```

## Validation Checklist

After migration, verify:

- [ ] All imports updated to new service
- [ ] Dependencies properly injected
- [ ] Service instantiation working correctly
- [ ] All method calls updated (if needed)
- [ ] Tests passing with new service
- [ ] Metrics and health checks accessible
- [ ] Performance meets or exceeds original
- [ ] Error handling working as expected
- [ ] Logging configured and working
- [ ] No memory leaks from singleton state

## Support

For migration assistance:

1. Check existing migrations in other refactored services
2. Review test files for proper dependency setup
3. Use benchmark to validate performance
4. Consult SERVICE_REFACTORING_COMPLETE_GUIDE.md for patterns

## Conclusion

This migration transforms UserProfileService from a rigid singleton to a flexible, testable, and observable business service. While it requires initial setup work, the benefits include:

- **Better Architecture**: Follows established service patterns
- **Enhanced Testing**: Full test coverage with dependency injection
- **Improved Monitoring**: Comprehensive metrics and health checks
- **Greater Flexibility**: Easy to configure and extend
- **Better Maintainability**: Clear dependencies and structured logging

The investment in migration will pay dividends in service reliability, maintainability, and development velocity.