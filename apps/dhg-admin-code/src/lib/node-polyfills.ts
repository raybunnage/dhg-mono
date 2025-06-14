/**
 * Node.js polyfills for browser environment
 * Provides compatibility for libraries that expect Node.js globals
 */

// Polyfill for util.inherits which is used by winston
if (typeof globalThis.util === 'undefined') {
  globalThis.util = {
    inherits: function(ctor: any, superCtor: any) {
      if (superCtor) {
        ctor.super_ = superCtor;
        ctor.prototype = Object.create(superCtor.prototype, {
          constructor: {
            value: ctor,
            enumerable: false,
            writable: true,
            configurable: true
          }
        });
      }
    }
  };
}

// Ensure process is available globally
if (typeof globalThis.process === 'undefined') {
  globalThis.process = {
    env: {},
    browser: true,
    version: '',
    versions: { node: '16.0.0' },
    nextTick: (callback: Function) => setTimeout(callback, 0),
    title: 'browser',
    argv: [],
    platform: 'browser',
    arch: 'browser'
  } as any;
}

// Polyfill for Buffer if needed
if (typeof globalThis.Buffer === 'undefined') {
  try {
    const { Buffer } = require('buffer');
    globalThis.Buffer = Buffer;
  } catch (e) {
    // Buffer polyfill not available
  }
}

export {};