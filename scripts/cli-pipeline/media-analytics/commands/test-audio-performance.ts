#!/usr/bin/env ts-node
import https from 'https';
import http from 'http';
import { URL } from 'url';

interface TestResult {
  fileId: string;
  fileName: string;
  servedFrom: string;
  responseTime: number;
  fileSize: number;
  success: boolean;
  error?: string;
}

export async function testAudioPerformance(serverUrl: string, fileIds: string[]) {
  console.log(`\nTesting audio server performance: ${serverUrl}\n`);
  
  const results: TestResult[] = [];
  
  for (const fileId of fileIds) {
    const result = await testSingleFile(serverUrl, fileId);
    results.push(result);
    
    // Display result immediately
    if (result.success) {
      console.log(`✅ ${result.fileName} (${result.fileId})`);
      console.log(`   Served from: ${result.servedFrom}`);
      console.log(`   Response time: ${result.responseTime}ms`);
      console.log(`   File size: ${formatBytes(result.fileSize)}`);
    } else {
      console.log(`❌ Failed to fetch ${fileId}: ${result.error}`);
    }
    console.log('');
  }
  
  // Summary statistics
  const successfulResults = results.filter(r => r.success);
  if (successfulResults.length > 0) {
    const avgResponseTime = successfulResults.reduce((sum, r) => sum + r.responseTime, 0) / successfulResults.length;
    const localResults = successfulResults.filter(r => r.servedFrom === 'local-google-drive');
    const apiResults = successfulResults.filter(r => r.servedFrom === 'google-drive-api');
    
    console.log('\n📊 Summary Statistics:');
    console.log(`Total files tested: ${fileIds.length}`);
    console.log(`Successful: ${successfulResults.length}`);
    console.log(`Failed: ${results.length - successfulResults.length}`);
    console.log(`\nServed from local: ${localResults.length}`);
    console.log(`Served from API: ${apiResults.length}`);
    
    if (localResults.length > 0) {
      const avgLocalTime = localResults.reduce((sum, r) => sum + r.responseTime, 0) / localResults.length;
      console.log(`\nAverage local response time: ${avgLocalTime.toFixed(0)}ms`);
    }
    
    if (apiResults.length > 0) {
      const avgApiTime = apiResults.reduce((sum, r) => sum + r.responseTime, 0) / apiResults.length;
      console.log(`Average API response time: ${avgApiTime.toFixed(0)}ms`);
    }
    
    console.log(`\nOverall average response time: ${avgResponseTime.toFixed(0)}ms`);
    
    if (localResults.length > 0 && apiResults.length > 0) {
      const avgLocalTime = localResults.reduce((sum, r) => sum + r.responseTime, 0) / localResults.length;
      const avgApiTime = apiResults.reduce((sum, r) => sum + r.responseTime, 0) / apiResults.length;
      const speedup = avgApiTime / avgLocalTime;
      console.log(`\n🚀 Local files are ${speedup.toFixed(1)}x faster than API!`);
    }
  }
}

async function testSingleFile(serverUrl: string, fileId: string): Promise<TestResult> {
  const startTime = Date.now();
  const url = `${serverUrl}/api/audio/${fileId}`;
  
  return new Promise((resolve) => {
    const parsedUrl = new URL(url);
    const client = parsedUrl.protocol === 'https:' ? https : http;
    
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: parsedUrl.pathname,
      method: 'HEAD',
      timeout: 10000
    };
    
    const req = client.request(options, (res) => {
      const responseTime = Date.now() - startTime;
      
      if (res.statusCode === 200) {
        resolve({
          fileId,
          fileName: extractFileName(res.headers['content-disposition'] as string) || fileId,
          servedFrom: res.headers['x-served-from'] as string || 'unknown',
          responseTime,
          fileSize: parseInt(res.headers['content-length'] as string) || 0,
          success: true
        });
      } else {
        resolve({
          fileId,
          fileName: fileId,
          servedFrom: 'unknown',
          responseTime,
          fileSize: 0,
          success: false,
          error: `HTTP ${res.statusCode}: ${res.statusMessage}`
        });
      }
    });
    
    req.on('error', (error) => {
      resolve({
        fileId,
        fileName: fileId,
        servedFrom: 'unknown',
        responseTime: Date.now() - startTime,
        fileSize: 0,
        success: false,
        error: error.message
      });
    });
    
    req.on('timeout', () => {
      req.destroy();
      resolve({
        fileId,
        fileName: fileId,
        servedFrom: 'unknown',
        responseTime: Date.now() - startTime,
        fileSize: 0,
        success: false,
        error: 'Request timeout'
      });
    });
    
    req.end();
  });
}

function extractFileName(contentDisposition: string | undefined): string | null {
  if (!contentDisposition) return null;
  
  const match = contentDisposition.match(/filename="(.+?)"/);
  return match ? match[1] : null;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Export function to test against both servers
export async function compareServers(fileIds: string[]) {
  console.log('🔄 Comparing standard server vs enhanced server\n');
  
  // Test standard server
  console.log('Testing standard server (API only)...');
  await testAudioPerformance('http://localhost:3006', fileIds);
  
  console.log('\n' + '='.repeat(60) + '\n');
  
  // Test enhanced server
  console.log('Testing enhanced server (local + API fallback)...');
  await testAudioPerformance('http://localhost:3006', fileIds);
}