# Vite Configuration Guide

## Overview
Vite configurations control how your applications are built, served, and optimized. While basic React apps can work with default settings, understanding these configurations helps you customize behavior as your apps grow.

## Basic Configuration
```javascript
// apps/dhg-a/vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  server: {
    port: 3000,
  }
})
```

## Configuration Categories

### 1. Build Configuration
Controls how your application is built for production.

```javascript
build: {
  // Output directory for built files
  outDir: 'dist',
  
  // Enable source maps for debugging
  sourcemap: true,
  
  // Warning when chunks exceed size
  chunkSizeWarningLimit: 1000,
  
  // Dependency optimization
  commonjsOptions: {
    include: [/node_modules/],
  },
  
  // Where assets are placed
  assetsDir: 'assets',
  
  // Code minification
  minify: 'terser',
}
```

**When to Use:**
- Custom build output location needed
- Production debugging required
- Performance optimization
- Asset management customization

### 2. Development Server
Controls the development environment behavior.

```javascript
server: {
  // Development server port
  port: 3000,
  
  // Auto-open browser
  open: true,
  
  // API proxying for development
  proxy: {
    '/api': {
      target: 'http://localhost:8080',
      changeOrigin: true,
    }
  },
  
  // CORS configuration
  cors: true,
}
```

**When to Use:**
- Local development setup
- API integration
- Cross-origin resource handling
- Multiple services development

### 3. Path Aliases
Simplifies import paths in your code.

```javascript
resolve: {
  alias: {
    '@': '/src',
    '@components': '/src/components',
    '@utils': '/src/utils',
  }
}
```

**When to Use:**
- Clean import paths needed
- Module organization
- Easier refactoring
- Better developer experience

### 4. Environment and Modes
Manages different environment configurations.

```javascript
define: {
  __APP_VERSION__: JSON.stringify('1.0.0'),
},

envPrefix: ['VITE_', 'APP_'],
```

**When to Use:**
- Environment-specific settings
- Feature flags
- API endpoint configuration
- Secret management

### 5. Performance Optimization
Improves build and development performance.

```javascript
optimizeDeps: {
  include: ['linked-package'],
  exclude: ['slow-package'],
},

esbuild: {
  jsxInject: `import React from 'react'`,
}
```

**When to Use:**
- Build speed improvement needed
- Development performance optimization
- Large dependency handling
- Custom optimization requirements

## Common Use Cases

### API Integration
```javascript
server: {
  proxy: {
    '/api': {
      target: process.env.VITE_API_URL,
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/api/, '')
    }
  }
}
```

### Production Optimization
```javascript
build: {
  rollupOptions: {
    output: {
      manualChunks: {
        vendor: ['react', 'react-dom'],
      }
    }
  }
}
```

### Development Tools
```javascript
plugins: [
  react(),
  // Development-only plugins
  process.env.NODE_ENV !== 'production' && devTools(),
].filter(Boolean)
```

## Best Practices

1. **Environment Management**
   - Use .env files for environment variables
   - Prefix variables with VITE_
   - Keep sensitive data out of source control

2. **Performance**
   - Enable sourcemaps only when needed
   - Configure proper chunk sizes
   - Optimize dependencies appropriately

3. **Development Experience**
   - Set up meaningful path aliases
   - Configure proper port numbers
   - Use proxy for API development

4. **Production Builds**
   - Review and optimize chunk settings
   - Configure proper minification
   - Set up appropriate source map levels

## When to Add Configuration

1. **Start with Defaults**
   - Basic React apps work with default settings
   - Add configuration only when needed

2. **Add Configuration When:**
   - Setting up API integration
   - Optimizing build performance
   - Adding development tools
   - Customizing build output
   - Implementing SSR
   - Managing multiple environments

3. **Monitor for Needs**
   - Build performance issues
   - Development workflow friction
   - Production optimization requirements
   - Team collaboration needs

## Troubleshooting

### Common Issues
1. **Build Performance**
   - Review dependency optimization
   - Check chunk configurations
   - Monitor build times

2. **Development Server**
   - Verify port availability
   - Check proxy configurations
   - Review CORS settings

3. **Production Builds**
   - Validate output directory
   - Check environment variables
   - Review optimization settings

## Security Considerations

1. **Environment Variables**
   - Only expose necessary variables
   - Use proper prefixing
   - Keep sensitive data secure

2. **Build Output**
   - Review generated files
   - Check source map exposure
   - Validate asset handling

## Further Resources
- [Vite Documentation](https://vitejs.dev/config/)
- [React Plugin Documentation](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react/README.md)
- [Deployment Guides](https://vitejs.dev/guide/static-deploy.html) 