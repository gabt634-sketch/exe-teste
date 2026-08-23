# Widget Météo pour Scriptable (iOS)

Un widget météo pour l'écran d'accueil de l'iPhone, en trois tailles.
Aucun Mac, aucun Xcode et aucune clé API ne sont nécessaires.

Données fournies par [Open-Meteo](https://open-meteo.com) — gratuit et sans inscription.

## Installation

1. **Installe l'app Scriptable** depuis l'App Store (gratuite).
2. **Ouvre `meteo-widget.js`** et copie tout son contenu.
3. Dans Scriptable, appuie sur **+** en haut à droite pour créer un script,
   colle le code, puis renomme le script **Météo**
   (appui sur le titre en haut → *Rename*).
4. Lance le script une fois depuis l'app (bouton ▶ en bas). iOS demandera
   l'autorisation de localisation : accepte, sinon le widget ne saura pas où tu es.
5. Reviens à l'écran d'accueil, **appui long** sur le fond → **+** en haut à gauche
   → cherche **Scriptable** → choisis la taille voulue → **Ajouter le widget**.
6. **Appui long sur le widget** → *Modifier le widget* :
   - **Script** : sélectionne *Météo*
   - **When Interacting** : *Run Script*

## Choisir une ville fixe

Par défaut le widget suit ta position GPS. Pour l'épingler sur une ville :

> Appui long sur le widget → *Modifier le widget* → champ **Paramètre** → écris le
> nom de la ville, par exemple `Lyon` ou `Montréal`.

Pratique pour placer deux widgets côte à côte : un en GPS, un sur une autre ville.

## Ce qu'affiche chaque taille

| Taille | Contenu |
|---|---|
| **Petit** | Ville, température actuelle, conditions, min/max du jour |
| **Moyen** | Idem + les 5 prochaines heures |
| **Grand** | Idem + ressenti, humidité, vent, 6 heures et 4 jours de prévisions |

## Réglages

Tout se règle dans le bloc `CONFIG` en haut du fichier :

| Réglage | Rôle | Défaut |
|---|---|---|
| `unites` | `"metrique"` (°C, km/h) ou `"imperial"` (°F, mph) | `"metrique"` |
| `villeParDefaut` | Ville de repli si le GPS est indisponible | `"Paris"` |
| `minutesAvantRafraichissement` | Fréquence de mise à jour souhaitée | `30` |
| `heuresAffichees` | Colonnes horaires du widget moyen | `5` |
| `joursAffiches` | Lignes journalières du widget grand | `4` |

## Bon à savoir

- **Le fond change** selon la météo et l'heure : bleu clair au soleil, sombre la nuit,
  gris à la pluie, etc.
- **Hors ligne**, le widget affiche les dernières données connues avec la mention
  *« Hors ligne »* et l'heure du dernier relevé, au lieu de rester vide.
- **La fréquence de rafraîchissement est décidée par iOS**, pas par le script :
  `minutesAvantRafraichissement` est une demande, le système peut l'espacer selon
  la batterie et ton usage. Un appui sur le widget force une mise à jour.

## Si ça ne marche pas

| Symptôme | Cause probable |
|---|---|
| « Météo indisponible » | Localisation refusée → Réglages → Scriptable → Position → *Toujours* |
| Ville affichée « Ma position » | Le géocodage inverse a échoué ; les données météo restent correctes |
| Widget figé sur une vieille heure | iOS a mis les mises à jour en pause ; appuie sur le widget |
| Mauvaise ville | Précise davantage le paramètre, par exemple `Saint-Denis, Réunion` |
