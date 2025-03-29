# Migration Checklist for Shared Services

This checklist provides guidance on how to determine when it's appropriate to finalize migration from app-specific services to shared packages and how to safely archive old implementations.

## Pre-Migration Checklist

Before starting the migration to shared services, ensure:

- [ ] All components use the service abstraction layer instead of direct API/DB calls
- [ ] All service interfaces are fully documented
- [ ] Unit tests cover critical service functionality
- [ ] Adapter interfaces are aligned with shared service interfaces
- [ ] A rollback plan is documented

## Shared Package Integration Readiness

The shared package is ready to use when:

- [ ] All required functionality is implemented in the shared package
- [ ] Shared package has comprehensive unit tests
- [ ] Documentation covers all public methods
- [ ] Type definitions are complete and accurate
- [ ] Package is properly exported in the monorepo

## App Integration Readiness

An app is ready to integrate shared packages when:

- [ ] All components use service/adapter abstractions (no direct db/api calls)
- [ ] Adapter interfaces match shared service interfaces
- [ ] The app has comprehensive tests for the functionality using the services
- [ ] TypeScript configuration supports shared package imports
- [ ] Development dependencies are properly configured

## Migration Process

1. **Update package.json and tsconfig.json**
   - [ ] Add shared package as dependency
   - [ ] Configure module resolution in tsconfig

2. **Create Initial Integration**
   - [ ] Modify adapters to use shared services
   - [ ] Run all tests to verify functionality
   - [ ] Fix any integration issues

3. **Test and Validate**
   - [ ] Verify all component functionality works with shared services
   - [ ] Validate error handling
   - [ ] Check for any performance issues
   - [ ] Run all unit and integration tests

4. **Finalize Integration**
   - [ ] Clean up any temporary code
   - [ ] Update documentation
   - [ ] Remove old implementations only after verification

## Safe Archiving Checklist

Before archiving old service implementations:

- [ ] All apps using the service have migrated to shared services
- [ ] All components using the service have been updated
- [ ] All tests pass with the new shared services
- [ ] Production monitoring confirms no new errors
- [ ] Performance metrics show acceptable performance
- [ ] A full production backup is available if rollback is needed

## Archiving Process

1. **Document the Archive**
   - [ ] Create documentation of what is being archived
   - [ ] Document the new locations of functionality
   - [ ] Update any external documentation

2. **Archive the Code**
   - [ ] Move files to _archive directory with date suffix
   - [ ] Keep the original structure within the archive
   - [ ] Include a README in the archive explaining the change

3. **Update References**
   - [ ] Remove imports from archived files
   - [ ] Update build configurations to exclude archived files

4. **Monitor Post-Archive**
   - [ ] Monitor application for any issues after archiving
   - [ ] Verify build and test processes still work correctly

## Final Validation

After completing the migration:

- [ ] Run full test suite
- [ ] Validate in staging environment
- [ ] Monitor initial production deployment closely
- [ ] Document lessons learned for future migrations

## Timeline Considerations

Recommended waiting periods before archiving:

| Criticality | Testing Period | Production Validation |
|-------------|---------------|------------------------|
| Low | 1 week | 2 weeks |
| Medium | 2 weeks | 1 month |
| High | 1 month | 3 months |
| Critical | 2 months | 6 months |