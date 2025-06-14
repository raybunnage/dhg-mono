# Continuous Docs Server Renamed to Living Docs Server

## Date: 2025-06-10

## Changes Made

1. **Renamed server file**:
   - From: `apps/dhg-admin-code/continuous-docs-server.cjs`
   - To: `apps/dhg-admin-code/living-docs-server.cjs`

2. **Updated internal references**:
   - Changed environment variable from `CONTINUOUS_DOCS_PORT` to `LIVING_DOCS_PORT`
   - Updated health check service name to `living-docs-server`
   - Updated console log messages to reference "Living docs server"

3. **Updated database**:
   - Applied migration to rename entry in `sys_server_ports_registry`
   - Changed `service_name` from `continuous-docs-server` to `living-docs-server`
   - Updated `display_name` to "Living Docs Server"
   - Updated `description` to "Living documentation tracking"

4. **Updated configuration files**:
   - `scripts/start-all-servers.js` - Updated server configuration
   - `scripts/start-all-servers-dynamic.js` - Updated service registry mapping
   - `packages/shared/services/server-registry-service.ts` - Updated service name
   - `packages/shared/services/ports-management-service.ts` - Updated server config

## Rationale

The term "living docs" better reflects the dynamic, continuously updated nature of the documentation system. This aligns with modern documentation practices where docs are treated as living artifacts that evolve with the codebase.

## Impact

- All references to the server should now use `living-docs-server`
- The API endpoints remain the same (`/api/continuous-docs/*`)
- The port remains 3008
- Existing functionality is unchanged

## Next Steps

- Restart servers to apply changes: `pnpm servers restart`
- Verify the renamed server appears correctly in health checks