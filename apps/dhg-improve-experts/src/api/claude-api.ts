/**
 * API route for proxying Claude API requests to bypass CORS
 */
import { proxyClaudeAPI } from './proxy';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const apiKey = process.env.VITE_ANTHROPIC_API_KEY || import.meta.env.VITE_ANTHROPIC_API_KEY;
    
    if (!apiKey) {
      console.error('Missing API key for Claude');
      res.status(500).json({ error: 'API key not configured on server' });
      return;
    }

    // Forward the payload to Claude API
    const { model, max_tokens, temperature, messages, system } = req.body;
    
    const payload = {
      model,
      max_tokens,
      temperature,
      messages,
      system
    };

    console.log('Proxying Claude API request', {
      apiKeyPresent: !!apiKey,
      apiKeyLength: apiKey?.length,
      model
    });

    const result = await proxyClaudeAPI(payload, apiKey);
    res.status(200).json(result);
  } catch (error) {
    console.error('Error in Claude API proxy:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
}