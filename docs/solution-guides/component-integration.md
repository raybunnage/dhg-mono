# Component Integration Troubleshooting

## Quick Checks
1. Is the component imported correctly?
   ```typescript
   // Verify import path
   import { ProcessingControls } from '@/components/ProcessingControls';
   ```

2. Is the file in the correct location?
   ```
   apps/
     dhg-improve-experts/
       src/
         components/
           ProcessingControls.tsx  // Verify this exists
   ```

3. Are there multiple versions?
   ```bash
   find ./src -name "*ProcessingControls*.tsx"
   ```

4. Is the build cache stale?
   ```bash
   pnpm clean
   pnpm install
   pnpm build
   ```

## Debug Steps
1. Add console logs:
   ```typescript
   console.log('Component version:', '1.0'); // Add version number
   console.log('Mount time:', new Date().toISOString());
   ```

2. Check component rendering:
   ```typescript
   const ProcessingControls = () => {
     console.log('Render called');
     // ... rest of component
   }
   ```

3. Verify props:
   ```typescript
   export function ProcessingControls(props) {
     console.log('Props received:', props);
     // ... rest of component
   }
   ```

## Common Issues
1. Stale builds
2. Wrong import paths
3. Multiple component versions
4. Cache issues
5. Wrong file location

## Prevention Steps
1. Use consistent file organization:
   ```
   src/
     components/
       feature1/
         index.tsx
         types.ts
         utils.ts
     features/
       feature1/
         components/
         hooks/
         utils/
   ```

2. Add component documentation:
   ```typescript
   /**
    * @component ProcessingControls
    * @version 1.0.0
    * @path src/components/ProcessingControls.tsx
    * @usage
    * <ProcessingControls />
    */
   ```

3. Use TypeScript paths:
   ```json
   {
     "compilerOptions": {
       "paths": {
         "@/components/*": ["./src/components/*"]
       }
     }
   }
   ```

4. Add development utilities:
   ```typescript
   // src/utils/debug.ts
   export const logComponent = (name: string) => {
     if (process.env.NODE_ENV === 'development') {
       console.log(`[${name}] mounted at ${new Date().toISOString()}`);
     }
   };
   ``` 