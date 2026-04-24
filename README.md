# ITCoreX Desktop Applications

Applications de bureau **PerfLab-IT** et **DoctoLab-IT** pour l'analyse matérielle.

## 🚀 Architecture

- **Framework:** Electron 28
- **Frontend:** React 18 + TypeScript
- **Backend:** Node.js (main process)
- **Analyse matérielle:** systeminformation
- **Bundler:** Webpack 5

## 📁 Structure

```
desktop-apps/
├── src/
│   ├── main.ts                 # Processus principal Electron
│   ├── preload.ts              # Bridge sécurisé IPC
│   ├── core/
│   │   ├── hardware-analyzer.ts # Analyse matérielle complète
│   │   ├── benchmark-engine.ts  # Moteur de benchmark
│   │   └── stress-test.ts      # Stress test CPU/RAM
│   ├── shared/
│   │   ├── types.ts            # Types partagés
│   │   └── styles.css          # Styles ITCoreX
│   ├── perflab/
│   │   ├── App.tsx             # Interface PerfLab-IT
│   │   ├── index.tsx           # Entry point
│   │   └── index.html
│   └── doctolab/
│       ├── App.tsx             # Interface DoctoLab-IT
│       ├── index.tsx           # Entry point
│       └── index.html
├── assets/                     # Icônes et ressources
├── build/                      # Output compilation
└── dist/                       # Packages finaux
```

## 🛠️ Installation

```bash
cd desktop-apps
npm install
```

## 🔧 Développement

### Lancer PerfLab-IT:
```bash
npm run dev:perflab
```

### Lancer DoctoLab-IT:
```bash
npm run dev:doctolab
```

### Compiler:
```bash
npm run build
```

## 📦 Packaging

### Générer tous les packages:
```bash
npm run dist
```

### Windows uniquement (.exe):
```bash
npm run dist:win
```

### macOS uniquement (.dmg):
```bash
npm run dist:mac
```

### Linux uniquement (AppImage):
```bash
npm run dist:linux
```

## 🎯 Fonctionnalités

### PerfLab-IT
- Analyse complète du matériel (CPU, GPU, RAM, Storage)
- Benchmark CPU single/multi-core
- Benchmark RAM (lecture/écriture)
- Benchmark Storage (estimation)
- Scoring et génération de rapports
- Upload des résultats vers ITCoreX

### DoctoLab-IT
- Scan matériel complet
- Stress test CPU (5 minutes)
- Surveillance thermique en temps réel
- Détection de throttling
- Analyse IA des résultats
- Génération de recommandations
- Upload du rapport vers ITCoreX

## 🔌 API IPC

### Hardware
- `hardware:getSystemInfo` - Informations système complètes
- `hardware:getCPUInfo` - Détails CPU + load
- `hardware:getGPUInfo` - Informations GPU
- `hardware:getRAMInfo` - Informations mémoire
- `hardware:getStorageInfo` - Disques et filesystems
- `hardware:getTemperatures` - Températures (si disponibles)

### Benchmark
- `benchmark:start(options)` - Démarrer le benchmark
- `benchmark:stop()` - Arrêter le benchmark
- `benchmark:progress` - Événement de progression

### Stress Test
- `stresstest:start(duration)` - Démarrer le stress test
- `stresstest:stop()` - Arrêter le stress test
- `stresstest:data` - Données en temps réel

### Rapports
- `report:generate(data)` - Générer un rapport JSON
- `report:upload(reportData)` - Uploader vers le serveur

## 🎨 Design System

Palette de couleurs ITCoreX:
- Background: #1a1612
- Copper (primary): #b87333
- Gold: #c5a572
- Sand: #c9b896
- Cream: #f7f3eb
- Charcoal: #2a2420

## 📝 Notes

- Les applications utilisent `systeminformation` pour l'analyse matérielle
- Le stress test utilise des workers JavaScript intensifs
- Les benchmarks sont simulés (CPU/RAM) ou estimés (Storage) pour la sécurité
- L'upload de rapports est simulé (à connecter à l'API ITCoreX en production)

## � Mise sur GitHub (pour builds automatiques)

### Prérequis
- Compte GitHub
- Git installé sur ton Mac

### Étapes

1. **Créer un repo sur GitHub** (sans README)
   - Va sur github.com → New Repository
   - Nom: `ITCoreXTools`
   - Public ou Private
   - NE PAS cocher "Initialize with README"
   - Clique "Create repository"

2. **Initialiser le repo local**
```bash
cd /Users/admin/Documents/Web\ Developpement/ITCoreX/desktop-apps
git init
git add .
git commit -m "Initial commit"
```

3. **Connecter à GitHub**
```bash
# Remplace USERNAME par ton nom GitHub
git remote add origin https://github.com/USERNAME/ITCoreXTools.git
git branch -M main
git push -u origin main
```

4. **Vérifier GitHub Actions**
   - Va sur ton repo GitHub → onglet "Actions"
   - Tu devrais voir le workflow "Build and Release" démarrer automatiquement
   - Attends ~10-15 minutes
   - Va dans l'onglet "Actions" → dernier run → "Artifacts"
   - Télécharge `build-windows-latest` qui contient le `.exe`

### Alternative : ZIP + Upload manuel (si Git ne marche pas)

1. Sur GitHub, crée un repo vide
2. Sur ton Mac, supprime les dossiers inutiles :
   ```bash
   cd desktop-apps
   rm -rf node_modules dist build
   ```
3. Crée un ZIP du dossier `desktop-apps` SANS ces dossiers
4. Sur GitHub, clique "Uploading an existing file"
5. Glisse-dépose le ZIP (une fois dézippé localement, upload dossier par dossier)
   
   **OU** utilise l'interface GitHub Desktop qui est plus simple

## �👤 Auteur

**ITCoreX** — PICOT Maxime (Tomyshiro)

## 📄 Licence

MIT
