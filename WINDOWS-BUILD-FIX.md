# Fix pour l'erreur Windows "ITCoreXTools ne peut pas être fermé"

## 🔴 Problème
L'exe généré sur Mac ne fonctionne pas sur Windows :
- "ITCoreX Tools ne peut pas être fermé"
- "Échec de désinstallation des anciens fichiers"

## ✅ Solutions

### Solution 1 : Nettoyer et régénérer (essayez d'abord)

Sur votre Mac :
```bash
cd /Users/admin/Documents/Web\ Developpement/ITCoreX/desktop-apps

# Nettoyer complètement
rm -rf dist/
npm run build

# Générer un build Windows propre  
npm run dist:win
```

Sur Windows (avant d'installer le nouvel exe) :
1. Ouvrir le **Gestionnaire des tâches** (Ctrl+Shift+Esc)
2. Chercher "ITCoreX" ou "Electron" dans les processus
3. Tuer tous les processus trouvés
4. Supprimer le dossier d'installation précédent :
   - `C:\Users\[VOTRE_NOM]\AppData\Local\ITCoreXTools`
   - `C:\Program Files\ITCoreXTools` (si existant)

### Solution 2 : Utiliser le Portable (plus simple)

Le build génère aussi une version **portable** :
- Fichier : `ITCoreXTools-1.0.0-win.exe` (sans "Setup")
- Aucune installation requise
- Décompressez et lancez directement

### Solution 3 : Build natif sur Windows (RECOMMANDÉ)

Pour un exe 100% fonctionnel, compilez sur Windows :

**Option A - GitHub Actions** (Gratuit, voir BUILD-GUIDE.md)

**Option B - PC Windows avec Node.js** :
```powershell
# Sur un PC Windows
git clone https://github.com/picotmaxime-pro/itcorex-tools.git
cd itcorex-tools
npm install
npm run build
npm run dist:win
```

### Solution 4 : Mode développement sur Windows

Si vous avez besoin de tester rapidement :
```powershell
# Sur Windows
npm install
cd desktop-apps
npm run build:perflab
APP_TARGET=perflab npx electron build/main.js
```

## 🔧 Changements appliqués

J'ai modifié `package.json` pour :
1. **Supprimer l'espace** dans le nom : `ITCoreX Tools` → `ITCoreXTools`
2. **Ajouter config NSIS** pour installation propre
3. **Ajouter niveau d'exécution** `asInvoker` (pas besoin d'admin)

## 📋 Commandes de build

| Commande | Fichier généré | Usage |
|----------|---------------|-------|
| `npm run dist:mac` | `.dmg` | Mac natif ✅ |
| `npm run dist:win` | `-Setup.exe` | Installeur Windows ⚠️ |
| `npm run dist:win` | `-win.exe` | Version portable Windows ✅ |
| `npm run dist:linux` | `.AppImage` | Linux |

## 🚀 Recommandation finale

**Pour déployer rapidement :**
1. Utilisez le **.dmg** sur Mac (fonctionne parfaitement)
2. Utilisez la version **portable** (`-win.exe`) sur Windows
3. Pour un installeur Windows propre → GitHub Actions ou build sur PC Windows

Les builds cross-platform Mac→Windows sont connus pour être instables. La version portable est généralement plus fiable.
