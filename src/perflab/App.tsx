import React, { useState, useEffect, useCallback } from 'react';
import { SystemInfo, BenchmarkProgress, BenchmarkResult } from '../shared/types';

export const PerfLabApp: React.FC = () => {
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState<BenchmarkProgress | null>(null);
  const [result, setResult] = useState<BenchmarkResult | null>(null);
  const [selectedTests, setSelectedTests] = useState({
    cpu: true,
    gpu: true,
    ram: true,
    storage: true,
  });
  const [benchmarkDuration, setBenchmarkDuration] = useState<5 | 15 | 30>(5);
  const [runCombinedTest, setRunCombinedTest] = useState(true);
  const [runStorageTest, setRunStorageTest] = useState(true);

  useEffect(() => {
    loadSystemInfo();
  }, []);

  const loadSystemInfo = async () => {
    try {
      const info = await window.electronAPI.getSystemInfo();
      setSystemInfo(info);
    } catch (error) {
      console.error('Failed to load system info:', error);
    }
  };

  const startBenchmark = async () => {
    if (isRunning) return;

    setIsRunning(true);
    setResult(null);

    // Souscrire aux mises à jour de progression
    window.electronAPI.onBenchmarkProgress((progressData) => {
      setProgress(progressData);
    });

    try {
      const benchmarkResult = await window.electronAPI.startBenchmark({
        cpu: selectedTests.cpu,
        gpu: selectedTests.gpu,
        ram: selectedTests.ram,
        storage: selectedTests.storage,
        duration: benchmarkDuration,
        runCombinedTest: runCombinedTest,
        runStorageTest: runStorageTest,
      });

      setResult(benchmarkResult);
    } catch (error) {
      console.error('Benchmark failed:', error);
    } finally {
      setIsRunning(false);
      setProgress(null);
      window.electronAPI.removeAllListeners('benchmark:progress');
    }
  };

  const stopBenchmark = async () => {
    await window.electronAPI.stopBenchmark();
    setIsRunning(false);
  };

  const formatBytes = (bytes: number): string => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.logo}>
          <div style={styles.logoIcon}>IT</div>
          <div>
            <h1 style={styles.title}>PerfLab<span style={styles.accent}>-IT</span></h1>
            <p style={styles.subtitle}>Benchmark système — ITCoreX</p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main style={styles.main}>
        {/* System Info Panel */}
        {systemInfo && (
          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>Configuration système</h2>
            <div style={styles.grid}>
              <div style={styles.card}>
                <h3 style={styles.cardTitle}>Processeur</h3>
                <p style={styles.cardValue}>{systemInfo.cpu.brand}</p>
                <p style={styles.cardDetail}>{systemInfo.cpu.cores} cœurs / {systemInfo.cpu.physicalCores} physiques</p>
                <p style={styles.cardDetail}>{systemInfo.cpu.speed} GHz</p>
              </div>
              <div style={styles.card}>
                <h3 style={styles.cardTitle}>Mémoire</h3>
                <p style={styles.cardValue}>{formatBytes(systemInfo.ram.total)}</p>
                <p style={styles.cardDetail}>{systemInfo.ram.type || 'DDR'}</p>
              </div>
              <div style={styles.card}>
                <h3 style={styles.cardTitle}>Carte graphique</h3>
                {systemInfo.gpu.map((gpu, i) => (
                  <div key={i}>
                    <p style={styles.cardValue}>{gpu.model}</p>
                    <p style={styles.cardDetail}>{formatBytes(gpu.vram * 1024 * 1024)} VRAM</p>
                  </div>
                ))}
              </div>
              <div style={styles.card}>
                <h3 style={styles.cardTitle}>Stockage</h3>
                {systemInfo.storage.slice(0, 2).map((disk, i) => (
                  <p key={i} style={styles.cardDetail}>
                    {disk.model} ({formatBytes(disk.size)})
                  </p>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Benchmark Controls */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Tests de performance</h2>
          
          {!isRunning && !result && (
            <>
              {/* Durée du benchmark */}
              <div style={styles.durationSelector}>
                <h3 style={styles.subSectionTitle}>Durée du benchmark</h3>
                <div style={styles.durationButtons}>
                  {[5, 15, 30].map((duration) => (
                    <button
                      key={duration}
                      style={{
                        ...styles.durationButton,
                        ...(benchmarkDuration === duration ? styles.durationButtonActive : {}),
                      }}
                      onClick={() => setBenchmarkDuration(duration as 5 | 15 | 30)}
                    >
                      {duration} min
                    </button>
                  ))}
                </div>
                <p style={styles.durationInfo}>
                  Test intensif: {Math.floor((210 * benchmarkDuration / 5) / 60)}m{Math.round((210 * benchmarkDuration / 5) % 60)}s | 
                  Stockage: {Math.floor((90 * benchmarkDuration / 5) / 60)}m{Math.round((90 * benchmarkDuration / 5) % 60)}s | 
                  Total: {benchmarkDuration}min
                </p>
              </div>

              {/* Options de test */}
              <div style={styles.testSelection}>
                <h3 style={styles.subSectionTitle}>Composants à tester</h3>
                <label style={styles.checkbox}>
                  <input
                    type="checkbox"
                    checked={selectedTests.cpu}
                    onChange={(e) => setSelectedTests({ ...selectedTests, cpu: e.target.checked })}
                  />
                  <span>CPU (Test intensif 100%)</span>
                </label>
                <label style={styles.checkbox}>
                  <input
                    type="checkbox"
                    checked={selectedTests.gpu}
                    onChange={(e) => setSelectedTests({ ...selectedTests, gpu: e.target.checked })}
                  />
                  <span>GPU (Calculs 3D intensifs)</span>
                </label>
                <label style={styles.checkbox}>
                  <input
                    type="checkbox"
                    checked={selectedTests.ram}
                    onChange={(e) => setSelectedTests({ ...selectedTests, ram: e.target.checked })}
                  />
                  <span>RAM (Lecture/Écriture massive)</span>
                </label>
              </div>

              {/* Options avancées */}
              <div style={styles.advancedOptions}>
                <h3 style={styles.subSectionTitle}>Options</h3>
                <label style={styles.checkbox}>
                  <input
                    type="checkbox"
                    checked={runCombinedTest}
                    onChange={(e) => setRunCombinedTest(e.target.checked)}
                  />
                  <span>Test combiné CPU+GPU+RAM (simulation jeu)</span>
                </label>
                <label style={styles.checkbox}>
                  <input
                    type="checkbox"
                    checked={runStorageTest}
                    onChange={(e) => setRunStorageTest(e.target.checked)}
                  />
                  <span>Test stockage séparé (débit réel)</span>
                </label>
              </div>

              <button style={styles.startButton} onClick={startBenchmark}>
                ▶ Lancer le benchmark
              </button>
            </>
          )}

          {isRunning && progress && (
            <div style={styles.progressContainer}>
              <div style={styles.progressHeader}>
                <span style={styles.progressPhase}>{progress.currentTest}</span>
                <span style={styles.progressPercent}>{progress.progress}%</span>
              </div>
              <div style={styles.progressBar}>
                <div 
                  style={{...styles.progressFill, width: `${progress.progress}%`}}
                />
              </div>
              
              {/* Décompte temps restant */}
              <div style={styles.countdownContainer}>
                <div style={styles.countdownItem}>
                  <span style={styles.countdownLabel}>Temps restant</span>
                  <span style={styles.countdownValue}>
                    {Math.floor(progress.eta / 60)}:{String(progress.eta % 60).padStart(2, '0')}
                  </span>
                </div>
                <div style={styles.countdownItem}>
                  <span style={styles.countdownLabel}>Écoulé</span>
                  <span style={styles.countdownValue}>
                    {Math.floor(progress.elapsed / 60)}:{String(progress.elapsed % 60).padStart(2, '0')}
                  </span>
                </div>
              </div>

              {/* Monitoring temps réel */}
              {progress.metrics && (
                <div style={styles.metricsContainer}>
                  <h4 style={styles.metricsTitle}>Monitoring temps réel</h4>
                  <div style={styles.metricsGrid}>
                    {/* CPU */}
                    <div style={styles.metricCard}>
                      <span style={styles.metricName}>CPU</span>
                      <div style={styles.metricBar}>
                        <div style={{...styles.metricFill, width: `${progress.metrics.cpu.usage}%`, background: '#ff6b35'}} />
                      </div>
                      <span style={styles.metricValue}>{Math.round(progress.metrics.cpu.usage)}%</span>
                      <span style={styles.metricDetail}>
                        {progress.metrics.cpu.frequency > 0 
                          ? `${progress.metrics.cpu.frequency.toFixed(1)} GHz` 
                          : 'Fréq: N/A'}
                        {progress.metrics.cpu.temperature 
                          ? ` | ${progress.metrics.cpu.temperature}°C` 
                          : ' | Temp: N/A (Lancer en admin pour les températures)'}
                      </span>
                    </div>

                    {/* GPU */}
                    <div style={styles.metricCard}>
                      <span style={styles.metricName}>GPU</span>
                      <div style={styles.metricBar}>
                        <div style={{...styles.metricFill, width: `${progress.metrics.gpu.usage}%`, background: '#4ecdc4'}} />
                      </div>
                      <span style={styles.metricValue}>{Math.round(progress.metrics.gpu.usage)}%</span>
                      <span style={styles.metricDetail}>
                        {progress.metrics.gpu.temperature 
                          ? `${progress.metrics.gpu.temperature}°C` 
                          : 'Temp: N/A (NVIDIA uniquement / Admin requis)'}
                      </span>
                    </div>

                    {/* RAM */}
                    <div style={styles.metricCard}>
                      <span style={styles.metricName}>RAM</span>
                      <div style={styles.metricBar}>
                        <div style={{...styles.metricFill, width: `${progress.metrics.ram.usagePercent}%`, background: '#95e1d3'}} />
                      </div>
                      <span style={styles.metricValue}>{Math.round(progress.metrics.ram.usagePercent)}%</span>
                      <span style={styles.metricDetail}>
                        {formatBytes(progress.metrics.ram.used)} / {formatBytes(progress.metrics.ram.total)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <button style={styles.stopButton} onClick={stopBenchmark}>
                ◼ Arrêter le benchmark
              </button>
            </div>
          )}

          {result && (
            <div style={styles.results}>
              <div style={styles.scoreCard}>
                <h3 style={styles.scoreTitle}>Score global</h3>
                <div style={styles.scoreValue}>{result.overallScore.toLocaleString()}</div>
              </div>

              <div style={styles.scoreGrid}>
                <div style={styles.scoreItem}>
                  <span style={styles.scoreLabel}>CPU</span>
                  <span style={styles.scoreNumber}>{result.cpuScore.toLocaleString()}</span>
                </div>
                <div style={styles.scoreItem}>
                  <span style={styles.scoreLabel}>RAM</span>
                  <span style={styles.scoreNumber}>{result.ramScore.toLocaleString()}</span>
                </div>
                <div style={styles.scoreItem}>
                  <span style={styles.scoreLabel}>Storage</span>
                  <span style={styles.scoreNumber}>{result.storageScore.toLocaleString()}</span>
                </div>
              </div>

              <div style={styles.detailsGrid}>
                <div style={styles.detailCard}>
                  <h4>CPU Details</h4>
                  <p>Single-core: {result.details.cpu.singleCore.toLocaleString()} ops/s</p>
                  <p>Multi-core: {result.details.cpu.multiCore.toLocaleString()} ops/s</p>
                </div>
                <div style={styles.detailCard}>
                  <h4>RAM Details</h4>
                  <p>Read: {result.details.ram.readSpeed} MB/s</p>
                  <p>Write: {result.details.ram.writeSpeed} MB/s</p>
                  <p>Latency: {result.details.ram.latency} ns</p>
                </div>
                {result.details.storage && (
                  <div style={styles.detailCard}>
                    <h4>Storage Details</h4>
                    <p>Read: {result.details.storage.readSpeed} MB/s</p>
                    <p>Write: {result.details.storage.writeSpeed} MB/s</p>
                    <p>IOPS: {result.details.storage.iops.toLocaleString()}</p>
                  </div>
                )}
              </div>

              {result.bottleneckAnalysis && (
                <div style={styles.bottleneckCard}>
                  <h4 style={styles.bottleneckTitle}>
                    Analyse des Bottlenecks
                    <span style={{
                      ...styles.bottleneckSeverity,
                      ...(result.bottleneckAnalysis.severity === 'severe' ? styles.severe :
                         result.bottleneckAnalysis.severity === 'moderate' ? styles.moderate :
                         result.bottleneckAnalysis.severity === 'mild' ? styles.mild : styles.none)
                    }}>
                      {result.bottleneckAnalysis.severity === 'none' ? '✓ OK' :
                       result.bottleneckAnalysis.severity === 'mild' ? '⚠ Léger' :
                       result.bottleneckAnalysis.severity === 'moderate' ? '⚠ Moyen' : '✗ Sévère'}
                    </span>
                  </h4>
                  
                  <p style={styles.bottleneckDetails}>{result.bottleneckAnalysis.details}</p>
                  
                  {result.bottleneckAnalysis.cpuBottleneck && (
                    <div style={styles.bottleneckItem}>
                      <span style={styles.bottleneckLabel}>Bottleneck CPU:</span>
                      <span style={styles.bottleneckValue}>Détecté</span>
                    </div>
                  )}
                  
                  {result.bottleneckAnalysis.gpuBottleneck && (
                    <div style={styles.bottleneckItem}>
                      <span style={styles.bottleneckLabel}>Bottleneck GPU:</span>
                      <span style={styles.bottleneckValue}>Détecté</span>
                    </div>
                  )}
                  
                  <div style={styles.recommendations}>
                    <h5>Recommandations:</h5>
                    <ul>
                      {result.bottleneckAnalysis.recommendations.map((rec, idx) => (
                        <li key={idx}>{rec}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              <button style={styles.startButton} onClick={() => setResult(null)}>
                ↻ Nouveau benchmark
              </button>
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    background: 'var(--background)',
    color: 'var(--foreground)',
  },
  header: {
    padding: '24px 32px',
    borderBottom: '1px solid rgba(184, 115, 51, 0.2)',
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  logoIcon: {
    width: '48px',
    height: '48px',
    background: 'var(--copper)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 'bold',
    color: 'var(--cream)',
    fontSize: '18px',
  },
  title: {
    fontSize: '24px',
    fontWeight: 700,
    margin: 0,
    color: 'var(--foreground)',
  },
  accent: {
    color: 'var(--copper)',
  },
  subtitle: {
    fontSize: '14px',
    color: 'var(--gray-warm)',
    margin: '4px 0 0 0',
  },
  main: {
    padding: '32px',
    maxWidth: '1200px',
  },
  section: {
    marginBottom: '32px',
  },
  sectionTitle: {
    fontSize: '18px',
    marginBottom: '16px',
    color: 'var(--sand)',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '16px',
  },
  card: {
    background: 'var(--charcoal)',
    border: '1px solid rgba(184, 115, 51, 0.2)',
    padding: '20px',
  },
  cardTitle: {
    fontSize: '12px',
    textTransform: 'uppercase',
    color: 'var(--copper)',
    marginBottom: '8px',
    letterSpacing: '1px',
  },
  cardValue: {
    fontSize: '16px',
    fontWeight: 600,
    color: 'var(--foreground)',
    marginBottom: '4px',
  },
  cardDetail: {
    fontSize: '13px',
    color: 'var(--gray-warm)',
  },
  testSelection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    marginBottom: '24px',
  },
  checkbox: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    cursor: 'pointer',
    fontSize: '14px',
  },
  startButton: {
    background: 'var(--copper)',
    color: 'var(--cream)',
    border: 'none',
    padding: '16px 32px',
    fontSize: '16px',
    fontWeight: 600,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
  },
  stopButton: {
    background: 'transparent',
    color: 'var(--orange-burnt)',
    border: '1px solid var(--orange-burnt)',
    padding: '12px 24px',
    fontSize: '14px',
    cursor: 'pointer',
    marginTop: '16px',
  },
  progressContainer: {
    padding: '24px',
    background: 'var(--charcoal)',
    border: '1px solid rgba(184, 115, 51, 0.3)',
  },
  progressHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '12px',
  },
  progressPhase: {
    color: 'var(--foreground)',
    fontSize: '14px',
  },
  progressPercent: {
    color: 'var(--copper)',
    fontWeight: 600,
  },
  progressBar: {
    width: '100%',
    height: '8px',
    background: 'var(--brown-deep)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    background: 'var(--copper)',
    transition: 'width 0.3s ease',
  },
  progressEta: {
    fontSize: '13px',
    color: 'var(--gray-warm)',
    marginTop: '12px',
  },
  results: {
    padding: '24px',
    background: 'var(--charcoal)',
    border: '1px solid rgba(184, 115, 51, 0.3)',
  },
  scoreCard: {
    textAlign: 'center',
    padding: '32px',
    marginBottom: '24px',
    background: 'rgba(184, 115, 51, 0.1)',
    border: '1px solid var(--copper)',
  },
  scoreTitle: {
    fontSize: '14px',
    color: 'var(--gray-warm)',
    marginBottom: '16px',
    textTransform: 'uppercase',
  },
  scoreValue: {
    fontSize: '64px',
    fontWeight: 700,
    background: 'linear-gradient(135deg, var(--copper) 0%, var(--gold) 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  scoreGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '16px',
    marginBottom: '24px',
  },
  scoreItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '16px',
    background: 'var(--background)',
  },
  scoreLabel: {
    fontSize: '12px',
    textTransform: 'uppercase',
    color: 'var(--gray-warm)',
    marginBottom: '8px',
  },
  scoreNumber: {
    fontSize: '24px',
    fontWeight: 600,
    color: 'var(--foreground)',
  },
  detailsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '16px',
    marginBottom: '24px',
  },
  detailCard: {
    padding: '16px',
    background: 'var(--background)',
    fontSize: '13px',
  },
  
  // New styles for duration selector
  durationSelector: {
    marginBottom: '24px',
    padding: '16px',
    background: 'var(--charcoal)',
    border: '1px solid rgba(184, 115, 51, 0.2)',
  },
  subSectionTitle: {
    fontSize: '14px',
    color: 'var(--sand)',
    marginBottom: '12px',
    fontWeight: 600,
  },
  durationButtons: {
    display: 'flex',
    gap: '12px',
    marginBottom: '12px',
  },
  durationButton: {
    padding: '8px 16px',
    background: 'var(--background)',
    border: '1px solid rgba(184, 115, 51, 0.3)',
    color: 'var(--foreground)',
    cursor: 'pointer',
    fontSize: '14px',
  },
  durationButtonActive: {
    background: 'var(--copper)',
    color: 'var(--cream)',
    border: '1px solid var(--copper)',
  },
  durationInfo: {
    fontSize: '12px',
    color: 'var(--gray-warm)',
    marginTop: '8px',
  },
  
  // Advanced options
  advancedOptions: {
    marginBottom: '24px',
    padding: '16px',
    background: 'var(--charcoal)',
    border: '1px solid rgba(184, 115, 51, 0.2)',
  },
  
  // Countdown styles
  countdownContainer: {
    display: 'flex',
    gap: '32px',
    marginTop: '16px',
    marginBottom: '16px',
    padding: '12px',
    background: 'var(--background)',
  },
  countdownItem: {
    display: 'flex',
    flexDirection: 'column',
  },
  countdownLabel: {
    fontSize: '11px',
    color: 'var(--gray-warm)',
    textTransform: 'uppercase',
  },
  countdownValue: {
    fontSize: '24px',
    fontWeight: 700,
    color: 'var(--copper)',
    fontFamily: 'monospace',
  },
  
  // Metrics monitoring styles
  metricsContainer: {
    marginTop: '16px',
    marginBottom: '16px',
    padding: '16px',
    background: 'var(--background)',
    border: '1px solid rgba(184, 115, 51, 0.2)',
  },
  metricsTitle: {
    fontSize: '13px',
    color: 'var(--sand)',
    marginBottom: '12px',
    fontWeight: 600,
  },
  metricsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '12px',
  },
  metricCard: {
    padding: '12px',
    background: 'var(--charcoal)',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  metricName: {
    fontSize: '11px',
    color: 'var(--gray-warm)',
    textTransform: 'uppercase',
  },
  metricBar: {
    width: '100%',
    height: '6px',
    background: 'var(--brown-deep)',
    borderRadius: '3px',
    overflow: 'hidden',
  },
  metricFill: {
    height: '100%',
    transition: 'width 0.3s ease',
  },
  metricValue: {
    fontSize: '18px',
    fontWeight: 700,
    color: 'var(--foreground)',
  },
  metricDetail: {
    fontSize: '11px',
    color: 'var(--gray-warm)',
  },
  
  // Bottleneck analysis styles
  bottleneckCard: {
    marginTop: '20px',
    padding: '16px',
    background: 'var(--charcoal)',
    border: '1px solid rgba(184, 115, 51, 0.3)',
    borderRadius: '4px',
  },
  bottleneckTitle: {
    fontSize: '14px',
    color: 'var(--sand)',
    marginBottom: '12px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bottleneckSeverity: {
    padding: '4px 12px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: 600,
  },
  none: {
    background: 'rgba(46, 204, 113, 0.2)',
    color: '#2ecc71',
  },
  mild: {
    background: 'rgba(241, 196, 15, 0.2)',
    color: '#f1c40f',
  },
  moderate: {
    background: 'rgba(230, 126, 34, 0.2)',
    color: '#e67e22',
  },
  severe: {
    background: 'rgba(231, 76, 60, 0.2)',
    color: '#e74c3c',
  },
  bottleneckDetails: {
    fontSize: '13px',
    color: 'var(--gray-warm)',
    marginBottom: '12px',
    lineHeight: '1.5',
  },
  bottleneckItem: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '8px 0',
    borderBottom: '1px solid rgba(184, 115, 51, 0.1)',
  },
  bottleneckLabel: {
    fontSize: '12px',
    color: 'var(--sand)',
  },
  bottleneckValue: {
    fontSize: '12px',
    color: '#e74c3c',
    fontWeight: 600,
  },
  recommendations: {
    marginTop: '12px',
    padding: '12px',
    background: 'var(--background)',
    borderRadius: '4px',
  },
};
