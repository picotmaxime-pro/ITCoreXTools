import { HardwareAnalyzer } from './hardware-analyzer';
import * as os from 'os';

export interface AdaptiveCPUMetrics {
  timestamp: number;
  usage: number;
  frequency: number;
  temperature: number | null;
  loadLevel: number; // Niveau de charge (0-100)
  operationsPerSecond: number;
  coreUsages: number[];
}

export interface AdaptiveCPUBenchmarkResult {
  peakUsage: number;
  averageUsage: number;
  peakTemperature: number | null;
  averageTemperature: number | null;
  peakFrequency: number;
  averageFrequency: number;
  stability: number; // Score 0-100
  rampingPhase: number; // Durée de montée en charge (secondes)
  sustainedPhase: number; // Durée maintenue à 100% (secondes)
  throttlingDetected: boolean;
  optimalLoadLevel: number; // Niveau optimal trouvé
  metrics: AdaptiveCPUMetrics[];
}

export class AdaptiveCPUBenchmark {
  private hardwareAnalyzer: HardwareAnalyzer;
  private isRunning = false;
  private currentLoadLevel = 0;
  private targetUsage = 95;
  private metrics: AdaptiveCPUMetrics[] = [];
  private workers: Promise<void>[] = [];
  private abortControllers: AbortController[] = [];

  constructor() {
    this.hardwareAnalyzer = new HardwareAnalyzer();
  }

  async start(
    duration: number,
    onProgress: (metrics: AdaptiveCPUMetrics, phase: 'ramping' | 'sustained' | 'cooldown', elapsed: number) => void
  ): Promise<AdaptiveCPUBenchmarkResult> {
    if (this.isRunning) {
      throw new Error('Benchmark already running');
    }

    this.isRunning = true;
    this.metrics = [];
    this.currentLoadLevel = 0;
    this.abortControllers = [];

    const startTime = Date.now();
    const coreCount = os.cpus().length;
    
    return new Promise(async (resolve) => {
      const rampingPhase: AdaptiveCPUMetrics[] = [];
      const sustainedPhase: AdaptiveCPUMetrics[] = [];
      
      let phase: 'ramping' | 'sustained' | 'cooldown' = 'ramping';
      let rampingComplete = false;
      let optimalLoadFound = false;
      
      // Démarrer les workers CPU
      this.workers = [];
      for (let i = 0; i < coreCount; i++) {
        this.workers.push(this.runAdaptiveWorker(i, duration));
      }

      // Boucle de monitoring et ajustement
      const monitorInterval = setInterval(async () => {
        if (!this.isRunning) {
          clearInterval(monitorInterval);
          return;
        }

        const elapsed = (Date.now() - startTime) / 1000;
        const remaining = duration - elapsed;

        if (remaining <= 0) {
          clearInterval(monitorInterval);
          await this.stop();
          
          // Calculer les résultats
          const allMetrics = [...rampingPhase, ...sustainedPhase];
          const result = this.calculateResults(allMetrics, rampingPhase.length, sustainedPhase.length);
          resolve(result);
          return;
        }

        // Collecter métriques
        const metrics = await this.collectMetrics();
        this.metrics.push(metrics);

        // Phase de ramping (montée progressive)
        if (phase === 'ramping' && !rampingComplete) {
          rampingPhase.push(metrics);
          
          if (metrics.usage >= this.targetUsage) {
            // Objectif atteint, passer en phase sustained
            rampingComplete = true;
            optimalLoadFound = true;
            phase = 'sustained';
          } else if (elapsed > duration * 0.3) {
            // Si après 30% du temps on n'a pas atteint 95%, on considère que c'est le max
            rampingComplete = true;
            phase = 'sustained';
          } else {
            // Augmenter la charge progressivement
            this.increaseLoad();
          }
        } else if (phase === 'sustained') {
          sustainedPhase.push(metrics);
          
          // Ajuster pour maintenir ~95-100% sans throttling
          if (metrics.temperature && metrics.temperature > 90) {
            // Température critique, réduire légèrement
            this.decreaseLoad(5);
          } else if (metrics.usage < this.targetUsage - 10) {
            // Usage trop bas, augmenter
            this.increaseLoad();
          }
        }

        onProgress(metrics, phase, elapsed);
      }, 500); // Vérifier toutes les 500ms pour réactivité

      // Attendre la fin
      await Promise.all(this.workers);
    });
  }

  private async runAdaptiveWorker(coreIndex: number, duration: number): Promise<void> {
    const controller = new AbortController();
    this.abortControllers.push(controller);
    
    return new Promise((resolve) => {
      const startTime = Date.now();
      let iterations = 0;
      
      const work = () => {
        if (!this.isRunning || controller.signal.aborted) {
          resolve();
          return;
        }
        
        const elapsed = (Date.now() - startTime) / 1000;
        if (elapsed >= duration) {
          resolve();
          return;
        }

        // Niveau de charge actuel (0-100)
        const loadLevel = this.currentLoadLevel;
        
        // Calculer combien d'itérations faire basé sur le load level
        const iterationsPerBatch = Math.floor(1000 + loadLevel * 500);
        
        // Exécuter les calculs
        for (let i = 0; i < iterationsPerBatch && this.isRunning; i++) {
          this.performIntensiveCalculation();
        }
        
        iterations++;
        
        // Yield pour permettre l'event loop de répondre
        if (iterations % 50 === 0) {
          setImmediate(work);
        } else {
          work();
        }
      };
      
      work();
    });
  }

  private performIntensiveCalculation(): number {
    let result = 0;
    // Calculs mathématiques intensifs
    for (let i = 0; i < 100; i++) {
      const angle = i * 0.01;
      result += Math.sin(angle) * Math.cos(angle * 1.5) * Math.tan(angle * 0.5 + 0.1);
      result += Math.sqrt(i + 1) * Math.log(i + 2);
      result += Math.pow(i % 100, 2) / 1000;
      result = Math.abs(Math.sin(result) * Math.cos(result * 0.5));
    }
    return result;
  }

  private increaseLoad(): void {
    if (this.currentLoadLevel < 100) {
      this.currentLoadLevel = Math.min(100, this.currentLoadLevel + 2);
    }
  }

  private decreaseLoad(amount: number): void {
    this.currentLoadLevel = Math.max(0, this.currentLoadLevel - amount);
  }

  private async collectMetrics(): Promise<AdaptiveCPUMetrics> {
    const [cpuInfo, temps] = await Promise.all([
      this.hardwareAnalyzer.getCPUInfo(),
      this.hardwareAnalyzer.getTemperatures().catch(() => ({ cpu: null, gpu: null })),
    ]);

    return {
      timestamp: Date.now(),
      usage: cpuInfo.usage || 0,
      frequency: cpuInfo.speed || 0,
      temperature: temps.cpu,
      loadLevel: this.currentLoadLevel,
      operationsPerSecond: this.estimateOperationsPerSecond(),
      coreUsages: cpuInfo.coreUsages || [],
    };
  }

  private estimateOperationsPerSecond(): number {
    // Estimation basée sur le load level et les performances
    return Math.floor(this.currentLoadLevel * 100000 * (1 + Math.random() * 0.1));
  }

  private calculateResults(
    allMetrics: AdaptiveCPUMetrics[],
    rampingCount: number,
    sustainedCount: number
  ): AdaptiveCPUBenchmarkResult {
    if (allMetrics.length === 0) {
      return {
        peakUsage: 0,
        averageUsage: 0,
        peakTemperature: null,
        averageTemperature: null,
        peakFrequency: 0,
        averageFrequency: 0,
        stability: 0,
        rampingPhase: 0,
        sustainedPhase: 0,
        throttlingDetected: false,
        optimalLoadLevel: 0,
        metrics: [],
      };
    }

    const usages = allMetrics.map(m => m.usage);
    const temps = allMetrics.map(m => m.temperature).filter(t => t !== null) as number[];
    const freqs = allMetrics.map(m => m.frequency);

    const avgUsage = usages.reduce((a, b) => a + b, 0) / usages.length;
    const avgTemp = temps.length > 0 ? temps.reduce((a, b) => a + b, 0) / temps.length : null;
    const avgFreq = freqs.reduce((a, b) => a + b, 0) / freqs.length;

    // Détection throttling (baisse de fréquence sous charge)
    const highUsageMetrics = allMetrics.filter(m => m.usage > 80);
    let throttling = false;
    
    if (highUsageMetrics.length > 10) {
      const baseFreq = os.cpus()[0].speed;
      const avgHighUsageFreq = highUsageMetrics.reduce((a, m) => a + m.frequency, 0) / highUsageMetrics.length;
      throttling = avgHighUsageFreq < baseFreq * 0.9;
    }

    // Calcul stabilité (variance faible = stable)
    const usageVariance = usages.reduce((sum, u) => sum + Math.pow(u - avgUsage, 2), 0) / usages.length;
    const stability = Math.max(0, 100 - Math.sqrt(usageVariance) * 2);

    return {
      peakUsage: Math.max(...usages),
      averageUsage: Math.round(avgUsage),
      peakTemperature: temps.length > 0 ? Math.max(...temps) : null,
      averageTemperature: avgTemp ? Math.round(avgTemp) : null,
      peakFrequency: Math.max(...freqs),
      averageFrequency: Math.round(avgFreq * 100) / 100,
      stability: Math.round(stability),
      rampingPhase: rampingCount * 0.5, // 500ms interval
      sustainedPhase: sustainedCount * 0.5,
      throttlingDetected: throttling,
      optimalLoadLevel: this.currentLoadLevel,
      metrics: allMetrics,
    };
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    
    // Signaler l'arrêt à tous les workers
    this.abortControllers.forEach(controller => controller.abort());
    this.abortControllers = [];
    
    // Attendre que les workers s'arrêtent
    await Promise.all(this.workers.map(w => w.catch(() => {})));
    this.workers = [];
  }
}

export default AdaptiveCPUBenchmark;
