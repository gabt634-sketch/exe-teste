# Météo — widget Scriptable, style « trou noir »

Widget météo pour l'écran d'accueil de l'iPhone, né du mélange de trois références :

- **la photo du trou noir** — noir absolu, monochrome blanc, dôme sombre cerclé de
  lumière et disque d'accrétion en filaments ;
- **!Boring Weather** — la bande des jours en bas : libellé, icône, maximum en gras,
  minimum estompé ;
- **le site Active Theory de la vidéo** — la matière générative en mouvement, reprise
  dans la vue plein écran : 520 particules sur orbites képlériennes, traînées de
  lumière, effet de phare sur le côté qui s'approche.

Un appui sur le widget ouvre une **vue plein écran interactive** : on fait glisser le
doigt sur la frise et l'heure visée s'affiche en très grand, la température juste
dessous avec les conditions. Pendant le glissement la lecture grossit, le reste
s'efface, et les chiffres défilent comme un compteur, dans le sens du doigt.

**La météo entre dans la scène, en couleur**, dans le widget comme dans la vue :
le soleil se tient au-dessus du trou noir, la pluie tombe dessus et se fait happer,
l'éclair descend jusque dans le disque. Le disque, lui, reste blanc mais prend la
teinte du temps — doré au soleil, bleu sous la pluie, violet à l'orage.

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

## Les sept temps

Le même vocabulaire pilote le fond du widget, fixe, et le disque animé de la vue.

| Temps | Dans le ciel | Ce qui tombe | Teinte du disque |
|---|---|---|---|
| Ciel dégagé | Le soleil, doré | — | Doré, traînées longues |
| Nuit claire | La lune en croissant | — | Bleu pâle, assombri |
| Voilé | Le soleil derrière un nuage | — | Doré adouci |
| Couvert | Un banc de 5 nuages gris | — | Gris, matière plus rare |
| Brouillard | — | Nappes lentes | Gris-bleu, trait épaissi |
| Pluie | Un banc de 4 nuages bleus | Gouttes happées par le trou | Bleu, éclat retenu |
| Neige | Un banc de 4 nuages clairs | Flocons qui s'incurvent | Blanc-cyan, presque immobile |
| Orage | Un banc de 4 nuages violets | Pluie, et un éclair | Violet, rotation vive |

Les nuages dérivent lentement et se rebouclent hors cadre. Ils s'estompent vers la
gauche, là où se lisent l'heure et la température : un banc opaque derrière le grand
chiffre le rendrait sourd.

Ce qui tombe est attiré par le trou noir selon une loi en 1/d² : les gouttes, lourdes,
plongent droit dessus ; les flocons, plus légers, tombent d'abord et ne s'incurvent
qu'en approchant. Une goutte avalée fait courir une lueur le long de l'anneau.
La météo s'éteint au niveau du disque : elle ne déborde jamais sur la bande des
jours ni sur la frise.

La nuit assombrit chaque temps d'environ 42 %. À météo égale, le fond du widget est
toujours dessiné à l'identique : il ne scintille pas entre deux rafraîchissements.

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
