#!/bin/bash
# Script pour réparer l'application sur Mac (Gatekeeper)

echo "🔧 Réparation de ITCoreXTools pour macOS..."

APP_PATH="$1"

if [ -z "$APP_PATH" ]; then
    # Cherche l'app dans les emplacements courants
    if [ -d "/Applications/ITCoreXTools.app" ]; then
        APP_PATH="/Applications/ITCoreXTools.app"
    elif [ -d "$HOME/Downloads/ITCoreXTools.app" ]; then
        APP_PATH="$HOME/Downloads/ITCoreXTools.app"
    else
        echo "❌ App ITCoreXTools non trouvée"
        echo "Usage: ./fix-mac-gatekeeper.sh /chemin/vers/ITCoreXTools.app"
        exit 1
    fi
fi

if [ ! -d "$APP_PATH" ]; then
    echo "❌ App non trouvée: $APP_PATH"
    exit 1
fi

echo "📍 App trouvée: $APP_PATH"

# Supprime les attributs étendus (quarantine)
echo "🧹 Suppression des attributs de quarantaine..."
sudo xattr -cr "$APP_PATH"

# Autorise l'ouverture
echo "🔓 Autorisation de l'ouverture..."
sudo xattr -d com.apple.quarantine "$APP_PATH" 2>/dev/null || true

# Signe ad-hoc l'application (pour macOS récents)
echo "✍️  Signature de l'application..."
sudo codesign --force --deep --sign - "$APP_PATH"

echo ""
echo "✅ ITCoreXTools est maintenant prêt à lancer !"
echo ""
echo "💡 Pour lancer :"
echo "   - Double-clique sur l'app, ou"
echo "   - Clic droit → Ouvrir"
echo ""
echo "⚠️  Si macOS demande confirmation :"
echo "   Préférences Système → Sécurité → 'Ouvrir quand même'"
