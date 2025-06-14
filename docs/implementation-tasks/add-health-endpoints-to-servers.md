# Add Health Check Endpoints to Servers

Each server needs a `/health` endpoint for the registry to monitor. Here's what needs to be added:

## Servers Requiring Health Endpoints

### 1. simple-md-server.js
Add before the wildcard route:
```javascript
// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'md-server', timestamp: new Date().toISOString() });
});
```

### 2. simple-script-server.js
Add before the wildcard route:
```javascript
// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'script-server', timestamp: new Date().toISOString() });
});
```

### 3. docs-archive-server.js
Add before other routes:
```javascript
// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'docs-archive-server', timestamp: new Date().toISOString() });
});
```

### 4. git-server.cjs
Add to existing routes:
```javascript
// Health check endpoint
app.get('/api/git/health', (req, res) => {
  res.json({ status: 'healthy', service: 'git-server', timestamp: new Date().toISOString() });
});
```

### 5. continuous-docs-server.cjs
Add to existing routes:
```javascript
// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'continuous-docs-server', timestamp: new Date().toISOString() });
});
```

### 6. git-api-server.cjs
Add to existing routes:
```javascript
// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'git-api-server', timestamp: new Date().toISOString() });
});
```

### 7. server.js (audio proxy)
Add to existing routes:
```javascript
// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'audio-proxy-server', timestamp: new Date().toISOString() });
});
```

## Implementation Priority
1. Start with git-api-server.cjs and continuous-docs-server.cjs (most used)
2. Then md-server and script-server
3. Finally the rest

This allows the health monitoring to work properly!