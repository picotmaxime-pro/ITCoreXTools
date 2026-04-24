import { app, BrowserWindow, ipcMain, shell } from 'electron';
import * as path from 'path';
import { HardwareAnalyzer } from './core/hardware-analyzer';
import { BenchmarkEngine, BenchmarkProgress } from './core/benchmark-engine';
import { StressTest, StressTestData } from './core/stress-test';

// Version de développement - charge les fichiers directement sans webpack
const appTarget = process.env.APP_TARGET || 'perflab';

class ITCoreXApp {
  private mainWindow: BrowserWindow | null = null;
  private hardwareAnalyzer: HardwareAnalyzer;
  private benchmarkEngine: BenchmarkEngine;
  private stressTest: StressTest;

  constructor() {
    this.hardwareAnalyzer = new HardwareAnalyzer();
    this.benchmarkEngine = new BenchmarkEngine();
    this.stressTest = new StressTest();
  }

  async initialize(): Promise<void> {
    await app.whenReady();
    await this.createWindow();
    this.setupIPC();
    this.setupAppEvents();
  }

  private async createWindow(): Promise<void> {
    const isPerfLab = appTarget === 'perflab';
    
    this.mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      minWidth: 900,
      minHeight: 600,
      title: isPerfLab ? 'PerfLab-IT — ITCoreX' : 'DoctoLab-IT — ITCoreX',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js'),
      },
      show: false,
      backgroundColor: '#1a1612',
    });

    // Charger le fichier HTML directement depuis src/ (mode dev)
    const htmlPath = path.join(__dirname, '..', 'src', appTarget, 'index-dev.html');
    await this.mainWindow.loadFile(htmlPath);

    this.mainWindow.once('ready-to-show', () => {
      this.mainWindow?.show();
      if (process.env.NODE_ENV === 'development') {
        this.mainWindow?.webContents.openDevTools();
      }
    });
  }

  private setupIPC(): void {
    // Hardware
    ipcMain.handle('hardware:getSystemInfo', async () => {
      return await this.hardwareAnalyzer.getSystemInfo();
    });

    ipcMain.handle('hardware:getCPUInfo', async () => {
      return await this.hardwareAnalyzer.getCPUInfo();
    });

    ipcMain.handle('hardware:getGPUInfo', async () => {
      return await this.hardwareAnalyzer.getGPUInfo();
    });

    ipcMain.handle('hardware:getRAMInfo', async () => {
      return await this.hardwareAnalyzer.getRAMInfo();
    });

    ipcMain.handle('hardware:getStorageInfo', async () => {
      return await this.hardwareAnalyzer.getStorageInfo();
    });

    ipcMain.handle('hardware:getTemperatures', async () => {
      return await this.hardwareAnalyzer.getTemperatures();
    });

    // Benchmark
    ipcMain.handle('benchmark:start', async (event, options) => {
      return await this.benchmarkEngine.start(options, (progress: BenchmarkProgress) => {
        event.sender.send('benchmark:progress', progress);
      });
    });

    ipcMain.handle('benchmark:stop', async () => {
      return await this.benchmarkEngine.stop();
    });

    // Stress Test
    ipcMain.handle('stresstest:start', async (event, duration) => {
      return await this.stressTest.start(duration, (data: StressTestData) => {
        event.sender.send('stresstest:data', data);
      });
    });

    ipcMain.handle('stresstest:stop', async () => {
      return await this.stressTest.stop();
    });

    // Report
    ipcMain.handle('report:generate', async (event, data) => {
      const reportId = `rpt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      return JSON.stringify({ id: reportId, timestamp: new Date().toISOString(), app: appTarget, ...data });
    });

    ipcMain.handle('report:upload', async (event, reportData) => {
      await new Promise(resolve => setTimeout(resolve, 1500));
      return { success: true, url: `https://itcorex.fr/reports/${reportData.id}` };
    });

    ipcMain.handle('shell:openExternal', async (event, url) => {
      await shell.openExternal(url);
    });
  }

  private setupAppEvents(): void {
    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        app.quit();
      }
    });

    app.on('activate', async () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        await this.createWindow();
      }
    });
  }
}

const itcorexApp = new ITCoreXApp();
itcorexApp.initialize().catch(console.error);
