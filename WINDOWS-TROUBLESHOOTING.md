# Problème : L'exe Windows ne se lance pas (crash silencieux)

## 🔴 Symptômes
- Double-clic sur `.exe` → rien ne se passe
- Pas de fenêtre
- Pas de processus dans le gestionnaire de tâches
- Aucun message d'erreur

## 🎯 Causes probables

### Cause 1 : Modules natifs non recompilés (LE PLUS COURANT)
**systeminformation** utilise des modules natifs qui doivent être compilés pour Windows.
Un build sur Mac → Windows ne fonctionne pas pour les modules natifs.

**Solution :** Utiliser la version **portable sans systeminformation** ou build natif Windows.

### Cause 2 : Fichier icône manquant (FIXÉ)
L'app cherchait `assets/icon.png` qui n'existait pas.
→ J'ai retiré la référence à l'icône dans `main.ts`

### Cause 3 : APP_TARGET non défini
L'app utilise une variable d'environnement pour choisir PerfLab vs DoctoLab.
Dans l'exe packagé, cette variable n'existe pas → défaut à 'perflab'.

**Solution :** Modifier main.ts pour forcer une cible ou créer 2 exes séparés.

---

## ✅ Solutions

### Solution 1 : Tester sans systeminformation (Debug)

Modifiez temporairement le code pour voir si c'est le module natif qui cause le crash :

```typescript
// Dans src/main.ts, commentez temporairement:
// import { HardwareAnalyzer } from './core/hardware-analyzer';
// import { BenchmarkEngine, BenchmarkProgress } from './core/benchmark-engine';
// import { StressTest, StressTestData } from './core/stress-test';

// Et dans le constructor:
// this.hardwareAnalyzer = new HardwareAnalyzer();
// this.benchmarkEngine = new BenchmarkEngine();
// this.stressTest = new StressTest();

// Et dans setupIPC, retournez des données fictives
```

Puis rebuild :
```bash
npm run build
npm run dist:win
```

Si ça marche → le problème est **systeminformation**.

### Solution 2 : Build natif Windows (RECOMMANDÉ)

Le seul moyen d'avoir un exe 100% fonctionnel : compiler sur Windows.

**Avec un PC Windows :**
```powershell
# Sur PC Windows
git clone https://github.com/picotmaxime-pro/itcorex-tools.git
cd itcorex-tools
npm install
npm run build
npm run dist:win
```

**Avec GitHub Actions (Gratuit) :**
Configurez Git (voir GIT-SETUP.md) et poussez sur GitHub. Le workflow génère automatiquement un exe Windows fonctionnel.

### Solution 3 : Version "Web-only" (sans hardware detection)

Créez une version allégée sans les modules natifs pour Windows :

**Créer `src/main-simple.ts` :**
```typescript
import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';

const appTarget = process.env.APP_TARGET || 'perflab';

async function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Charger une page web externe ou locale simplifiée
  await mainWindow.loadURL('https://itcorex.fr/perflab');
}

app.whenReady().then(createWindow);
```

Puis packagez cette version simple.

---

## 🔧 Diagnostic avancé

### Voir les logs de crash Windows

Sur votre PC Windows :

1. **Ouvrir l'invite de commandes** (cmd.exe)
2. **Naviguer vers le dossier** de l'exe :
   ```cmd
   cd C:\Users\[VOTRE_NOM]\Downloads
   ```
3. **Lancer l'exe depuis le terminal** :
   ```cmd
   ITCoreXTools-1.0.0-win.exe
   ```

Vous verrez les erreurs dans la console si l'app crash.

### Vérifier les dépendances manquantes

Sur Windows, utilisez **Dependency Walker** ou **Dependencies** (GitHub lucasg/Dependencies) pour voir quelles DLL manquent.

---

## 📋 Résumé des options

| Méthode | Résultat | Complexité |
|---------|----------|------------|
| Build Mac→Win portable | ⚠️ Crash silencieux (modules natifs) | Facile mais buggé |
| Build Mac→Win sans systeminfo | ✅ Fonctionne mais limité | Moyen |
| Build natif Windows | ✅ Parfait | Nécessite PC Windows |
| GitHub Actions | ✅ Parfait | Setup Git complexe |

---

## 🚀 Solution immédiate recommandée

1. **Pour Mac** : Utilisez votre `.dmg` → fonctionne parfaitement

2. **Pour Windows** : 
   - Option A : Configurez GitHub Actions (une fois, puis builds automatiques parfaits)
   - Option B : Demandez à quelqu'un avec un PC Windows de compiler
   - Option C : Créez une version web simplifiée pour Windows

3. **Pour Linux** : L'AppImage générée sur Mac fonctionne généralement bien

---

## 💡 Conseil technique

Le problème fondamental est que **`systeminformation`** compile du code C++ natif pour interroger le hardware. Ce code doit être compilé :
- Sur Mac → pour Mac ✅
- Sur Windows → pour Windows ❌ (impossible depuis Mac)

**Pourquoi le .dmg marche mais pas l'exe ?**
- Mac→Mac : même architecture, modules natifs compatibles
- Mac→Windows : architectures différentes, modules natifs incompatibles

La seule vraie solution : compiler sur Windows ou utiliser GitHub Actions.
