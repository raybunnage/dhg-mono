export async function proxyGoogleDrive(driveId: string, accessToken: string) {
  const url = `https://www.googleapis.com/drive/v3/files/${driveId}?alt=media`;
  
  // Use server-side fetch to avoid CORS
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch: ${response.status}`);
  }

  return response.arrayBuffer();
}

export async function proxyClaudeAPI(payload: any, apiKey: string) {
  const url = 'https://api.anthropic.com/v1/messages';
  
  console.log('Making Claude API request via proxy', {
    apiKeyPresent: !!apiKey,
    apiKeyLength: apiKey?.length,
    payloadSize: JSON.stringify(payload).length
  });
  
  // Server-side fetch to avoid CORS
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify(payload)
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('Claude API error:', {
      status: response.status,
      statusText: response.statusText,
      error: errorText
    });
    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
  }
  
  return response.json();
}