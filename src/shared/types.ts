// Types partagés entre main et renderer

export interface SystemInfo {
  os: {
    platform: string;
    distro: string;
    release: string;
    arch: string;
  };
  cpu: {
    manufacturer: string;
    brand: string;
    cores: number;
    physicalCores: number;
    speed: number;
    speedMax: number;
  };
  gpu: Array<{
    vendor: string;
    model: string;
    vram: number;
  }>;
  ram: {
    total: number;
    type: string;
    speed: number;
  };
  storage: Array<{
    device: string;
    type: string;
    size: number;
    model: string;
  }>;
  motherboard: {
    manufacturer: string;
    model: string;
  };
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

export interface BottleneckAnalysis {
  cpuBottleneck: boolean;
  gpuBottleneck: boolean;
  ramBottleneck: boolean;
  severity: 'none' | 'mild' | 'moderate' | 'severe';
  confidence: number;
  details: string;
  recommendations: string[];
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
    cpu: {
      singleCore: number;
      multiCore: number;
      instructionsPerSecond: number;
    };
    gpu: {
      computeScore: number;
      memoryBandwidth: number;
      testDuration: number;
      averageUsage: number;
      peakUsage: number;
    };
    ram: {
      readSpeed: number;
      writeSpeed: number;
      latency: number;
    };
    storage?: {
      readSpeed: number;
      writeSpeed: number;
      iops: number;
      accessTime: number;
      testFileSize: number;
    };
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
