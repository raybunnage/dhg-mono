// This file re-exports the logger from @dhg/shared for backward compatibility
// It will be deleted once all imports are updated to use @dhg/shared directly
import { Logger, LogLevel } from "@dhg/shared/utils";

export { Logger, LogLevel };
