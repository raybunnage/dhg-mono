#!/usr/bin/env ts-node

/**
 * Test script for the new proxy server infrastructure
 */

import { 
  ProxyRegistry, 
  ProxyManager,
  ViteFixProxy,
  ProxyManagerProxy,
  ContinuousMonitoringProxy 
} from './packages/proxy-servers';

async function testProxyServers() {
  console.log('🧪 Testing Proxy Server Infrastructure\n');

  const registry = ProxyRegistry.getInstance();
  const manager = new ProxyManager();

  // Create proxy instances
  console.log('📦 Creating proxy instances...');
  const viteFixProxy = new ViteFixProxy();
  const proxyManagerProxy = new ProxyManagerProxy();
  const monitoringProxy = new ContinuousMonitoringProxy();

  // Register proxies
  console.log('📝 Registering proxies...');
  registry.register(viteFixProxy, 'infrastructure');
  registry.register(proxyManagerProxy, 'infrastructure');
  registry.register(monitoringProxy, 'infrastructure');

  // Display registry status
  console.log('\n📊 Registry Status:');
  const status = registry.getStatus();
  console.log(JSON.stringify(status, null, 2));

  // Start proxy manager first (so we can use it to control others)
  console.log('\n🚀 Starting Proxy Manager...');
  try {
    await proxyManagerProxy.start();
    console.log('✅ Proxy Manager started successfully');
    console.log(`   Dashboard: http://localhost:9878/dashboard`);
  } catch (error) {
    console.error('❌ Failed to start Proxy Manager:', error);
  }

  // Start monitoring proxy
  console.log('\n🚀 Starting Continuous Monitoring...');
  try {
    await monitoringProxy.start();
    console.log('✅ Continuous Monitoring started successfully');
    console.log(`   Dashboard: http://localhost:9877/dashboard`);
  } catch (error) {
    console.error('❌ Failed to start Continuous Monitoring:', error);
  }

  // Start vite fix proxy
  console.log('\n🚀 Starting Vite Fix Proxy...');
  try {
    await viteFixProxy.start();
    console.log('✅ Vite Fix Proxy started successfully');
    console.log(`   API: http://localhost:9876/`);
  } catch (error) {
    console.error('❌ Failed to start Vite Fix Proxy:', error);
  }

  // Show final status
  console.log('\n📊 Final Status:');
  const allInfo = registry.getAllInfo();
  for (const [name, info] of Object.entries(allInfo)) {
    console.log(`\n${name}:`);
    console.log(`  Status: ${info.status}`);
    console.log(`  Port: ${info.port}`);
    console.log(`  Uptime: ${info.uptime}s`);
    console.log(`  Endpoints: ${info.endpoints.length}`);
  }

  console.log('\n✨ Proxy servers are running!');
  console.log('\nPress Ctrl+C to stop all servers...\n');

  // Handle shutdown
  process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down all proxy servers...');
    await registry.stopAll();
    console.log('👋 Goodbye!');
    process.exit(0);
  });
}

// Run the test
testProxyServers().catch(console.error);