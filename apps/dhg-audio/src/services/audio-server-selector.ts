/**
 * Audio Server Selector Service
 * 
 * Allows the dhg-audio app to switch between local and web audio servers
 * without requiring server restarts.
 */

export type AudioServerMode = 'local' | 'web';

interface AudioServerConfig {
  mode: AudioServerMode;
  url: string;
  port: number;
  description: string;
}

const AUDIO_SERVERS: Record<AudioServerMode, AudioServerConfig> = {
  local: {
    mode: 'local',
    url: 'http://localhost:3007',
    port: 3007,
    description: 'Local Google Drive (10-100x faster for synced files)'
  },
  web: {
    mode: 'web', 
    url: 'http://localhost:3006',
    port: 3006,
    description: 'Web API (works anywhere with internet)'
  }
};

class AudioServerSelector {
  private currentMode: AudioServerMode;
  private serverUrls: Record<AudioServerMode, string> = {
    local: 'http://localhost:3007',
    web: 'http://localhost:3006'
  };
  
  constructor() {
    // Load saved preference or default to local
    const saved = localStorage.getItem('audioServerMode') as AudioServerMode;
    this.currentMode = saved && saved in AUDIO_SERVERS ? saved : 'local';
  }
  
  /**
   * Get current server configuration
   */
  getCurrentServer(): AudioServerConfig {
    return AUDIO_SERVERS[this.currentMode];
  }
  
  /**
   * Get current server URL
   */
  getServerUrl(): string {
    return this.serverUrls[this.currentMode];
  }
  
  /**
   * Update server URLs from registry
   */
  updateServerUrls(urls: Record<AudioServerMode, string>): void {
    this.serverUrls = urls;
    // Update the static configuration as well
    if (urls.local) {
      AUDIO_SERVERS.local.url = urls.local;
      AUDIO_SERVERS.local.port = parseInt(new URL(urls.local).port);
    }
    if (urls.web) {
      AUDIO_SERVERS.web.url = urls.web;
      AUDIO_SERVERS.web.port = parseInt(new URL(urls.web).port);
    }
  }
  
  /**
   * Get current mode
   */
  getMode(): AudioServerMode {
    return this.currentMode;
  }
  
  /**
   * Switch to a different server
   */
  setMode(mode: AudioServerMode): void {
    if (mode in AUDIO_SERVERS) {
      this.currentMode = mode;
      localStorage.setItem('audioServerMode', mode);
      // Optionally emit an event for UI updates
      window.dispatchEvent(new CustomEvent('audioServerChanged', { 
        detail: { mode, config: AUDIO_SERVERS[mode] }
      }));
    }
  }
  
  /**
   * Get all available servers
   */
  getAvailableServers(): AudioServerConfig[] {
    return Object.values(AUDIO_SERVERS);
  }
  
  /**
   * Check if a server is responding
   */
  async checkServerHealth(mode: AudioServerMode): Promise<boolean> {
    try {
      const response = await fetch(`${this.serverUrls[mode]}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(3000)
      });
      return response.ok;
    } catch {
      return false;
    }
  }
  
  /**
   * Auto-select the best available server
   */
  async autoSelectBestServer(): Promise<AudioServerMode> {
    // First try local (faster if available)
    if (await this.checkServerHealth('local')) {
      this.setMode('local');
      return 'local';
    }
    
    // Fall back to web
    if (await this.checkServerHealth('web')) {
      this.setMode('web');
      return 'web';
    }
    
    // Default to web if neither responds
    console.warn('No audio servers responding, defaulting to web mode');
    this.setMode('web');
    return 'web';
  }
}

// Export singleton instance
export const audioServerSelector = new AudioServerSelector();