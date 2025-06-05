// This is a middleware for adding CORS headers to outgoing requests
// It supports both Express direct middleware and Vite plugin format

// For Express: Export middleware function directly
const corsMiddleware = (req, res, next) => {
  // Add CORS headers to all responses
  // Instead of wildcard, use specific origins since we're allowing credentials
  const origin = req.headers.origin || 'http://localhost:5173';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, x-api-key, anthropic-version');
  // Allow credentials (cookies, authorization headers, etc)
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  // Handle preflight OPTIONS requests
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }
  
  next();
};

// For vite plugin: Export plugin object
corsMiddleware.vitePlugin = () => {
  return {
    name: 'cors-middleware',
    configureServer(server) {
      server.middlewares.use(corsMiddleware);
    }
  };
};

module.exports = corsMiddleware;