export interface BottleneckMetrics {
  timestamp: number;
  cpuUsage: number;
  gpuUsage: number;
  cpuFrequency: number;
  gpuFrequency: number | null;
  cpuTemperature: number | null;
  gpuTemperature: number | null;
  fps: number;
  frameTime: number;
}

export interface BottleneckAnalysis {
  cpuBottleneck: boolean;
  gpuBottleneck: boolean;
  ramBottleneck: boolean;
  severity: 'none' | 'mild' | 'moderate' | 'severe';
  confidence: number;
  details: string;
  recommendations: string[];
  metrics: BottleneckMetrics[];
}

export class BottleneckDetector {
  private metrics: BottleneckMetrics[] = [];
  private windowSize = 30; // 30 secondes d'historique

  addMetric(metric: BottleneckMetrics): void {
    this.metrics.push(metric);
    
    // Garder seulement les dernières mesures
    if (this.metrics.length > this.windowSize * 2) {
      this.metrics = this.metrics.slice(-this.windowSize * 2);
    }
  }

  analyze(): BottleneckAnalysis {
    if (this.metrics.length < 10) {
      return {
        cpuBottleneck: false,
        gpuBottleneck: false,
        ramBottleneck: false,
        severity: 'none',
        confidence: 0,
        details: 'Pas assez de données pour analyser',
        recommendations: [],
        metrics: [],
      };
    }

    // Utiliser les dernières 30 secondes
    const recentMetrics = this.metrics.slice(-this.windowSize);
    
    // Calculer les moyennes
    const avgCpuUsage = recentMetrics.reduce((a, m) => a + m.cpuUsage, 0) / recentMetrics.length;
    const avgGpuUsage = recentMetrics.reduce((a, m) => a + m.gpuUsage, 0) / recentMetrics.length;
    const avgFps = recentMetrics.reduce((a, m) => a + m.fps, 0) / recentMetrics.length;
    const avgFrameTime = recentMetrics.reduce((a, m) => a + m.frameTime, 0) / recentMetrics.length;

    // Détection des patterns
    let cpuBottleneck = false;
    let gpuBottleneck = false;
    let severity: 'none' | 'mild' | 'moderate' | 'severe' = 'none';
    let confidence = 0;
    const recommendations: string[] = [];
    const details: string[] = [];

    // Pattern 1: CPU à 100% mais GPU < 80% = Bottleneck CPU
    if (avgCpuUsage > 90 && avgGpuUsage < 80) {
      cpuBottleneck = true;
      details.push(`CPU saturé à ${avgCpuUsage.toFixed(1)}% pendant que GPU n'utilise que ${avgGpuUsage.toFixed(1)}%`);
      
      if (avgFps < 60) {
        severity = avgFps < 30 ? 'severe' : 'moderate';
        recommendations.push('Le CPU limite les performances - envisagez une mise à niveau du processeur');
      }
      
      confidence = Math.min(95, (avgCpuUsage - avgGpuUsage) * 1.5);
    }

    // Pattern 2: GPU à 100% mais CPU < 70% = Bottleneck GPU
    if (avgGpuUsage > 95 && avgCpuUsage < 70) {
      gpuBottleneck = true;
      details.push(`GPU saturée à ${avgGpuUsage.toFixed(1)}% pendant que CPU n'utilise que ${avgCpuUsage.toFixed(1)}%`);
      
      severity = severity === 'severe' ? 'severe' : (avgFps < 30 ? 'moderate' : 'mild');
      recommendations.push('La carte graphique est le facteur limitant - envisagez une mise à niveau GPU');
      
      confidence = Math.max(confidence, Math.min(95, (avgGpuUsage - avgCpuUsage) * 1.2));
    }

    // Pattern 3: Frame time instable = problème de synchronisation
    const frameTimeVariance = recentMetrics.reduce((sum, m) => {
      return sum + Math.pow(m.frameTime - avgFrameTime, 2);
    }, 0) / recentMetrics.length;
    
    if (frameTimeVariance > 4 && avgFps < 60) {
      details.push(`Instabilité des frames détectée (variance: ${frameTimeVariance.toFixed(2)}ms)`);
      
      if (!cpuBottleneck && !gpuBottleneck) {
        recommendations.push('Stuttering détecté - vérifiez les drivers et la température');
        severity = severity === 'none' ? 'mild' : severity;
        confidence = Math.max(confidence, 60);
      }
    }

    // Pattern 4: Throttling thermique
    const highTempMetrics = recentMetrics.filter(m => 
      (m.cpuTemperature && m.cpuTemperature > 85) || 
      (m.gpuTemperature && m.gpuTemperature > 85)
    );
    
    if (highTempMetrics.length > recentMetrics.length * 0.3) {
      details.push('Throttling thermique détecté');
      recommendations.push('Températures élevées - améliorez le refroidissement');
      severity = severity === 'none' ? 'mild' : severity;
    }

    // Pattern 5: GPU sous-utilisée avec bon FPS = équilibré
    if (!cpuBottleneck && !gpuBottleneck && avgFps > 60) {
      details.push(`Configuration équilibrée - ${avgFps.toFixed(0)} FPS stable`);
      confidence = 80;
    }

    // Déterminer le type dominant
    let dominantBottleneck = 'Aucun';
    if (cpuBottleneck && gpuBottleneck) {
      dominantBottleneck = 'Double (CPU et GPU)';
    } else if (cpuBottleneck) {
      dominantBottleneck = 'CPU';
    } else if (gpuBottleneck) {
      dominantBottleneck = 'GPU';
    } else {
      dominantBottleneck = 'Aucun - Système équilibré';
    }

    return {
      cpuBottleneck,
      gpuBottleneck,
      ramBottleneck: false, // À implémenter avec métriques RAM
      severity,
      confidence: Math.round(confidence),
      details: details.join(' | ') || 'Système performant',
      recommendations: recommendations.length > 0 ? recommendations : ['Configuration optimale'],
      metrics: recentMetrics,
    };
  }

  getCorrelationMatrix(): { cpuGpu: number; cpuFps: number; gpuFps: number } {
    if (this.metrics.length < 5) {
      return { cpuGpu: 0, cpuFps: 0, gpuFps: 0 };
    }

    const recent = this.metrics.slice(-30);
    
    return {
      cpuGpu: this.calculateCorrelation(recent.map(m => m.cpuUsage), recent.map(m => m.gpuUsage)),
      cpuFps: this.calculateCorrelation(recent.map(m => m.cpuUsage), recent.map(m => m.fps)),
      gpuFps: this.calculateCorrelation(recent.map(m => m.gpuUsage), recent.map(m => m.fps)),
    };
  }

  private calculateCorrelation(x: number[], y: number[]): number {
    const n = Math.min(x.length, y.length);
    if (n < 2) return 0;

    const sumX = x.slice(0, n).reduce((a, b) => a + b, 0);
    const sumY = y.slice(0, n).reduce((a, b) => a + b, 0);
    const sumXY = x.slice(0, n).reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumX2 = x.slice(0, n).reduce((sum, xi) => sum + xi * xi, 0);
    const sumY2 = y.slice(0, n).reduce((sum, yi, i) => sum + yi * y[i], 0);

    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

    return denominator === 0 ? 0 : numerator / denominator;
  }

  reset(): void {
    this.metrics = [];
  }
}

export default BottleneckDetector;
