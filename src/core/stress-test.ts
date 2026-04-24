import { HardwareAnalyzer, TemperatureData } from './hardware-analyzer';
import * as os from 'os';

export interface StressTestData {
  timestamp: number;
  cpuUsage: number;
  cpuTemp: number | null;
  ramUsage: number;
  errors: string[];
  throttling: boolean;
  phase: string;
}

export interface StressTestResult {
  duration: number;
  cpuMaxTemp: number | null;
  cpuAvgTemp: number | null;
  cpuMaxUsage: number;
  ramMaxUsage: number;
  errors: string[];
  throttlingDetected: boolean;
  stabilityScore: number;
  dataPoints: StressTestData[];
}

export class StressTest {
  private isRunning: boolean = false;
  private hardwareAnalyzer: HardwareAnalyzer;
  private workers: Worker[] = [];
  private dataPoints: StressTestData[] = [];
  private errors: string[] = [];
  private maxTemps: number[] = [];
  private maxCpuUsage: number = 0;
  private maxRamUsage: number = 0;
  private throttlingDetected: boolean = false;
  private startTime: number = 0;

  constructor() {
    this.hardwareAnalyzer = new HardwareAnalyzer();
  }

  async start(
    durationSeconds: number = 300,
    onData: (data: StressTestData) => void
  ): Promise<StressTestResult> {
    if (this.isRunning) {
      throw new Error('Stress test already running');
    }

    this.isRunning = true;
    this.startTime = Date.now();
    this.dataPoints = [];
    this.errors = [];
    this.maxTemps = [];
    this.maxCpuUsage = 0;
    this.maxRamUsage = 0;
    this.throttlingDetected = false;

    // Démarrer les workers CPU
    const cores = os.cpus().length;
    this.workers = [];

    try {
      // Démarrer les workers
      for (let i = 0; i < cores; i++) {
        this.startWorker();
      }

      // Collecter les données pendant le test
      const interval = setInterval(async () => {
        if (!this.isRunning) {
          clearInterval(interval);
          return;
        }

        const elapsed = (Date.now() - this.startTime) / 1000;
        
        if (elapsed >= durationSeconds) {
          clearInterval(interval);
          return;
        }

        try {
          const data = await this.collectData(elapsed, durationSeconds);
          this.dataPoints.push(data);
          onData(data);

          // Mettre à jour les maxima
          if (data.cpuTemp !== null) {
            this.maxTemps.push(data.cpuTemp);
          }
          this.maxCpuUsage = Math.max(this.maxCpuUsage, data.cpuUsage);
          this.maxRamUsage = Math.max(this.maxRamUsage, data.ramUsage);

          // Détecter le throttling
          if (data.throttling) {
            this.throttlingDetected = true;
          }

          // Vérifier les erreurs
          if (data.errors.length > 0) {
            this.errors.push(...data.errors);
          }
        } catch (error) {
          console.error('Error collecting stress test data:', error);
        }
      }, 1000); // Collecte toutes les secondes

      // Attendre la fin du test
      await new Promise<void>((resolve) => {
        const checkInterval = setInterval(() => {
          const elapsed = (Date.now() - this.startTime) / 1000;
          if (elapsed >= durationSeconds || !this.isRunning) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 100);
      });

      return this.generateResult(durationSeconds);
    } finally {
      this.cleanup();
    }
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    this.cleanup();
  }

  private startWorker(): void {
    // Simulation de worker intensif
    // Dans une vraie implémentation, on utiliserait worker_threads
    const intensive = () => {
      while (this.isRunning) {
        this.calculateIntensive(10000);
        // Petit délai pour permettre la collecte de données
        if (!this.isRunning) break;
      }
    };

    // Lancer en async pour ne pas bloquer
    setImmediate(intensive);
  }

  private calculateIntensive(iterations: number): number {
    let result = 0;
    for (let i = 1; i <= iterations; i++) {
      result += Math.sqrt(i) * Math.sin(i) * Math.cos(i) * Math.tan(i % 10 + 1);
      // Ajouter une opération mémoire
      if (i % 1000 === 0) {
        const arr = new Array(1000).fill(result);
        result += arr.reduce((a, b) => a + b, 0) / 1000000;
      }
    }
    return result;
  }

  private async collectData(elapsed: number, totalDuration: number): Promise<StressTestData> {
    const [temps, cpuInfo, ramInfo] = await Promise.all([
      this.hardwareAnalyzer.getTemperatures(),
      this.hardwareAnalyzer.getCPUInfo(),
      this.hardwareAnalyzer.getRAMInfo(),
    ]);

    // Déterminer la phase
    let phase = 'warmup';
    const progress = elapsed / totalDuration;
    if (progress < 0.1) {
      phase = 'warmup';
    } else if (progress < 0.9) {
      phase = 'sustained';
    } else {
      phase = 'cooldown';
    }

    // Calculer l'usage RAM
    const ramUsage = (ramInfo.used / ramInfo.total) * 100;

    // Détecter le throttling
    let throttling = false;
    if (temps.cpu !== null && temps.cpu > 85) {
      throttling = true;
      if (!this.throttlingDetected) {
        this.errors.push(`CPU thermal throttling detected at ${temps.cpu}°C`);
      }
    }

    // Vérifier les erreurs
    const errors: string[] = [];
    if (temps.cpu !== null && temps.cpu > 95) {
      errors.push(`Critical CPU temperature: ${temps.cpu}°C`);
    }

    return {
      timestamp: Date.now(),
      cpuUsage: cpuInfo.usage || 0,
      cpuTemp: temps.cpu,
      ramUsage,
      errors,
      throttling,
      phase,
    };
  }

  private generateResult(duration: number): StressTestResult {
    const validTemps = this.maxTemps.filter(t => t !== null) as number[];
    
    const avgTemp = validTemps.length > 0
      ? validTemps.reduce((a, b) => a + b, 0) / validTemps.length
      : null;
    
    const maxTemp = validTemps.length > 0
      ? Math.max(...validTemps)
      : null;

    // Calculer le score de stabilité
    let stabilityScore = 100;
    
    // Pénalités
    if (this.throttlingDetected) stabilityScore -= 20;
    if (this.errors.length > 0) stabilityScore -= this.errors.length * 10;
    if (maxTemp !== null && maxTemp > 90) stabilityScore -= 15;
    if (maxTemp !== null && maxTemp > 80) stabilityScore -= 10;
    
    stabilityScore = Math.max(0, Math.min(100, stabilityScore));

    return {
      duration: Math.min((Date.now() - this.startTime) / 1000, duration),
      cpuMaxTemp: maxTemp,
      cpuAvgTemp: avgTemp,
      cpuMaxUsage: this.maxCpuUsage,
      ramMaxUsage: this.maxRamUsage,
      errors: [...new Set(this.errors)], // Dédupliquer
      throttlingDetected: this.throttlingDetected,
      stabilityScore,
      dataPoints: this.dataPoints,
    };
  }

  private cleanup(): void {
    this.isRunning = false;
    this.workers = [];
  }
}
