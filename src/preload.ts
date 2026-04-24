import { contextBridge, ipcRenderer } from 'electron';

// Exposer une API sécurisée au renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // Hardware
  getSystemInfo: () => ipcRenderer.invoke('hardware:getSystemInfo'),
  getCPUInfo: () => ipcRenderer.invoke('hardware:getCPUInfo'),
  getGPUInfo: () => ipcRenderer.invoke('hardware:getGPUInfo'),
  getRAMInfo: () => ipcRenderer.invoke('hardware:getRAMInfo'),
  getStorageInfo: () => ipcRenderer.invoke('hardware:getStorageInfo'),
  getTemperatures: () => ipcRenderer.invoke('hardware:getTemperatures'),

  // Benchmark
  startBenchmark: (options: any) => ipcRenderer.invoke('benchmark:start', options),
  stopBenchmark: () => ipcRenderer.invoke('benchmark:stop'),
  onBenchmarkProgress: (callback: (progress: any) => void) => {
    ipcRenderer.on('benchmark:progress', (_, progress) => callback(progress));
  },

  // Stress Test
  startStressTest: (duration: number) => ipcRenderer.invoke('stresstest:start', duration),
  stopStressTest: () => ipcRenderer.invoke('stresstest:stop'),
  onStressTestData: (callback: (data: any) => void) => {
    ipcRenderer.on('stresstest:data', (_, data) => callback(data));
  },

  // Report
  generateReport: (data: any) => ipcRenderer.invoke('report:generate', data),
  uploadReport: (reportData: any) => ipcRenderer.invoke('report:upload', reportData),

  // Shell
  openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),

  // Utils
  removeAllListeners: (channel: string) => ipcRenderer.removeAllListeners(channel),
});

// Types pour TypeScript
declare global {
  interface Window {
    electronAPI: {
      getSystemInfo: () => Promise<any>;
      getCPUInfo: () => Promise<any>;
      getGPUInfo: () => Promise<any>;
      getRAMInfo: () => Promise<any>;
      getStorageInfo: () => Promise<any>;
      getTemperatures: () => Promise<any>;
      startBenchmark: (options: any) => Promise<any>;
      stopBenchmark: () => Promise<any>;
      onBenchmarkProgress: (callback: (progress: any) => void) => void;
      startStressTest: (duration: number) => Promise<any>;
      stopStressTest: () => Promise<any>;
      onStressTestData: (callback: (data: any) => void) => void;
      generateReport: (data: any) => Promise<string>;
      uploadReport: (reportData: any) => Promise<{ success: boolean; url?: string }>;
      openExternal: (url: string) => Promise<void>;
      removeAllListeners: (channel: string) => void;
    };
  }
}
