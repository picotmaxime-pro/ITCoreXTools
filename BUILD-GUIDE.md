# Guide de Build - ITCoreX Tools

Comment générer les fichiers .exe, .dmg et .AppImage

## 📦 Méthode 1 : GitHub Actions (RECOMMANDÉ)

La méthode la plus simple et gratuite. Les builds se font automatiquement sur les serveurs de GitHub.

### Étapes:

1. **Créer un repo GitHub** pour `desktop-apps`
   ```bash
   cd /Users/admin/Documents/Web\ Developpement/ITCoreX/desktop-apps
   git init
   git add .
   git commit -m "Initial commit"
   ```

2. **Créer le repo sur GitHub** (via l'interface web)

3. **Pousser le code:**
   ```bash
   git remote add origin https://github.com/VOTRE-USERNAME/itcorex-tools.git
   git push -u origin main
   ```

4. **Attendre le build:**
   - Allez dans l'onglet **Actions** du repo GitHub
   - Le workflow se lance automatiquement
   - En ~10 minutes, vous avez les 3 fichiers dans **Artifacts**

---

## 🍎 Méthode 2 : Build local sur Mac (dmg uniquement)

Pour générer juste le .dmg pour macOS:

```bash
cd /Users/admin/Documents/Web\ Developpement/ITCoreX/desktop-apps

# Installation des dépendances
npm install

# Build et packaging
npm run dist:mac
```

**Résultat:** `dist/ITCoreX Tools-1.0.0.dmg`

---

## 🌐 Méthode 3 : Cross-platform avec Wine (expérimental)

Sur Mac, vous pouvez tenter de générer tous les formats:

```bash
# Installer Wine (si pas déjà fait)
brew install --cask wine-stable
brew install mono

# Build tout
npm run dist
```

**⚠️ Avertissements:**
- Long et complexe sur Mac Silicon (M1/M2/M3)
- Nécessite Rosetta pour certains outils
- Peut échouer sur les builds Windows

---

## 📋 Résumé des scripts disponibles

| Commande | Description |
|----------|-------------|
| `npm run dist:mac` | Génère .dmg (Mac uniquement) |
| `npm run dist:win` | Génère .exe (nécessite Windows ou Wine) |
| `npm run dist:linux` | Génère .AppImage (Linux ou Docker) |
| `npm run dist` | Génère tous les formats (cross-platform) |

---

## 🔧 Problèmes courants

### "Wine not found" sur Mac
```bash
# Solution rapide : installer via Homebrew
brew install --cask wine-stable
```

### "Cannot find module" lors du build
```bash
# Réinstaller les dépendances
rm -rf node_modules package-lock.json
npm install
```

### Build Windows échoue sur Mac M1/M2/M3
C'est normal. Utilisez GitHub Actions ou une VM Windows.

---

## 📤 Distribution

Une fois les fichiers générés:

1. **Upload vers votre site:**
   - Placer les fichiers dans `/my-app/public/downloads/`
   - Ou héberger sur un CDN (Cloudflare, AWS S3)

2. **Mettre à jour les liens:**
   Modifier les URLs dans:
   - `/my-app/src/app/perflab/page.tsx`
   - `/my-app/src/app/doctolab/page.tsx`

---

## 💡 Recommandation finale

**Pour un projet sérieux:**
1. Utilisez **GitHub Actions** pour les builds automatisés
2. Créez des **Releases GitHub** avec les fichiers attachés
3. Les liens de téléchargement pointeront vers les releases

Exemple de release: `https://github.com/USER/REPO/releases/download/v1.0.0/ITCoreX-Tools-1.0.0.dmg`
