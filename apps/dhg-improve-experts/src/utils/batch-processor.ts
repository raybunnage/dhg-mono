async function processBatch(fileIds: string[]) {
  // Process in chunks of 5 to avoid rate limits
  const chunks = [];
  for (let i = 0; i < fileIds.length; i += 5) {
    chunks.push(fileIds.slice(i, i + 5));
  }

  for (const chunk of chunks) {
    await Promise.all(chunk.map(processVideo));
    // Wait 1 minute between chunks
    await new Promise(resolve => setTimeout(resolve, 60000));
  }
} 