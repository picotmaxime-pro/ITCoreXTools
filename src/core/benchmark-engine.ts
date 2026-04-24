import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import { HardwareAnalyzer } from './hardware-analyzer';
import { AdaptiveCPUBenchmark } from './adaptive-cpu-benchmark';
import { BottleneckDetector, BottleneckAnalysis } from './bottleneck-detector';
import { GPUWebGLBenchmark, WebGLBenchmarkResult } from './gpu-webgl-benchmark';

export type BenchmarkDuration = 5 | 15 | 30; // minutes

export interface BenchmarkOptions {
  cpu: boolean;
  gpu: boolean;
  ram: boolean;
  storage: boolean;
  duration: BenchmarkDuration;
  runCombinedTest: boolean; // CPU+GPU+RAM simultané
  runStorageTest: boolean; // Test stockage séparé
}

export interface RealTimeMetrics {
  timestamp: number;
  cpu: {
    usage: number;
    frequency: number;
    temperature: number | null;
  };
  gpu: {
    usage: number;
    frequency: number;
    temperature: number | null;
    memoryUsed: number;
  };
  ram: {
    used: number;
    total: number;
    usagePercent: number;
  };
}

export interface BenchmarkProgress {
  phase: string;
  progress: number;
  currentTest: string;
  eta: number; // secondes restantes
  elapsed: number; // secondes écoulées
  totalDuration: number; // durée totale en secondes
  metrics?: RealTimeMetrics; // métriques temps réel
}

export interface GPUBenchmarkDetails {
  computeScore: number;
  memoryBandwidth: number;
  testDuration: number;
  averageUsage: number;
  peakUsage: number;
  webglResult?: WebGLBenchmarkResult; // Données WebGL si disponibles
}

export interface BenchmarkResult {
  timestamp: string;
  duration: number; // durée réelle en secondes
  overallScore: number;
  combinedScore: number; // Score du test combiné CPU+GPU+RAM
  cpuScore: number;
  gpuScore: number;
  ramScore: number;
  storageScore: number; // Score indépendant (0 si non testé)
  details: {
    cpu: CPUBenchmarkDetails;
    gpu: GPUBenchmarkDetails;
    ram: RAMBenchmarkDetails;
    storage?: StorageBenchmarkDetails; // Optionnel
    combinedTest?: CombinedTestDetails;
  };
  metrics: {
    averageTemps: {
      cpu: number | null;
      gpu: number | null;
    };
    peakTemps: {
      cpu: number | null;
      gpu: number | null;
    };
  };
  bottleneckAnalysis?: BottleneckAnalysis;
}

interface CombinedTestDetails {
  duration: number;
  cpuAverageUsage: number;
  gpuAverageUsage: number;
  ramAverageUsage: number;
  stabilityScore: number;
  bottleneckAnalysis?: BottleneckAnalysis;
  realCPUDetails?: { singleCore: number; multiCore: number; instructionsPerSecond: number };
}

interface CPUBenchmarkDetails {
  singleCore: number;
  multiCore: number;
  instructionsPerSecond: number;
}

interface RAMBenchmarkDetails {
  readSpeed: number;
  writeSpeed: number;
  latency: number;
}

interface StorageBenchmarkDetails {
  readSpeed: number; // MB/s
  writeSpeed: number; // MB/s
  iops: number;
  accessTime: number; // ms
  testFileSize: number; // MB
}

export class BenchmarkEngine {
  private isRunning: boolean = false;
  private hardwareAnalyzer: HardwareAnalyzer;
  private adaptiveCPUBenchmark: AdaptiveCPUBenchmark;
  private bottleneckDetector: BottleneckDetector;
  private gpuComputeContext: any = null;
  private metricsHistory: RealTimeMetrics[] = [];
  private cpuWorkers: Promise<void>[] = [];

  constructor() {
    this.hardwareAnalyzer = new HardwareAnalyzer();
    this.adaptiveCPUBenchmark = new AdaptiveCPUBenchmark();
    this.bottleneckDetector = new BottleneckDetector();
  }

  // Durées en secondes selon l'option choisie
  private getCombinedTestDuration(duration: BenchmarkDuration): number {
    // 3min30 pour le test combiné (CPU+GPU+RAM)
    return 210 * (duration / 5); // 210s = 3m30s pour 5min, ×3 pour 15min, ×6 pour 30min
  }

  private getStorageTestDuration(duration: BenchmarkDuration): number {
    // 1min30 pour le test stockage
    return 90 * (duration / 5); // 90s = 1m30s
  }

  private getTotalDuration(duration: BenchmarkDuration): number {
    // 5min total (210s + 90s)
    return 300 * (duration / 5);
  }

  // Collecte des métriques en temps réel
  private async collectMetrics(): Promise<RealTimeMetrics> {
    const [cpuInfo, gpuInfo, ramInfo] = await Promise.all([
      this.hardwareAnalyzer.getCPUInfo(),
      this.hardwareAnalyzer.getGPUInfo(),
      this.hardwareAnalyzer.getRAMInfo(),
    ]);

    const temps = await this.hardwareAnalyzer.getTemperatures();

    return {
      timestamp: Date.now(),
      cpu: {
        usage: cpuInfo.usage || 0,
        frequency: cpuInfo.speed || 0,
        temperature: temps.cpu,
      },
      gpu: {
        usage: 0, // Sera mis à jour pendant le test GPU
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
  }

  async start(
    options: BenchmarkOptions,
    onProgress: (progress: BenchmarkProgress) => void
  ): Promise<BenchmarkResult> {
    if (this.isRunning) {
      throw new Error('Benchmark already running');
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      const result: BenchmarkResult = {
        timestamp: new Date().toISOString(),
        duration: 0,
        overallScore: 0,
        combinedScore: 0,
        cpuScore: 0,
        gpuScore: 0,
        ramScore: 0,
        storageScore: 0,
        details: {
          cpu: { singleCore: 0, multiCore: 0, instructionsPerSecond: 0 },
          gpu: { computeScore: 0, memoryBandwidth: 0, testDuration: 0, averageUsage: 0, peakUsage: 0 },
          ram: { readSpeed: 0, writeSpeed: 0, latency: 0 },
          storage: { readSpeed: 0, writeSpeed: 0, iops: 0, accessTime: 0, testFileSize: 0 },
        },
        metrics: {
          averageTemps: { cpu: null, gpu: null },
          peakTemps: { cpu: null, gpu: null },
        },
      };

      const combinedDuration = this.getCombinedTestDuration(options.duration);
      const storageDuration = this.getStorageTestDuration(options.duration);
      const totalDuration = this.getTotalDuration(options.duration);
      let elapsedTime = 0;

      // === TEST COMBINÉ CPU+GPU+RAM (3min30 base) ===
      if (options.runCombinedTest && (options.cpu || options.gpu || options.ram) && this.isRunning) {
        onProgress({
          phase: 'combined',
          progress: 0,
          currentTest: 'Test intensif CPU+GPU+RAM en cours...',
          eta: combinedDuration,
          elapsed: 0,
          totalDuration: combinedDuration,
        });

        const combinedResult = await this.runCombinedIntensiveTest(
          combinedDuration,
          options,
          (progress, metrics, elapsed) => {
            elapsedTime = elapsed;
            onProgress({
              phase: 'combined',
              progress: Math.round((elapsed / combinedDuration) * 100),
              currentTest: `Test intensif - Temps restant: ${this.formatTime(combinedDuration - elapsed)}`,
              eta: combinedDuration - elapsed,
              elapsed: elapsed,
              totalDuration: combinedDuration,
              metrics: metrics,
            });
          }
        );

        result.details.combinedTest = combinedResult;
        result.combinedScore = this.calculateCombinedScore(combinedResult);
        
        // Calcul des scores individuels basés sur le test combiné
        if (options.cpu) {
          result.details.cpu = this.extractCPUDetails(combinedResult);
          result.cpuScore = this.calculateCPUScore(result.details.cpu);
        }
        if (options.gpu) {
          result.details.gpu = this.extractGPUDetails(combinedResult);
          result.gpuScore = this.calculateGPUScore(result.details.gpu);
        }
        if (options.ram) {
          result.details.ram = this.extractRAMDetails(combinedResult);
          result.ramScore = this.calculateRAMScore(result.details.ram);
        }
      } else {
        // Tests individuels si pas de test combiné
        if (options.cpu && this.isRunning) {
          result.details.cpu = await this.runIntensiveCPUBenchmark(onProgress);
          result.cpuScore = this.calculateCPUScore(result.details.cpu);
        }

        if (options.gpu && this.isRunning) {
          result.details.gpu = await this.runGPUBenchmark(onProgress);
          result.gpuScore = this.calculateGPUScore(result.details.gpu);
        }

        if (options.ram && this.isRunning) {
          result.details.ram = await this.runIntensiveRAMBenchmark(onProgress);
          result.ramScore = this.calculateRAMScore(result.details.ram);
        }
      }

      // === TEST STOCKAGE SÉPARÉ (1min30 base) ===
      if (options.runStorageTest && options.storage && this.isRunning) {
        onProgress({
          phase: 'storage',
          progress: 0,
          currentTest: 'Test stockage (débit séquentiel)...',
          eta: storageDuration,
          elapsed: 0,
          totalDuration: storageDuration,
        });

        const storageResult = await this.runIntensiveStorageBenchmark(
          storageDuration,
          (progress, elapsed) => {
            onProgress({
              phase: 'storage',
              progress: Math.round((elapsed / storageDuration) * 100),
              currentTest: `Test stockage - Temps restant: ${this.formatTime(storageDuration - elapsed)}`,
              eta: storageDuration - elapsed,
              elapsed: elapsed,
              totalDuration: storageDuration,
            });
          }
        );

        result.details.storage = storageResult;
        result.storageScore = this.calculateStorageScore(storageResult);
      } else {
        result.storageScore = 0;
      }

      // Calcul du score global (sans le stockage)
      const scores = [result.cpuScore, result.gpuScore, result.ramScore].filter(s => s > 0);
      result.overallScore = scores.length > 0 
        ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
        : 0;

      onProgress({
        phase: 'complete',
        progress: 100,
        currentTest: 'Benchmark terminé',
        eta: 0,
        elapsed: totalDuration,
        totalDuration: totalDuration,
      });

      return result;
    } finally {
      this.isRunning = false;
    }
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    
    // Arrêter le benchmark CPU adaptatif
    try {
      await this.adaptiveCPUBenchmark.stop();
    } catch (e) {
      // Ignore errors during stop
    }
    
    // Attendre que tous les workers se terminent
    if (this.cpuWorkers.length > 0) {
      await Promise.all(this.cpuWorkers.map(w => w.catch(() => {})));
      this.cpuWorkers = [];
    }
    
    // Forcer garbage collection si disponible
    if (global.gc) {
      global.gc();
    }
  }

  private async runCPUBenchmark(
    onProgress: (progress: BenchmarkProgress) => void
  ): Promise<CPUBenchmarkDetails> {
    const cpuInfo = await this.hardwareAnalyzer.getCPUInfo();
    const cores = cpuInfo.physicalCores || os.cpus().length;
    
    // Test Single Core
    onProgress({
      phase: 'cpu',
      progress: 5,
      currentTest: 'Test single-core...',
      eta: 10,
      elapsed: 5,
      totalDuration: 60,
    });
    
    const singleCoreStart = Date.now();
    let singleCoreOps = 0;
    const singleCoreDuration = 2000; // 2 secondes
    
    while (Date.now() - singleCoreStart < singleCoreDuration && this.isRunning) {
      // Calcul intensif: factorielles
      this.calculateIntensive(1000);
      singleCoreOps++;
    }
    
    const singleCoreTime = Date.now() - singleCoreStart;
    const singleCore = Math.round((singleCoreOps / singleCoreTime) * 1000);

    // Test Multi Core
    onProgress({
      phase: 'cpu',
      progress: 15,
      currentTest: 'Test multi-core...',
      eta: 10,
      elapsed: 15,
      totalDuration: 60,
    });

    const multiCoreStart = Date.now();
    const promises: Promise<number>[] = [];
    
    for (let i = 0; i < cores && this.isRunning; i++) {
      promises.push(this.runWorkerTest(1000));
    }
    
    const multiCoreResults = await Promise.all(promises);
    const multiCoreOps = multiCoreResults.reduce((a, b) => a + b, 0);
    const multiCoreTime = Date.now() - multiCoreStart;
    const multiCore = Math.round((multiCoreOps / multiCoreTime) * 1000);

    onProgress({
      phase: 'cpu',
      progress: 24,
      currentTest: 'Finalisation CPU...',
      eta: 5,
      elapsed: 25,
      totalDuration: 60,
    });

    return {
      singleCore,
      multiCore,
      instructionsPerSecond: multiCore,
    };
  }

  private runWorkerTest(duration: number): Promise<number> {
    return new Promise((resolve) => {
      let ops = 0;
      const start = Date.now();
      
      while (Date.now() - start < duration) {
        this.calculateIntensive(100);
        ops++;
      }
      
      resolve(ops);
    });
  }

  private calculateIntensive(iterations: number): number {
    let result = 0;
    for (let i = 1; i <= iterations; i++) {
      result += Math.sqrt(i) * Math.sin(i) * Math.cos(i);
    }
    return result;
  }

  private async runRAMBenchmark(
    onProgress: (progress: BenchmarkProgress) => void
  ): Promise<RAMBenchmarkDetails> {
    onProgress({
      phase: 'ram',
      progress: 30,
      currentTest: 'Test lecture RAM...',
      eta: 10,
      elapsed: 30,
      totalDuration: 60,
    });

    // Test de lecture
    const readStart = Date.now();
    const testArray = new Array(1000000).fill(0).map((_, i) => i);
    let readSum = 0;
    
    for (let i = 0; i < testArray.length && this.isRunning; i++) {
      readSum += testArray[i];
    }
    
    const readTime = Date.now() - readStart;
    const readSpeed = Math.round((testArray.length / readTime) * 1000 / 1024 / 1024); // MB/s

    onProgress({
      phase: 'ram',
      progress: 40,
      currentTest: 'Test écriture RAM...',
      eta: 10,
      elapsed: 40,
      totalDuration: 60,
    });

    // Test d'écriture
    const writeStart = Date.now();
    const writeArray: number[] = [];
    
    for (let i = 0; i < 1000000 && this.isRunning; i++) {
      writeArray.push(i);
    }
    
    const writeTime = Date.now() - writeStart;
    const writeSpeed = Math.round((writeArray.length / writeTime) * 1000 / 1024 / 1024); // MB/s

    onProgress({
      phase: 'ram',
      progress: 49,
      currentTest: 'Test latence...',
      eta: 5,
      elapsed: 49,
      totalDuration: 60,
    });

    // Test de latence (simplifié)
    const latencyStart = Date.now();
    const latencyTests = 10000;
    let latencySum = 0;
    
    for (let i = 0; i < latencyTests && this.isRunning; i++) {
      const itemStart = Date.now();
      const _ = testArray[i % testArray.length];
      latencySum += Date.now() - itemStart;
    }
    
    const latency = Math.round(latencySum / latencyTests * 1000); // nanosecondes

    return {
      readSpeed,
      writeSpeed,
      latency,
    };
  }

  private async runStorageBenchmark(
    onProgress: (progress: BenchmarkProgress) => void
  ): Promise<StorageBenchmarkDetails> {
    onProgress({
      phase: 'storage',
      progress: 55,
      currentTest: 'Analyse disques...',
      eta: 10,
      elapsed: 55,
      totalDuration: 100,
    });

    // On ne peut pas vraiment tester le stockage sans écrire sur le disque
    // Ce serait dangereux - donc on simule basé sur les specs du disque
    const storageInfo = await this.hardwareAnalyzer.getStorageInfo();
    
    let estimatedReadSpeed = 0;
    let estimatedWriteSpeed = 0;
    
    if (storageInfo.disks.length > 0) {
      const mainDisk = storageInfo.disks[0];
      
      if (mainDisk.type === 'SSD') {
        // Estimation SSD
        estimatedReadSpeed = 500 + Math.random() * 2000; // 500-2500 MB/s
        estimatedWriteSpeed = 400 + Math.random() * 1500; // 400-1900 MB/s
      } else {
        // Estimation HDD
        estimatedReadSpeed = 80 + Math.random() * 120; // 80-200 MB/s
        estimatedWriteSpeed = 60 + Math.random() * 100; // 60-160 MB/s
      }
    }

    onProgress({
      phase: 'storage',
      progress: 70,
      currentTest: 'Test performances...',
      eta: 5,
      elapsed: 70,
      totalDuration: 100,
    });

    // Simuler un petit délai de test
    await new Promise(resolve => setTimeout(resolve, 1000));

    onProgress({
      phase: 'storage',
      progress: 74,
      currentTest: 'Finalisation...',
      eta: 2,
      elapsed: 74,
      totalDuration: 100,
    });

    return {
      readSpeed: Math.round(estimatedReadSpeed),
      writeSpeed: Math.round(estimatedWriteSpeed),
      iops: Math.round(estimatedReadSpeed * 10), // IOPS approximatif
      accessTime: 10, // Simulated
      testFileSize: 100, // Simulated 100MB
    };
  }

  private calculateCPUScore(details: CPUBenchmarkDetails): number {
    // Formule arbitraire pour le scoring
    const singleCoreWeight = 0.4;
    const multiCoreWeight = 0.6;
    
    // Normalisation: CPU modernes peuvent faire 5-50M ops/s
    // i5-3470 ~ 5M | M1 ~ 35M | i9 récent ~ 50M+
    const normalizedSingle = Math.min(details.singleCore / 500000, 100);  // 5M ops/s = score 100
    const normalizedMulti = Math.min(details.multiCore / 5000000, 100);   // 50M ops/s = score 100
    
    return Math.round((normalizedSingle * singleCoreWeight + normalizedMulti * multiCoreWeight) * 100);
  }

  private calculateRAMScore(details: RAMBenchmarkDetails): number {
    const readWeight = 0.4;
    const writeWeight = 0.4;
    const latencyWeight = 0.2;
    
    const normalizedRead = Math.min(details.readSpeed / 50, 100); // 50 GB/s max
    const normalizedWrite = Math.min(details.writeSpeed / 50, 100);
    const normalizedLatency = Math.max(0, 100 - details.latency / 10); // Lower is better
    
    return Math.round(
      (normalizedRead * readWeight + normalizedWrite * writeWeight + normalizedLatency * latencyWeight) * 100
    );
  }

  private calculateStorageScore(details: StorageBenchmarkDetails): number {
    const readWeight = 0.5;
    const writeWeight = 0.5;
    
    const normalizedRead = Math.min(details.readSpeed / 3000, 100); // 3 GB/s max
    const normalizedWrite = Math.min(details.writeSpeed / 2500, 100); // 2.5 GB/s max
    
    return Math.round((normalizedRead * readWeight + normalizedWrite * writeWeight) * 100);
  }

  private calculateGPUScore(details: GPUBenchmarkDetails): number {
    const computeWeight = 0.6;
    const memoryWeight = 0.4;
    
    const normalizedCompute = Math.min(details.computeScore / 10000, 100);
    const normalizedMemory = Math.min(details.memoryBandwidth / 500, 100); // 500 GB/s max
    
    return Math.round((normalizedCompute * computeWeight + normalizedMemory * memoryWeight) * 100);
  }

  private calculateCombinedScore(details: CombinedTestDetails): number {
    // Score basé sur la stabilité et l'utilisation moyenne
    const stabilityWeight = 0.4;
    const usageWeight = 0.6;
    
    const avgUsage = (details.cpuAverageUsage + details.gpuAverageUsage + details.ramAverageUsage) / 3;
    
    return Math.round(details.stabilityScore * stabilityWeight + avgUsage * usageWeight);
  }

  private formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  // === TEST COMBINÉ INTENSIF CPU+GPU+RAM ===
  private async runCombinedIntensiveTest(
    duration: number,
    options: BenchmarkOptions,
    onProgress: (progress: number, metrics: RealTimeMetrics, elapsed: number) => void
  ): Promise<CombinedTestDetails & { bottleneckAnalysis?: BottleneckAnalysis; realCPUDetails?: { singleCore: number; multiCore: number; instructionsPerSecond: number } }> {
    const startTime = Date.now();
    const metricsHistory: RealTimeMetrics[] = [];
    
    // Réinitialiser le détecteur de bottleneck
    this.bottleneckDetector.reset();
    
    // Compteurs d'opérations réels
    let cpuOperations = 0;
    let gpuOperations = 0;
    
    // Lancer tous les workers en parallèle
    this.cpuWorkers = [];
    
    // Worker CPU intensif avec comptage d'opérations
    if (options.cpu) {
      const cpuWorker = this.runIntensiveCPUWorkerWithCount(duration, (ops) => { cpuOperations += ops; });
      this.cpuWorkers.push(cpuWorker);
    }
    
    // Worker GPU intensif avec comptage
    if (options.gpu) {
      const gpuWorker = this.runIntensiveGPUWorkerWithCount(duration, (ops) => { gpuOperations += ops; });
      this.cpuWorkers.push(gpuWorker);
    }
    
    // Worker RAM intensif
    if (options.ram) {
      const ramWorker = this.runIntensiveRAMWorker(duration);
      this.cpuWorkers.push(ramWorker);
    }
    
    // Boucle de monitoring avec bottleneck detection
    const monitorInterval = setInterval(async () => {
      if (!this.isRunning) {
        clearInterval(monitorInterval);
        return;
      }
      
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      if (elapsed >= duration) {
        clearInterval(monitorInterval);
        return;
      }
      
      const metrics = await this.collectMetrics();
      metricsHistory.push(metrics);
      
      // Ajouter au détecteur de bottleneck
      this.bottleneckDetector.addMetric({
        timestamp: Date.now(),
        cpuUsage: metrics.cpu.usage,
        gpuUsage: metrics.gpu.usage,
        cpuFrequency: metrics.cpu.frequency,
        gpuFrequency: null, // À implémenter
        cpuTemperature: metrics.cpu.temperature,
        gpuTemperature: metrics.gpu.temperature,
        fps: 0, // Pas de FPS en mode compute
        frameTime: 0,
      });
      
      onProgress((elapsed / duration) * 100, metrics, elapsed);
    }, 1000);
    
    // Attendre la fin de tous les workers
    await Promise.all(this.cpuWorkers);
    this.cpuWorkers = [];
    clearInterval(monitorInterval);
    
    // Calculer les moyennes
    const avgCpu = metricsHistory.length > 0
      ? metricsHistory.reduce((sum, m) => sum + m.cpu.usage, 0) / metricsHistory.length
      : 0;
    const avgGpu = metricsHistory.length > 0
      ? metricsHistory.reduce((sum, m) => sum + m.gpu.usage, 0) / metricsHistory.length
      : 0;
    const avgRam = metricsHistory.reduce((sum, m) => sum + m.ram.usagePercent, 0) / metricsHistory.length;
    
    // Score de stabilité (100 si stable, moins si variations importantes)
    const stabilityScore = this.calculateStabilityScore(metricsHistory);
    
    // Analyse des bottlenecks
    const bottleneckAnalysis = this.bottleneckDetector.analyze();
    
    // Calculer les vraies performances CPU (ops/s)
    const actualDuration = (Date.now() - startTime) / 1000;
    const cores = os.cpus().length;
    const singleCore = actualDuration > 0 ? Math.round(cpuOperations / actualDuration / cores) : 0;
    const multiCore = actualDuration > 0 ? Math.round(cpuOperations / actualDuration) : 0;
    
    return {
      duration: Math.floor(actualDuration),
      cpuAverageUsage: Math.round(avgCpu),
      gpuAverageUsage: Math.round(avgGpu),
      ramAverageUsage: Math.round(avgRam),
      stabilityScore,
      bottleneckAnalysis,
      realCPUDetails: {
        singleCore,
        multiCore,
        instructionsPerSecond: multiCore,
      },
    };
  }

  private calculateStabilityScore(metrics: RealTimeMetrics[]): number {
    if (metrics.length < 2) return 100;
    
    // Calculer la variance des températures et utilisations
    const cpuUsages = metrics.map(m => m.cpu.usage);
    const avgCpu = cpuUsages.reduce((a, b) => a + b, 0) / cpuUsages.length;
    const variance = cpuUsages.reduce((sum, u) => sum + Math.pow(u - avgCpu, 2), 0) / cpuUsages.length;
    
    // Score élevé = faible variance (stable)
    const stability = Math.max(0, 100 - Math.sqrt(variance) * 2);
    return Math.round(stability);
  }

  private async runIntensiveCPUWorker(duration: number): Promise<void> {
    const startTime = Date.now();
    const cores = os.cpus().length;
    
    // Créer un worker par cœur pour 100% d'utilisation
    const workers: Promise<void>[] = [];
    
    for (let c = 0; c < cores; c++) {
      workers.push(new Promise(async (resolve) => {
        const workerStart = Date.now();
        let iterations = 0;
        while (Date.now() - workerStart < duration * 1000 && this.isRunning) {
          // Calcul intensif par batch
          this.runIntensiveMathOperations(5000);
          iterations++;
          
          // Yield every 100 iterations to prevent blocking the event loop completely
          if (iterations % 100 === 0) {
            await new Promise(r => setImmediate(r));
          }
        }
        resolve();
      }));
    }
    
    await Promise.all(workers);
  }

  private runIntensiveMathOperations(iterations: number): number {
    let result = 0;
    // Calculs matriciels simulés pour maximiser l'utilisation CPU
    for (let i = 0; i < iterations; i++) {
      const angle = i * 0.01;
      result += Math.sin(angle) * Math.cos(angle * 1.5) * Math.tan(angle * 0.5);
      result += Math.sqrt(i + 1) * Math.log(i + 2);
      result += Math.pow(i % 100, 2) / 1000;
    }
    return result;
  }

  private async runIntensiveGPUWorker(duration: number): Promise<void> {
    // Simulation de calculs GPU intensifs via JavaScript
    // En production, cela utiliserait WebGL ou WebGPU
    const startTime = Date.now();
    const bufferSize = 1000000; // 1M éléments
    
    while (Date.now() - startTime < duration * 1000 && this.isRunning) {
      // Simuler des calculs vectoriels (comme un shader)
      const buffer = new Float32Array(bufferSize);
      for (let i = 0; i < bufferSize; i++) {
        buffer[i] = Math.sin(i * 0.001) * Math.cos(i * 0.002);
      }
      
      // Transformations matricielles
      for (let i = 0; i < bufferSize; i++) {
        buffer[i] = buffer[i] * 1.5 + Math.sqrt(Math.abs(buffer[i]));
      }
      
      // Pause très courte pour permettre les mises à jour UI
      await new Promise(resolve => setTimeout(resolve, 1));
    }
  }

  private async runIntensiveRAMWorker(duration: number): Promise<void> {
    const startTime = Date.now();
    const blockSize = 50 * 1024 * 1024; // 50 MB par bloc
    const maxBlocks = 10; // Maximum 500 MB alloués
    const memoryBlocks: Buffer[] = [];
    let operationCount = 0;
    
    while (Date.now() - startTime < duration * 1000 && this.isRunning) {
      // Allouer de la mémoire
      if (memoryBlocks.length < maxBlocks) {
        const block = Buffer.alloc(blockSize);
        // Écrire des données aléatoires (par chunk pour éviter le blocage)
        for (let i = 0; i < blockSize; i += 4096) {
          block[i] = Math.floor(Math.random() * 256);
        }
        memoryBlocks.push(block);
      }
      
      // Lire/écrire aléatoirement dans tous les blocs (limité pour ne pas bloquer)
      for (const block of memoryBlocks) {
        for (let i = 0; i < 100; i++) {
          const index = Math.floor(Math.random() * blockSize);
          block[index] = (block[index] + 1) % 256;
        }
      }
      operationCount++;
      
      // Libérer de la mémoire périodiquement
      if (memoryBlocks.length >= maxBlocks && Math.random() > 0.7) {
        memoryBlocks.shift();
      }
      
      // Yield more frequently to keep UI responsive
      if (operationCount % 10 === 0) {
        await new Promise(resolve => setImmediate(resolve));
      }
    }
    
    // Nettoyage
    memoryBlocks.length = 0;
  }

  // === WORKERS AVEC COMPTAGE D'OPÉRATIONS ===
  private async runIntensiveCPUWorkerWithCount(
    duration: number, 
    onProgress: (ops: number) => void
  ): Promise<void> {
    const cores = os.cpus().length;
    const targetDuration = duration * 1000;
    
    // Fonction de calcul intensive synchrone
    const doIntensiveCalculations = (iterations: number): number => {
      let result = 0;
      for (let i = 0; i < iterations; i++) {
        const angle = i * 0.001;
        result += Math.sin(angle) * Math.cos(angle * 1.5);
        result += Math.sqrt(i + 1) * Math.log(i + 2);
        result += Math.pow(i % 100, 2) * 0.001;
      }
      // Anti-optimization: always return a value that depends on calculation
      return result > 0 ? result : 1;
    };
    
    // Créer des workers qui tournent en parallèle avec exécution synchrone
    const workers: Promise<number>[] = [];
    
    for (let c = 0; c < cores; c++) {
      workers.push(
        new Promise((resolve) => {
          let totalOps = 0;
          const batchSize = 1000000; // 1M opérations par batch
          
          // Utiliser process.nextTick ou setImmediate pour ne pas bloquer l'event loop principale
          const workLoop = () => {
            const loopStart = Date.now();
            
            // Faire autant de batches que possible dans un time slice
            while (Date.now() - loopStart < 100 && this.isRunning) {
              doIntensiveCalculations(batchSize);
              totalOps += batchSize;
            }
            
            // Continuer si on n'a pas dépassé la durée
            if (this.isRunning && totalOps < (targetDuration / cores) * 10000) {
              // Yield pour permettre aux autres workers de tourner
              if (typeof setImmediate !== 'undefined') {
                setImmediate(workLoop);
              } else {
                setTimeout(workLoop, 0);
              }
            } else {
              resolve(totalOps);
            }
          };
          
          workLoop();
        })
      );
    }
    
    // Collecter les résultats avec reporting périodique
    let totalOps = 0;
    const reportInterval = setInterval(() => {
      onProgress(totalOps);
      totalOps = 0;
    }, 1000);
    
    const results = await Promise.all(workers);
    clearInterval(reportInterval);
    
    // Final count
    totalOps += results.reduce((a, b) => a + b, 0);
    onProgress(totalOps);
  }

  private async runIntensiveGPUWorkerWithCount(
    duration: number,
    onProgress: (ops: number) => void
  ): Promise<void> {
    const startTime = Date.now();
    const bufferSize = 1000000;
    let totalOps = 0;
    
    while (Date.now() - startTime < duration * 1000 && this.isRunning) {
      const buffer = new Float32Array(bufferSize);
      for (let i = 0; i < bufferSize; i++) {
        buffer[i] = Math.sin(i * 0.001) * Math.cos(i * 0.002);
      }
      
      for (let i = 0; i < bufferSize; i++) {
        buffer[i] = buffer[i] * 1.5 + Math.sqrt(Math.abs(buffer[i]));
      }
      
      totalOps += bufferSize * 2;
      
      if (totalOps % 10000000 === 0) {
        onProgress(totalOps);
        totalOps = 0;
      }
      
      await new Promise(resolve => setTimeout(resolve, 1));
    }
    
    onProgress(totalOps);
  }

  // === TEST STOCKAGE INTENSIF (test réel avec écriture/lecture) ===
  private async runIntensiveStorageBenchmark(
    duration: number,
    onProgress: (progress: number, elapsed: number) => void
  ): Promise<StorageBenchmarkDetails> {
    const tempDir = os.tmpdir();
    const testFile = path.join(tempDir, `perflab_test_${Date.now()}.tmp`);
    const chunkSize = 1024 * 1024; // 1 MB chunks
    
    const startTime = Date.now();
    let elapsed = 0;
    
    let totalWritten = 0;
    let totalRead = 0;
    let totalWriteTime = 0;
    let totalReadTime = 0;
    
    // Boucle principale: écriture/lecture pendant toute la durée
    while (this.isRunning) {
      elapsed = Math.floor((Date.now() - startTime) / 1000);
      if (elapsed >= duration) break;
      
      // Phase écriture (~40% du temps)
      const writeStart = Date.now();
      const writeBuffer = Buffer.alloc(chunkSize);
      const writeStream = fs.createWriteStream(testFile, { flags: 'a' });
      
      // Écrire 10MB par cycle
      for (let w = 0; w < 10 && this.isRunning && elapsed < duration; w++) {
        // Remplir buffer aléatoire
        for (let i = 0; i < writeBuffer.length; i++) {
          writeBuffer[i] = Math.floor(Math.random() * 256);
        }
        
        if (!writeStream.write(writeBuffer)) {
          await new Promise<void>(resolve => writeStream.once('drain', () => resolve()));
        }
        totalWritten += writeBuffer.length;
        
        elapsed = Math.floor((Date.now() - startTime) / 1000);
        onProgress(Math.min((elapsed / duration) * 100, 99), elapsed);
      }
      
      writeStream.end();
      await new Promise<void>(resolve => writeStream.once('finish', () => resolve()));
      totalWriteTime += Date.now() - writeStart;
      
      // Phase lecture (~40% du temps)
      if (fs.existsSync(testFile) && this.isRunning && elapsed < duration) {
        const readStart = Date.now();
        const readStream = fs.createReadStream(testFile, { highWaterMark: chunkSize });
        
        for await (const chunk of readStream) {
          totalRead += chunk.length;
          // Simuler traitement
          for (let i = 0; i < chunk.length; i += 1024) {
            const _ = chunk[i];
          }
          
          elapsed = Math.floor((Date.now() - startTime) / 1000);
          if (elapsed >= duration) break;
          onProgress(Math.min((elapsed / duration) * 100, 99), elapsed);
        }
        
        totalReadTime += Date.now() - readStart;
      }
      
      // Nettoyer le fichier si trop gros (>500MB)
      try {
        const stats = fs.statSync(testFile);
        if (stats.size > 500 * 1024 * 1024) {
          fs.unlinkSync(testFile);
          totalWritten = 0;
        }
      } catch (e) {
        // Ignore errors
      }
    }
    
    // Calculer vitesses moyennes
    const writeSpeed = totalWriteTime > 0 
      ? Math.round((totalWritten / totalWriteTime) * 1000 / 1024 / 1024) 
      : 0;
    const readSpeed = totalReadTime > 0 
      ? Math.round((totalRead / totalReadTime) * 1000 / 1024 / 1024) 
      : 0;
    
    // Test IOPS rapide à la fin (utilise le fichier existant)
    let iops = 0;
    let accessTime = 0;
    
    try {
      const stats = fs.statSync(testFile);
      const fileSizeForIops = stats.size;
      
      const accessStart = Date.now();
      const fd = fs.openSync(testFile, 'r');
      const randomAccessCount = 1000;
      const blockSize = 4096; // 4 KB
      
      for (let i = 0; i < randomAccessCount && this.isRunning; i++) {
        const position = Math.floor(Math.random() * Math.max(fileSizeForIops - blockSize, 1));
        const buffer = Buffer.alloc(blockSize);
        fs.readSync(fd, buffer, 0, blockSize, position);
      }
      
      fs.closeSync(fd);
      accessTime = Date.now() - accessStart;
      iops = Math.round((randomAccessCount / accessTime) * 1000);
    } catch (e) {
      // IOPS test failed
      iops = 0;
      accessTime = 0;
    }
    
    // Nettoyage
    try {
      fs.unlinkSync(testFile);
    } catch (e) {
      // Ignorer les erreurs de nettoyage
    }
    
    return {
      readSpeed,
      writeSpeed,
      iops,
      accessTime: accessTime > 0 ? Math.round(accessTime / 1000) : 0, // ms par accès
      testFileSize: totalWritten > 0 ? Math.round(totalWritten / 1024 / 1024) : 0, // MB
    };
  }

  // === EXTRACTEURS DE DÉTAILS ===
  private extractCPUDetails(combined: CombinedTestDetails & { realCPUDetails?: { singleCore: number; multiCore: number; instructionsPerSecond: number } }): CPUBenchmarkDetails {
    // Utiliser les vraies mesures d'opérations si disponibles et valides (> 100000)
    if (combined.realCPUDetails && combined.realCPUDetails.multiCore > 100000) {
      return combined.realCPUDetails;
    }
    
    // Fallback: Estimation basée sur l'utilisation CPU moyenne
    // Un CPU moderne à 100% fait environ 10-50M ops/s selon le nombre de cœurs
    // i5-3470 (4 cores) ~ 10M ops/s | M1 (8 cores) ~ 20M ops/s
    const basePerformancePerCore = 2500000; // 2.5M ops/s par cœur à pleine charge
    const cores = os.cpus().length;
    const maxMultiCore = basePerformancePerCore * cores;
    const maxSingleCore = basePerformancePerCore * 1.5; // Single core peut turbo
    
    const usageFactor = combined.cpuAverageUsage / 100;
    
    return {
      singleCore: Math.round(maxSingleCore * usageFactor),
      multiCore: Math.round(maxMultiCore * usageFactor),
      instructionsPerSecond: Math.round(maxMultiCore * usageFactor),
    };
  }

  private extractGPUDetails(combined: CombinedTestDetails): GPUBenchmarkDetails {
    return {
      computeScore: Math.round(combined.gpuAverageUsage * 200),
      memoryBandwidth: Math.round(combined.gpuAverageUsage * 10),
      testDuration: combined.duration,
      averageUsage: combined.gpuAverageUsage,
      peakUsage: Math.round(combined.gpuAverageUsage * 1.2),
    };
  }

  private extractRAMDetails(combined: CombinedTestDetails): RAMBenchmarkDetails {
    return {
      readSpeed: Math.round(combined.ramAverageUsage * 5),
      writeSpeed: Math.round(combined.ramAverageUsage * 5),
      latency: Math.round(100 - combined.ramAverageUsage),
    };
  }

  // === NOUVELLES MÉTHODES DE TEST INTENSIF (remplacent les anciennes) ===
  private async runIntensiveCPUBenchmark(
    onProgress: (progress: BenchmarkProgress) => void
  ): Promise<CPUBenchmarkDetails> {
    onProgress({
      phase: 'cpu',
      progress: 0,
      currentTest: 'Test CPU intensif (single-core)...',
      eta: 30,
      elapsed: 0,
      totalDuration: 60,
    });
    
    // Test single-core intensif
    const singleStart = Date.now();
    let singleOps = 0;
    
    while (Date.now() - singleStart < 5000 && this.isRunning) {
      this.runIntensiveMathOperations(50000);
      singleOps++;
    }
    
    onProgress({
      phase: 'cpu',
      progress: 50,
      currentTest: 'Test CPU intensif (multi-core)...',
      eta: 30,
      elapsed: 5,
      totalDuration: 60,
    });
    
    // Test multi-core intensif
    const multiStart = Date.now();
    const cores = os.cpus().length;
    const workers: Promise<number>[] = [];
    
    for (let i = 0; i < cores; i++) {
      workers.push(new Promise((resolve) => {
        let ops = 0;
        const start = Date.now();
        while (Date.now() - start < 5000 && this.isRunning) {
          this.runIntensiveMathOperations(50000);
          ops++;
        }
        resolve(ops);
      }));
    }
    
    const results = await Promise.all(workers);
    const multiOps = results.reduce((a, b) => a + b, 0);
    
    onProgress({
      phase: 'cpu',
      progress: 100,
      currentTest: 'Test CPU terminé',
      eta: 0,
      elapsed: 60,
      totalDuration: 60,
    });
    
    return {
      singleCore: singleOps,
      multiCore: multiOps,
      instructionsPerSecond: multiOps * 10000,
    };
  }

  private async runGPUBenchmark(
    onProgress: (progress: BenchmarkProgress) => void
  ): Promise<GPUBenchmarkDetails> {
    onProgress({
      phase: 'gpu',
      progress: 0,
      currentTest: 'Initialisation test GPU WebGL...',
      eta: 30,
      elapsed: 0,
      totalDuration: 60,
    });
    
    // Run WebGL benchmark
    const webglBenchmark = new GPUWebGLBenchmark();
    
    // Progress updater
    const progressInterval = setInterval(() => {
      if (!this.isRunning) {
        webglBenchmark.stop();
        clearInterval(progressInterval);
        return;
      }
      // WebGL doesn't provide progress, so we simulate based on time
      // The actual result will come at the end
    }, 1000);
    
    try {
      const result: WebGLBenchmarkResult = await webglBenchmark.run(30);
      clearInterval(progressInterval);
      
      onProgress({
        phase: 'gpu',
        progress: 100,
        currentTest: `Test GPU terminé - ${result.averageFps.toFixed(1)} FPS moyen`,
        eta: 0,
        elapsed: 30,
        totalDuration: 60,
      });
      
      return {
        computeScore: result.score,
        memoryBandwidth: Math.round(result.averageFps * 100), // Simulated bandwidth based on FPS
        testDuration: result.testDuration,
        averageUsage: Math.min(Math.round(result.averageFps / 2), 100), // Estimate GPU usage from FPS
        peakUsage: Math.min(Math.round(result.maxFps / 2), 100),
        webglResult: result, // Additional WebGL-specific data
      };
    } catch (error) {
      clearInterval(progressInterval);
      console.error('WebGL benchmark failed:', error);
      
      // Fallback to CPU-based simulation
      return this.runFallbackGPUBenchmark(onProgress);
    }
  }
  
  private async runFallbackGPUBenchmark(
    onProgress: (progress: BenchmarkProgress) => void
  ): Promise<GPUBenchmarkDetails> {
    onProgress({
      phase: 'gpu',
      progress: 0,
      currentTest: 'WebGL indisponible - Test CPU fallback...',
      eta: 30,
      elapsed: 0,
      totalDuration: 60,
    });
    
    const startTime = Date.now();
    const testDuration = 30000;
    let operations = 0;
    
    while (Date.now() - startTime < testDuration && this.isRunning) {
      const buffer = new Float32Array(1000000);
      for (let i = 0; i < buffer.length; i++) {
        buffer[i] = Math.sin(i * 0.001) * Math.cos(i * 0.002) * Math.sqrt(i + 1);
      }
      operations += buffer.length;
      
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      onProgress({
        phase: 'gpu',
        progress: Math.round((elapsed / 30) * 100),
        currentTest: `Calculs fallback en cours...`,
        eta: 30 - elapsed,
        elapsed: elapsed,
        totalDuration: 60,
      });
      
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    
    return {
      computeScore: Math.round(operations / 1000),
      memoryBandwidth: Math.round(operations / 1000000),
      testDuration: Math.floor((Date.now() - startTime) / 1000),
      averageUsage: 50,
      peakUsage: 60,
    };
  }

  private async runIntensiveRAMBenchmark(
    onProgress: (progress: BenchmarkProgress) => void
  ): Promise<RAMBenchmarkDetails> {
    onProgress({
      phase: 'ram',
      progress: 0,
      currentTest: 'Test RAM (lecture intensive)...',
      eta: 30,
      elapsed: 0,
      totalDuration: 60,
    });
    
    // Test lecture
    const readStart = Date.now();
    const readSize = 500 * 1024 * 1024; // 500 MB
    const readArray = new Uint8Array(readSize);
    
    // Initialiser avec des données
    for (let i = 0; i < readSize; i += 1024) {
      readArray[i] = i % 256;
    }
    
    let readSum = 0;
    for (let i = 0; i < readSize && this.isRunning; i++) {
      readSum += readArray[i];
    }
    
    const readTime = Date.now() - readStart;
    const readSpeed = Math.round((readSize / readTime) * 1000 / 1024 / 1024);
    
    onProgress({
      phase: 'ram',
      progress: 50,
      currentTest: 'Test RAM (écriture intensive)...',
      eta: 15,
      elapsed: 30,
      totalDuration: 60,
    });
    
    // Test écriture
    const writeStart = Date.now();
    const writeArray = new Uint8Array(readSize);
    
    for (let i = 0; i < readSize && this.isRunning; i++) {
      writeArray[i] = (i * 7) % 256;
    }
    
    const writeTime = Date.now() - writeStart;
    const writeSpeed = Math.round((readSize / writeTime) * 1000 / 1024 / 1024);
    
    onProgress({
      phase: 'ram',
      progress: 100,
      currentTest: 'Test RAM terminé',
      eta: 0,
      elapsed: 60,
      totalDuration: 60,
    });
    
    return {
      readSpeed,
      writeSpeed,
      latency: Math.round(Math.random() * 50 + 50), // Simulé
    };
  }
}
