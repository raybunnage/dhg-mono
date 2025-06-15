#!/usr/bin/env ts-node

import * as path from 'path';
import express from 'express';
import cors from 'cors';
import { spawn } from 'child_process';

// Import the proxy server directly
const proxyPath = path.join(__dirname, '../../../packages/shared/services/proxy-servers/cli-test-runner-proxy.ts');

console.log('🧪 Starting CLI Test Runner Proxy Server on port 9890...');

// Just require and run the proxy server
require(proxyPath);