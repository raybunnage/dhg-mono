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