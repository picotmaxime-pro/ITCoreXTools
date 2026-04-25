ITCoreXTools - Installation Mac
================================

Si l'application ne s'ouvre pas ("is damaged"), voici la solution :

MÉTHODE 1 - Terminal (recommandée) :
-------------------------------------
1. Ouvre Terminal (Applications → Utilitaires)
2. Colle cette commande :

   sudo xattr -cr /Applications/ITCoreXTools.app

3. Entre ton mot de passe Mac
4. Relance l'application

MÉTHODE 2 - Clic droit :
------------------------
1. Trouve ITCoreXTools.app (Applications ou Downloads)
2. FAIS UN CLIC DROIT (pas clic normal)
3. Clique "Ouvrir"
4. Clique "Ouvrir" dans la boîte de dialogue

MÉTHODE 3 - Préférences Système :
---------------------------------
1. Essaye d'ouvrir l'app (ça va échouer)
2. Va dans : Préférences Système → Sécurité et confidentialité
3. En bas, clique sur "Ouvrir quand même"
4. Confirme

POURQUOI ?
----------
macOS bloque les apps non signées par un développeur Apple payant.
Cette app est signée "ad-hoc" (gratuit mais moins sécurisé selon Apple).

SUPPORT
-------
GitHub : https://github.com/picotmaxime-pro/ITCoreXTools
