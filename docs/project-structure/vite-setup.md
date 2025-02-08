# Vite Configuration Setup

## Structure
```
dhg-mono/
├── vite.config.base.js     # Shared base configuration
└── apps/
    ├── dhg-a/
    │   └── vite.config.js  # dhg-a specific config
    └── dhg-b/
        └── vite.config.js  # dhg-b specific config
```

## Configuration Approach

### Base Configuration
The root `vite.config.base.js` contains shared settings that apply to all apps:
- Common build options
- Shared development settings
- Consistent chunk splitting
- Default server configuration

### App-Specific Configuration
Each app's `vite.config.js` extends the base configuration and adds:
- App-specific plugins
- Custom port numbers
- Unique build requirements
- Override shared settings as needed

## Port Assignments
- dhg-a: 3000
- dhg-b: 3001

## Common Settings
All apps inherit:
- Source maps for debugging
- Vendor chunk splitting
- CORS configuration
- Empty output directory on build

## Usage
No special steps needed - Vite will automatically use these configurations when:
- Running development server (`pnpm dev`)
- Building for production (`pnpm build`)
- Running tests (if configured) 