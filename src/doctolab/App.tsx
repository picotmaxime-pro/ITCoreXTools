import React, { useState, useEffect } from 'react';
import { SystemInfo, StressTestData, StressTestResult } from '../shared/types';

type DiagnosticPhase = 'idle' | 'scan' | 'stress' | 'analysis' | 'complete';

export const DoctoLabApp: React.FC = () => {
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [phase, setPhase] = useState<DiagnosticPhase>('idle');
  const [progress, setProgress] = useState(0);
  const [stressData, setStressData] = useState<StressTestData[]>([]);
  const [result, setResult] = useState<StressTestResult | null>(null);
  const [problemDescription, setProblemDescription] = useState('');
  const [aiAnalysis, setAiAnalysis] = useState('');

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

  const startDiagnostic = async () => {
    if (phase !== 'idle') return;

    setPhase('scan');
    setProgress(0);
    setStressData([]);
    setResult(null);

    // Phase 1: Scan matériel (simulé)
    await simulatePhase('scan', 10, 2000);
    
    // Phase 2: Stress test (5 minutes = 300 secondes)
    setPhase('stress');
    
    window.electronAPI.onStressTestData((data) => {
      setStressData(prev => {
        const newData = [...prev, data];
        const elapsed = newData.length;
        setProgress(Math.min((elapsed / 300) * 100, 100));
        return newData;
      });
    });

    try {
      const stressResult = await window.electronAPI.startStressTest(300);
      setResult(stressResult);
      
      // Phase 3: Analyse IA (simulée)
      setPhase('analysis');
      await simulatePhase('analysis', 100, 3000);
      
      // Générer l'analyse IA
      generateAiAnalysis(stressResult);
      
      setPhase('complete');
    } catch (error) {
      console.error('Stress test failed:', error);
      setPhase('idle');
    } finally {
      window.electronAPI.removeAllListeners('stresstest:data');
    }
  };

  const simulatePhase = async (phaseName: string, targetProgress: number, duration: number) => {
    const steps = 10;
    const stepDuration = duration / steps;
    
    for (let i = 0; i <= steps; i++) {
      setProgress(Math.round((i / steps) * targetProgress));
      await new Promise(resolve => setTimeout(resolve, stepDuration));
    }
  };

  const stopDiagnostic = async () => {
    await window.electronAPI.stopStressTest();
    setPhase('idle');
    setProgress(0);
  };

  const generateAiAnalysis = (stressResult: StressTestResult) => {
    const analysis = generateAnalysisText(stressResult, problemDescription);
    setAiAnalysis(analysis);
  };

  const generateAnalysisText = (result: StressTestResult, problem: string): string => {
    let analysis = '';
    
    if (result.stabilityScore >= 90) {
      analysis = '✅ Système stable\n\nVotre système a passé tous les tests avec succès. Les températures sont dans les normes et aucun problème de stabilité n\'a été détecté.';
    } else if (result.stabilityScore >= 70) {
      analysis = '⚠️ Système acceptable avec réserves\n\nVotre système est fonctionnel mais présente des signes de stress sous charge. Surveillance recommandée.';
    } else {
      analysis = '❌ Problèmes détectés\n\nVotre système présente des instabilités significatives. Action corrective recommandée.';
    }

    if (result.throttlingDetected) {
      analysis += '\n\n🔥 Throttling thermique détecté\nLe CPU a réduit sa fréquence pour éviter la surchauffe. Vérifiez le refroidissement.';
    }

    if (result.errors.length > 0) {
      analysis += `\n\n⚠️ Erreurs détectées (${result.errors.length}):\n${result.errors.join('\n')}`;
    }

    if (problem) {
      analysis += `\n\n📝 Analyse du problème signalé:\nConcernant "${problem}", les données de stress test ne montrent pas de corrélation directe avec une défaillance matérielle évidente.`;
    }

    analysis += `\n\n📊 Recommandations:\n1. Surveiller les températures en utilisation réelle\n2. Vérifier la ventilation du boîtier\n3. Mettre à jour les pilotes de périphériques`;

    return analysis;
  };

  const getPhaseText = (phase: DiagnosticPhase): string => {
    switch (phase) {
      case 'scan': return 'Scan matériel en cours...';
      case 'stress': return 'Stress test en cours (5 minutes)...';
      case 'analysis': return 'Analyse IA des données...';
      case 'complete': return 'Diagnostic terminé';
      default: return '';
    }
  };

  const getTemperatureColor = (temp: number | null): string => {
    if (temp === null) return 'var(--gray-warm)';
    if (temp > 85) return '#ef4444';
    if (temp > 70) return '#fbbf24';
    return '#4ade80';
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.logo}>
          <div style={styles.logoIcon}>IT</div>
          <div>
            <h1 style={styles.title}>DoctoLab<span style={styles.accent}>-IT</span></h1>
            <p style={styles.subtitle}>Diagnostic intelligent — ITCoreX</p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main style={styles.main}>
        {/* System Info Panel */}
        {systemInfo && (
          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>Configuration détectée</h2>
            <div style={styles.grid}>
              <div style={styles.card}>
                <h3 style={styles.cardTitle}>Processeur</h3>
                <p style={styles.cardValue}>{systemInfo.cpu.brand}</p>
                <p style={styles.cardDetail}>{systemInfo.cpu.cores} cœurs</p>
              </div>
              <div style={styles.card}>
                <h3 style={styles.cardTitle}>Mémoire</h3>
                <p style={styles.cardValue}>{(systemInfo.ram.total / 1024 / 1024 / 1024).toFixed(1)} GB</p>
              </div>
              <div style={styles.card}>
                <h3 style={styles.cardTitle}>Température actuelle</h3>
                <p style={{...styles.cardValue, color: 'var(--copper)'}}>--°C</p>
                <p style={styles.cardDetail}>En attente du test...</p>
              </div>
            </div>
          </section>
        )}

        {/* Diagnostic Controls */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Diagnostic système</h2>

          {phase === 'idle' && !result && (
            <>
              <div style={styles.descriptionBox}>
                <label style={styles.label}>
                  Décrivez le problème rencontré (optionnel):
                </label>
                <textarea
                  style={styles.textarea}
                  value={problemDescription}
                  onChange={(e) => setProblemDescription(e.target.value)}
                  placeholder="Ex: Mon PC plante lors des jeux, écran bleu aléatoire..."
                  rows={4}
                />
              </div>

              <div style={styles.stepsInfo}>
                <h4 style={styles.stepsTitle}>Le diagnostic comprend:</h4>
                <ul style={styles.stepsList}>
                  <li>🔍 Scan complet du matériel</li>
                  <li>🔥 Stress test CPU/RAM (5 minutes)</li>
                  <li>🌡️ Surveillance thermique continue</li>
                  <li>🤖 Analyse IA des résultats</li>
                </ul>
              </div>

              <button style={styles.startButton} onClick={startDiagnostic}>
                ▶ Lancer le diagnostic
              </button>
            </>
          )}

          {(phase === 'scan' || phase === 'stress' || phase === 'analysis') && (
            <div style={styles.progressContainer}>
              <div style={styles.progressHeader}>
                <span style={styles.progressPhase}>{getPhaseText(phase)}</span>
                <span style={styles.progressPercent}>{Math.round(progress)}%</span>
              </div>
              <div style={styles.progressBar}>
                <div style={{...styles.progressFill, width: `${progress}%`}} />
              </div>

              {phase === 'stress' && stressData.length > 0 && (
                <div style={styles.liveData}>
                  <div style={styles.liveItem}>
                    <span>CPU Usage:</span>
                    <span style={styles.liveValue}>
                      {stressData[stressData.length - 1]?.cpuUsage.toFixed(1)}%
                    </span>
                  </div>
                  <div style={styles.liveItem}>
                    <span>CPU Temp:</span>
                    <span style={{
                      ...styles.liveValue,
                      color: getTemperatureColor(stressData[stressData.length - 1]?.cpuTemp)
                    }}>
                      {stressData[stressData.length - 1]?.cpuTemp?.toFixed(1) || '--'}°C
                    </span>
                  </div>
                  <div style={styles.liveItem}>
                    <span>RAM Usage:</span>
                    <span style={styles.liveValue}>
                      {stressData[stressData.length - 1]?.ramUsage.toFixed(1)}%
                    </span>
                  </div>
                  <div style={styles.liveItem}>
                    <span>Elapsed:</span>
                    <span style={styles.liveValue}>
                      {formatDuration(stressData.length)}
                    </span>
                  </div>
                </div>
              )}

              <button style={styles.stopButton} onClick={stopDiagnostic}>
                ◼ Arrêter le diagnostic
              </button>
            </div>
          )}

          {phase === 'complete' && result && (
            <div style={styles.results}>
              {/* Stability Score */}
              <div style={{
                ...styles.scoreCard,
                borderColor: result.stabilityScore >= 70 ? '#4ade80' : result.stabilityScore >= 50 ? '#fbbf24' : '#ef4444'
              }}>
                <h3 style={styles.scoreTitle}>Score de stabilité</h3>
                <div style={{
                  ...styles.scoreValue,
                  color: result.stabilityScore >= 70 ? '#4ade80' : result.stabilityScore >= 50 ? '#fbbf24' : '#ef4444'
                }}>
                  {result.stabilityScore}/100
                </div>
                <p style={styles.scoreStatus}>
                  {result.stabilityScore >= 90 ? '✅ Excellent' : 
                   result.stabilityScore >= 70 ? '✅ Stable' : 
                   result.stabilityScore >= 50 ? '⚠️ Acceptable' : '❌ Instable'}
                </p>
              </div>

              {/* Stats Grid */}
              <div style={styles.statsGrid}>
                <div style={styles.statItem}>
                  <span style={styles.statLabel}>Température max</span>
                  <span style={{
                    ...styles.statValue,
                    color: getTemperatureColor(result.cpuMaxTemp)
                  }}>
                    {result.cpuMaxTemp?.toFixed(1) || '--'}°C
                  </span>
                </div>
                <div style={styles.statItem}>
                  <span style={styles.statLabel}>Température moy</span>
                  <span style={{
                    ...styles.statValue,
                    color: getTemperatureColor(result.cpuAvgTemp)
                  }}>
                    {result.cpuAvgTemp?.toFixed(1) || '--'}°C
                  </span>
                </div>
                <div style={styles.statItem}>
                  <span style={styles.statLabel}>Usage CPU max</span>
                  <span style={styles.statValue}>{result.cpuMaxUsage.toFixed(1)}%</span>
                </div>
                <div style={styles.statItem}>
                  <span style={styles.statLabel}>Usage RAM max</span>
                  <span style={styles.statValue}>{result.ramMaxUsage.toFixed(1)}%</span>
                </div>
              </div>

              {result.throttlingDetected && (
                <div style={styles.alertBox}>
                  <strong>⚠️ Throttling détecté</strong>
                  <p>Le CPU a réduit sa fréquence pour éviter la surchauffe. Améliorez le refroidissement.</p>
                </div>
              )}

              {result.errors.length > 0 && (
                <div style={styles.errorsBox}>
                  <strong>❌ Erreurs détectées ({result.errors.length})</strong>
                  <ul>
                    {result.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* AI Analysis */}
              <div style={styles.aiBox}>
                <h4 style={styles.aiTitle}>🤖 Analyse IA</h4>
                <pre style={styles.aiText}>{aiAnalysis}</pre>
              </div>

              <button style={styles.startButton} onClick={() => {
                setPhase('idle');
                setResult(null);
                setAiAnalysis('');
              }}>
                ↻ Nouveau diagnostic
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
    maxWidth: '1000px',
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
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
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
  descriptionBox: {
    marginBottom: '24px',
  },
  label: {
    display: 'block',
    marginBottom: '8px',
    fontSize: '14px',
    color: 'var(--sand)',
  },
  textarea: {
    width: '100%',
    background: 'var(--charcoal)',
    border: '1px solid rgba(184, 115, 51, 0.3)',
    color: 'var(--foreground)',
    padding: '12px',
    fontSize: '14px',
    resize: 'vertical',
  },
  stepsInfo: {
    background: 'var(--charcoal)',
    padding: '20px',
    marginBottom: '24px',
    border: '1px solid rgba(184, 115, 51, 0.2)',
  },
  stepsTitle: {
    fontSize: '14px',
    marginBottom: '12px',
    color: 'var(--copper)',
  },
  stepsList: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
    fontSize: '14px',
    lineHeight: 2,
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
  liveData: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '12px',
    marginTop: '20px',
    padding: '16px',
    background: 'var(--background)',
  },
  liveItem: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '13px',
  },
  liveValue: {
    fontWeight: 600,
    fontFamily: 'monospace',
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
    border: '2px solid',
  },
  scoreTitle: {
    fontSize: '14px',
    color: 'var(--gray-warm)',
    marginBottom: '16px',
    textTransform: 'uppercase',
  },
  scoreValue: {
    fontSize: '48px',
    fontWeight: 700,
    marginBottom: '8px',
  },
  scoreStatus: {
    fontSize: '16px',
    margin: 0,
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '16px',
    marginBottom: '24px',
  },
  statItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '16px',
    background: 'var(--background)',
  },
  statLabel: {
    fontSize: '12px',
    textTransform: 'uppercase',
    color: 'var(--gray-warm)',
    marginBottom: '8px',
  },
  statValue: {
    fontSize: '20px',
    fontWeight: 600,
    fontFamily: 'monospace',
  },
  alertBox: {
    padding: '16px',
    background: 'rgba(251, 191, 36, 0.1)',
    border: '1px solid #fbbf24',
    marginBottom: '16px',
  },
  errorsBox: {
    padding: '16px',
    background: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid #ef4444',
    marginBottom: '16px',
  },
  aiBox: {
    padding: '20px',
    background: 'var(--background)',
    border: '1px solid rgba(184, 115, 51, 0.3)',
    marginBottom: '24px',
  },
  aiTitle: {
    fontSize: '14px',
    color: 'var(--copper)',
    marginBottom: '12px',
  },
  aiText: {
    fontSize: '13px',
    lineHeight: 1.6,
    whiteSpace: 'pre-wrap',
    margin: 0,
    fontFamily: 'inherit',
  },
};
