# Météo — widget Scriptable, style « trou noir »

Widget météo pour l'écran d'accueil de l'iPhone, né du mélange de trois références :

- **la photo du trou noir** — noir absolu, monochrome blanc, dôme sombre cerclé de
  lumière et disque d'accrétion en filaments ;
- **!Boring Weather** — la bande des jours en bas : libellé, icône, maximum en gras,
  minimum estompé ;
- **le site Active Theory de la vidéo** — la matière générative en mouvement, reprise
  dans la vue plein écran : 520 particules sur orbites képlériennes, traînées de
  lumière, effet de phare sur le côté qui s'approche.

Un appui sur le widget ouvre cette **vue plein écran interactive** : on fait glisser
le doigt sur la frise et la température se met à jour heure par heure, sur 48 heures.
Le disque réagit à la météo de l'heure visée — vif et rapide par ciel dégagé, lent et
diffus dans le brouillard, avec des éclairs pendant l'orage.

Données : [Open-Meteo](https://open-meteo.com) — gratuit, sans clé API.

## Installation

1. **Installe Scriptable** depuis l'App Store (gratuit).
2. Copie tout le contenu de `meteo-widget.js`.
3. Dans Scriptable : **+** en haut à droite → colle le code → renomme le script
   **Météo** (appui sur le titre → *Rename*).
4. Lance-le une fois (▶) et accepte la demande de localisation.
   La vue interactive s'ouvre : c'est normal, c'est elle que le widget appellera.
5. Écran d'accueil → appui long → **+** → **Scriptable** → choisis la taille → *Ajouter*.
6. Appui long sur le widget → *Modifier le widget* :
   - **Script** : *Météo*
   - **When Interacting** : *Run Script* ← indispensable pour la vue interactive

## Ce qu'affiche chaque taille

| Taille | Contenu |
|---|---|
| **Petit** | Ville, température, conditions, maximum et minimum |
| **Moyen** | Idem + bande de 6 jours en bas |
| **Grand** | Idem + ressenti, humidité, vent, courbe des 24 h, bande de 8 jours |

## Choisir une ville fixe

Par défaut le widget suit le GPS. Pour l'épingler :

> Appui long sur le widget → *Modifier le widget* → champ **Paramètre** → `Lyon`

Pratique pour poser deux widgets côte à côte, un en GPS et un sur une autre ville.

## Réglages

Dans le bloc `CONFIG` en haut du fichier :

| Réglage | Rôle | Défaut |
|---|---|---|
| `unites` | `"metrique"` (°C, km/h) ou `"imperial"` (°F, mph) | `"metrique"` |
| `villeParDefaut` | Ville de repli si le GPS est indisponible | `"Paris"` |
| `minutesAvantRafraichissement` | Fréquence de mise à jour souhaitée | `30` |
| `joursAffiches` | Colonnes de la bande des jours (widget grand) | `8` |
| `heuresGraphe` | Portée de la courbe du widget grand | `24` |
| `apercuWidget` | `true` = ouvrir l'aperçu du widget plutôt que la vue interactive | `false` |

## Pourquoi le glissement n'est pas dans le widget lui-même

Un widget d'écran d'accueil iOS est une **image figée**, pas une page vivante : le
système en réclame un rendu de temps en temps et l'affiche tel quel. Depuis iOS 17
les widgets acceptent des boutons et des interrupteurs, mais uniquement via des
App Intents compilés dans une application — Scriptable ne les expose pas, et aucun
widget ne peut suivre un doigt qui glisse.

Le glissement vit donc dans la vue plein écran, à un appui de distance : le widget
affiche l'instant présent, l'appui ouvre la frise des 48 heures. C'est la seule voie
possible sans passer par Xcode et une vraie application.

## Les sept ambiances du disque

L'aspect du disque est piloté par la météo de l'heure affichée : vitesse de rotation,
densité de matière, éclat, longueur des traînées et épaisseur du trait.

| Ambiance | Allure |
|---|---|
| Ciel dégagé | Rapide, traînées longues, éclat maximal |
| Voilé | Légèrement ralenti et adouci |
| Couvert | Matière plus rare, lumière assourdie |
| Brouillard | Très lent, trait épais et diffus |
| Pluie | Traînées longues, éclat retenu |
| Neige | Presque immobile, matière dense et douce |
| Orage | Rotation vive, traînées maximales, éclairs |

La nuit assombrit l'ensemble d'environ 45 %.

## Bon à savoir

- **Hors ligne**, le widget affiche le dernier relevé connu avec la mention
  *HORS LIGNE* et son heure, au lieu de rester vide.
- **La fréquence de rafraîchissement appartient à iOS**, pas au script :
  `minutesAvantRafraichissement` est une demande que le système peut espacer selon
  la batterie et l'usage. Un appui sur le widget force une mise à jour.
- **Pour revoir l'aperçu du widget** depuis l'app plutôt que la vue interactive,
  passe `apercuWidget` à `true`.

## Si ça ne marche pas

| Symptôme | Cause probable |
|---|---|
| « MÉTÉO INDISPONIBLE » | Localisation refusée → Réglages → Scriptable → Position → *Toujours* |
| Ville affichée « MA POSITION » | Géocodage inverse en échec ; les données météo restent correctes |
| L'appui n'ouvre pas la frise | *Modifier le widget* → **When Interacting** → *Run Script* |
| Widget figé sur une vieille heure | iOS a suspendu les mises à jour ; appuie sur le widget |
| Mauvaise ville | Précise le paramètre, par exemple `Saint-Denis, Réunion` |
