declare global {
  interface Window {
    globalRenderTracker?: {
      renders: number;
      lastRender: number;
      startTime: number;
    };
  }
}

export {};