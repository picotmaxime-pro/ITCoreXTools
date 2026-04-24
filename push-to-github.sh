#!/bin/bash

# Script pour pousser sur GitHub
# Remplacez TOKEN par votre vrai token GitHub

cd "/Users/admin/Documents/Web Developpement/ITCoreX/desktop-apps"

# Configuration git
git config user.email "maxime@itcorex.com"
git config user.name "Maxime PICOT"

# Supprimer remote existant
git remote remove origin 2>/dev/null

# Demander le token
echo "Entrez votre token GitHub (collez-le ici, il sera masqué):"
read -s TOKEN

echo ""
echo "Connexion à GitHub..."

# Ajouter le remote avec token
git remote add origin "https://${TOKEN}@github.com/picotmaxime-pro/ITCoreXTools.git"

# Push
git push -u origin main

echo ""
echo "Si ça a marché, vérifiez sur: https://github.com/picotmaxime-pro/ITCoreXTools"
