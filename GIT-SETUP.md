# Configuration Git pour ITCoreX Tools

## 🔴 Erreur : "Password authentication is not supported"

GitHub n'accepte plus les mots de passe depuis 2021. Il faut utiliser un **Token** ou **SSH**.

---

## ✅ Solution 1 : Personal Access Token (Plus simple)

### Étape 1 : Créer un token sur GitHub
1. Allez sur https://github.com/settings/tokens
2. Cliquez **"Generate new token (classic)"**
3. Cochez les permissions : `repo` (full control)
4. Cliquez **"Generate token"**
5. **Copiez le token** (il s'affiche une seule fois !)

### Étape 2 : Configurer Git sur votre Mac
```bash
cd /Users/admin/Documents/Web\ Developpement/ITCoreX/desktop-apps

# Supprimer l'ancienne remote
git remote remove origin

# Ajouter avec le token (remplacez VOTRE_TOKEN par le token copié)
git remote add origin https://picotmaxime-pro:VOTRE_TOKEN@github.com/picotmaxime-pro/itcorex-tools.git

# Vérifier
git remote -v

# Pousser
git push -u origin main
```

---

## ✅ Solution 2 : SSH (Plus sécurisé)

### Étape 1 : Générer une clé SSH
```bash
# Générer la clé
ssh-keygen -t ed25519 -C "votre.email@exemple.com"

# Appuyez sur Entrée pour accepter le chemin par défaut
# Laissez la passphrase vide (ou mettez-en une si vous voulez)

# Démarrer l'agent SSH
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/id_ed25519
```

### Étape 2 : Ajouter la clé sur GitHub
```bash
# Copier la clé publique
cat ~/.ssh/id_ed25519.pub
```
Copiez le résultat (commence par `ssh-ed25519`)

1. Allez sur https://github.com/settings/keys
2. Cliquez **"New SSH key"**
3. Titre : `MacBook ITCoreX`
4. Collez la clé dans "Key"
5. Cliquez **"Add SSH key"**

### Étape 3 : Configurer le repo
```bash
cd /Users/admin/Documents/Web\ Developpement/ITCoreX/desktop-apps

# Supprimer l'ancienne remote
git remote remove origin

# Ajouter avec SSH
git remote add origin git@github.com:picotmaxime-pro/itcorex-tools.git

# Tester la connexion
ssh -T git@github.com
# Vous devriez voir : "Hi picotmaxime-pro! You've successfully authenticated..."

# Pousser
git push -u origin main
```

---

## ✅ Solution 3 : GitHub Desktop (Très simple)

Si les commandes sont compliquées :

1. Téléchargez **GitHub Desktop** : https://desktop.github.com
2. Connectez-vous avec votre compte GitHub
3. Cliquez **"Add"** → **"Add Existing Repository"**
4. Sélectionnez le dossier `desktop-apps`
5. Publiez le repo en cliquant sur **"Publish repository"**

---

## 🔧 Commandes utiles

### Vérifier l'état de Git
```bash
git status
git remote -v
git log --oneline -5
```

### Si "remote origin already exists"
```bash
git remote remove origin
git remote add origin https://github.com/picotmaxime-pro/itcorex-tools.git
```

### Si le dossier n'est pas un repo Git
```bash
cd /Users/admin/Documents/Web\ Developpement/ITCoreX/desktop-apps
git init
git add .
git commit -m "Initial commit"
# Puis suivre Solution 1 ou 2 ci-dessus
```

### Stocker les credentials (éviter de retaper le token)
```bash
git config --global credential.helper osxkeychain
```

---

## 🚀 Prochaines étapes après Git configuré

Une fois Git fonctionnel :

```bash
# Pousser le code
git push -u origin main

# Sur GitHub, allez dans Actions → le build se lance automatiquement
# En ~10 minutes, téléchargez les 3 fichiers (.exe, .dmg, .AppImage)
```

Les fichiers générés par GitHub Actions sont **100% fonctionnels** (contrairement aux builds cross-platform Mac→Windows).
