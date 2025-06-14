export { GoogleAuthService } from './GoogleAuthService';
export type {
  GoogleAuthToken,
  ServiceAccountConfig,
  GoogleAuthConfig,
  TokenStorageAdapter,
  TokenExpirationInfo,
  AuthMethod,
  AuthStatus
} from './types';
export {
  GOOGLE_SCOPES,
  SCOPE_PRESETS,
  ENV_VARS,
  DEFAULT_PATHS
} from './types';

// Also export default for compatibility
export { default } from './GoogleAuthService';