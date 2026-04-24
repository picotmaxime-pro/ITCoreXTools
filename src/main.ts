import { app, BrowserWindow, ipcMain, shell } from 'electron';
import * as path from 'path';
import { HardwareAnalyzer } from './core/hardware-analyzer';
import { BenchmarkEngine, BenchmarkProgress } from './core/benchmark-engine';
import { StressTest, StressTestData } from './core/stress-test';

// Déterminer quelle application lancer
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
      titleBarStyle: 'default',
    });

    // Charger le fichier HTML
    const htmlPath = path.join(__dirname, 'renderer', 'index.html');
    
    try {
      await this.mainWindow.loadFile(htmlPath);
    } catch (error) {
      console.error('Failed to load HTML file:', error);
      // Fallback: try to load from alternative path
      const altPath = path.join(process.resourcesPath || __dirname, 'renderer', 'index.html');
      await this.mainWindow.loadFile(altPath);
    }

    // Afficher la fenêtre une fois prête
    let hasShown = false;
    
    const showWindow = () => {
      if (!hasShown && this.mainWindow) {
        hasShown = true;
        this.mainWindow.show();
        this.mainWindow.focus();
        
        // Ouvrir DevTools en mode développement
        if (process.env.NODE_ENV === 'development') {
          this.mainWindow.webContents.openDevTools();
        }
      }
    };
    
    this.mainWindow.once('ready-to-show', showWindow);
    
    // Fallback: force show after 2 seconds if ready-to-show didn't fire
    setTimeout(() => {
      if (!hasShown) {
        console.log('Fallback: forcing window show');
        showWindow();
      }
    }, 2000);
    
    // Handle window errors
    this.mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      console.error('Window failed to load:', errorCode, errorDescription);
    });
  }

  private setupIPC(): void {
    // === Hardware Info ===
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

    // === Benchmark (PerfLab) ===
    ipcMain.handle('benchmark:start', async (event, options) => {
      return await this.benchmarkEngine.start(options, (progress: BenchmarkProgress) => {
        event.sender.send('benchmark:progress', progress);
      });
    });

    // Get real-time hardware metrics for monitoring
    ipcMain.handle('hardware:getCurrentMetrics', async () => {
      const [cpuInfo, ramInfo, temps] = await Promise.all([
        this.hardwareAnalyzer.getCPUInfo(),
        this.hardwareAnalyzer.getRAMInfo(),
        this.hardwareAnalyzer.getTemperatures(),
      ]);
      
      return {
        timestamp: Date.now(),
        cpu: {
          usage: cpuInfo.usage || 0,
          frequency: cpuInfo.speed || 0,
          temperature: temps.cpu,
        },
        gpu: {
          usage: 0, // Will be updated during GPU test
          frequency: 0,
          temperature: temps.gpu,
          memoryUsed: 0,
        },
        ram: {
          used: ramInfo.used || 0,
          total: ramInfo.total || 1,
          usagePercent: ((ramInfo.used || 0) / (ramInfo.total || 1)) * 100,
        },
      };
    });

    ipcMain.handle('benchmark:stop', async () => {
      return await this.benchmarkEngine.stop();
    });

    // === Stress Test (DoctoLab) ===
    ipcMain.handle('stresstest:start', async (event, duration) => {
      return await this.stressTest.start(duration, (data: StressTestData) => {
        event.sender.send('stresstest:data', data);
      });
    });

    ipcMain.handle('stresstest:stop', async () => {
      return await this.stressTest.stop();
    });

    // === Report Generation ===
    ipcMain.handle('report:generate', async (event, data) => {
      return await this.generateReport(data);
    });

    ipcMain.handle('report:upload', async (event, reportData) => {
      return await this.uploadReport(reportData);
    });

    // === External Links ===
    ipcMain.handle('shell:openExternal', async (event, url) => {
      await shell.openExternal(url);
    });
  }

  private async generateReport(data: any): Promise<string> {
    const reportId = `rpt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const report = {
      id: reportId,
      timestamp: new Date().toISOString(),
      app: appTarget,
      ...data,
    };
    
    // Stocker le rapport localement
    // TODO: Implémenter le stockage si nécessaire
    
    return JSON.stringify(report);
  }

  private async uploadReport(reportData: any): Promise<{ success: boolean; url?: string }> {
    try {
      // Simuler l'upload vers le serveur ITCoreX
      // En production, remplacer par un vrai appel API
      console.log('Uploading report to ITCoreX servers...');
      
      // Simuler un délai réseau
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      return {
        success: true,
        url: `https://itcorex.fr/reports/${reportData.id}`,
      };
    } catch (error) {
      console.error('Failed to upload report:', error);
      return { success: false };
    }
  }

  private setupAppEvents(): void {
    // Arrêter proprement les benchmarks avant de quitter
    app.on('before-quit', async (event) => {
      if (this.benchmarkEngine) {
        event.preventDefault();
        console.log('Stopping benchmark before quit...');
        await this.benchmarkEngine.stop();
        app.quit();
      }
    });

    app.on('window-all-closed', async () => {
      // Arrêter tous les benchmarks avant de quitter
      await this.benchmarkEngine.stop();
      
      if (process.platform !== 'darwin') {
        app.quit();
      }
    });

    app.on('activate', async () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        await this.createWindow();
      }
    });

    // Gérer la fermeture forcée (SIGTERM, SIGINT)
    process.on('SIGTERM', async () => {
      console.log('SIGTERM received, stopping benchmark...');
      await this.benchmarkEngine.stop();
      app.quit();
    });

    process.on('SIGINT', async () => {
      console.log('SIGINT received, stopping benchmark...');
      await this.benchmarkEngine.stop();
      app.quit();
    });
  }
}

// Démarrer l'application
const itcorexApp = new ITCoreXApp();
itcorexApp.initialize().catch(console.error);
