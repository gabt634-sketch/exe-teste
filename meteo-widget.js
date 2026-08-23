// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: light-blue; icon-glyph: cloud-sun;

// ───────────────────────────────────────────────────────────────
//  Widget Météo pour Scriptable (iOS / iPadOS)
//
//  Données : Open-Meteo — gratuit, aucune clé API à créer.
//  Tailles : petit, moyen et grand.
//  Position : GPS par défaut. Pour figer une ville, écris son nom
//  dans le champ « Paramètre » du widget (ex. : Lyon).
//  Fonctionne hors ligne : les dernières données sont mises en cache.
// ───────────────────────────────────────────────────────────────

const CONFIG = {
  unites: "metrique",       // "metrique" (°C, km/h) ou "imperial" (°F, mph)
  villeParDefaut: "Paris",  // utilisée seulement si le GPS est indisponible
  minutesAvantRafraichissement: 30,
  heuresAffichees: 5,       // colonnes horaires (widget moyen)
  joursAffiches: 4          // lignes journalières (widget grand)
}

// ── Cache local ────────────────────────────────────────────────

const fm = FileManager.local()
const dossierCache = fm.joinPath(fm.documentsDirectory(), "meteo-scriptable")
const fichierCache = fm.joinPath(dossierCache, "cache.json")

function lireCache() {
  try {
    if (!fm.fileExists(fichierCache)) return null
    return JSON.parse(fm.readString(fichierCache))
  } catch (e) {
    return null
  }
}

function ecrireCache(donnees, lieu) {
  try {
    if (!fm.fileExists(dossierCache)) fm.createDirectory(dossierCache, true)
    fm.writeString(fichierCache, JSON.stringify({ donnees, lieu }))
  } catch (e) {
    // Un cache non écrit n'est pas bloquant.
  }
}

// ── Codes météo WMO → libellé + icône SF Symbols ───────────────

function infoMeteo(code, estJour) {
  const j = estJour !== false
  const table = {
    0:  ["Ciel dégagé",           j ? "sun.max.fill"      : "moon.stars.fill"],
    1:  ["Peu nuageux",           j ? "sun.min.fill"      : "moon.fill"],
    2:  ["Partiellement nuageux", j ? "cloud.sun.fill"    : "cloud.moon.fill"],
    3:  ["Couvert",               "cloud.fill"],
    45: ["Brouillard",            "cloud.fog.fill"],
    48: ["Brouillard givrant",    "cloud.fog.fill"],
    51: ["Bruine légère",         "cloud.drizzle.fill"],
    53: ["Bruine",                "cloud.drizzle.fill"],
    55: ["Bruine dense",          "cloud.drizzle.fill"],
    56: ["Bruine verglaçante",    "cloud.sleet.fill"],
    57: ["Bruine verglaçante",    "cloud.sleet.fill"],
    61: ["Pluie faible",          "cloud.rain.fill"],
    63: ["Pluie",                 "cloud.rain.fill"],
    65: ["Forte pluie",           "cloud.heavyrain.fill"],
    66: ["Pluie verglaçante",     "cloud.sleet.fill"],
    67: ["Pluie verglaçante",     "cloud.sleet.fill"],
    71: ["Neige faible",          "cloud.snow.fill"],
    73: ["Neige",                 "cloud.snow.fill"],
    75: ["Forte neige",           "cloud.snow.fill"],
    77: ["Grains de neige",       "cloud.snow.fill"],
    80: ["Averses",               j ? "cloud.sun.rain.fill" : "cloud.moon.rain.fill"],
    81: ["Averses",               "cloud.rain.fill"],
    82: ["Fortes averses",        "cloud.heavyrain.fill"],
    85: ["Averses de neige",      "cloud.snow.fill"],
    86: ["Averses de neige",      "cloud.snow.fill"],
    95: ["Orage",                 "cloud.bolt.rain.fill"],
    96: ["Orage et grêle",        "cloud.bolt.rain.fill"],
    99: ["Orage et grêle",        "cloud.bolt.rain.fill"]
  }
  return table[code] || ["Météo indisponible", "questionmark.circle"]
}

function degrade(code, estJour) {
  if (estJour === false) return ["#0b1026", "#243b63"]
  if (code >= 95) return ["#2c3e50", "#55606d"]
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return ["#5b7a99", "#aac4da"]
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return ["#33566f", "#6d90aa"]
  if (code >= 45 && code <= 48) return ["#4b5563", "#889199"]
  if (code === 2 || code === 3) return ["#43678c", "#8ba7c0"]
  return ["#1f74c9", "#7ec4f2"]
}

// ── Localisation ───────────────────────────────────────────────

async function geocoder(nomVille) {
  const url = "https://geocoding-api.open-meteo.com/v1/search"
    + "?name=" + encodeURIComponent(nomVille)
    + "&count=1&language=fr&format=json"
  try {
    const requete = new Request(url)
    requete.timeoutInterval = 15
    const reponse = await requete.loadJSON()
    if (reponse && reponse.results && reponse.results.length > 0) {
      const r = reponse.results[0]
      return { lat: r.latitude, lon: r.longitude, nom: r.name }
    }
  } catch (e) {
    // On tombera sur la solution de repli.
  }
  return null
}

async function resoudreLieu() {
  const parametre = (args.widgetParameter || "").trim()
  if (parametre) {
    const lieu = await geocoder(parametre)
    if (lieu) return lieu
  }

  try {
    Location.setAccuracyToThreeKilometers()
    const position = await Location.current()
    let nom = "Ma position"
    try {
      const geo = await Location.reverseGeocodeLocation(position.latitude, position.longitude, "fr_FR")
      if (geo && geo.length > 0) {
        nom = geo[0].locality || geo[0].subAdministrativeArea || geo[0].administrativeArea || nom
      }
    } catch (e) {
      // Sans nom de ville on garde « Ma position ».
    }
    return { lat: position.latitude, lon: position.longitude, nom }
  } catch (e) {
    // GPS refusé ou indisponible.
  }

  const cache = lireCache()
  if (cache && cache.lieu) return cache.lieu

  const secours = await geocoder(CONFIG.villeParDefaut)
  if (secours) return secours

  throw new Error("Position introuvable")
}

// ── Récupération et mise en forme des données ──────────────────

async function recupererMeteo(lieu) {
  const params = [
    "latitude=" + lieu.lat.toFixed(4),
    "longitude=" + lieu.lon.toFixed(4),
    "current=temperature_2m,apparent_temperature,is_day,weather_code,relative_humidity_2m,wind_speed_10m",
    "hourly=temperature_2m,weather_code,is_day",
    "daily=weather_code,temperature_2m_max,temperature_2m_min",
    "timezone=auto",
    "forecast_days=5"
  ]
  if (CONFIG.unites === "imperial") {
    params.push("temperature_unit=fahrenheit", "wind_speed_unit=mph")
  }
  const requete = new Request("https://api.open-meteo.com/v1/forecast?" + params.join("&"))
  requete.timeoutInterval = 15
  return await requete.loadJSON()
}

function nomDuJour(dateISO, index) {
  if (index === 0) return "Auj."
  const jours = ["Dim.", "Lun.", "Mar.", "Mer.", "Jeu.", "Ven.", "Sam."]
  return jours[new Date(dateISO + "T12:00:00").getDay()]
}

function normaliser(json, lieu) {
  const actuel = json.current

  // Les horaires renvoyés sont locaux au lieu (timezone=auto), donc
  // une comparaison lexicographique sur les chaînes ISO suffit.
  let debut = json.hourly.time.findIndex(t => t > actuel.time)
  if (debut < 0) debut = 0

  const heures = []
  const fin = Math.min(debut + 6, json.hourly.time.length)
  for (let i = debut; i < fin; i++) {
    heures.push({
      label: json.hourly.time[i].slice(11, 13) + "h",
      temp: json.hourly.temperature_2m[i],
      symbole: infoMeteo(json.hourly.weather_code[i], json.hourly.is_day[i] === 1)[1]
    })
  }

  const jours = []
  for (let i = 0; i < json.daily.time.length && i < 5; i++) {
    jours.push({
      nom: nomDuJour(json.daily.time[i], i),
      symbole: infoMeteo(json.daily.weather_code[i], true)[1],
      min: json.daily.temperature_2m_min[i],
      max: json.daily.temperature_2m_max[i]
    })
  }

  return {
    ville: lieu.nom,
    temp: actuel.temperature_2m,
    ressenti: actuel.apparent_temperature,
    humidite: actuel.relative_humidity_2m,
    vent: actuel.wind_speed_10m,
    uniteVent: CONFIG.unites === "imperial" ? "mph" : "km/h",
    code: actuel.weather_code,
    estJour: actuel.is_day === 1,
    min: json.daily.temperature_2m_min[0],
    max: json.daily.temperature_2m_max[0],
    heures,
    jours,
    horodatage: Date.now()
  }
}

// ── Briques d'affichage ────────────────────────────────────────

function texte(parent, contenu, taille, options) {
  const o = options || {}
  const t = parent.addText(String(contenu))
  t.font = o.gras ? Font.boldSystemFont(taille) : Font.systemFont(taille)
  t.textColor = new Color("#ffffff", o.opacite === undefined ? 1 : o.opacite)
  t.lineLimit = o.lignes || 1
  t.minimumScaleFactor = 0.6
  return t
}

function icone(parent, nom, taille, opacite) {
  const symbole = SFSymbol.named(nom) || SFSymbol.named("questionmark.circle")
  const image = parent.addImage(symbole.image)
  image.imageSize = new Size(taille, taille)
  image.tintColor = new Color("#ffffff", opacite === undefined ? 1 : opacite)
  image.resizable = true
  return image
}

function separateur(parent) {
  const ligne = parent.addStack()
  ligne.size = new Size(0, 1)
  ligne.backgroundColor = new Color("#ffffff", 0.22)
  ligne.addSpacer()
}

function colonneHeure(parent, heure) {
  const colonne = parent.addStack()
  colonne.layoutVertically()

  const l1 = colonne.addStack()
  l1.addSpacer(); texte(l1, heure.label, 11, { opacite: 0.85 }); l1.addSpacer()

  colonne.addSpacer(5)
  const l2 = colonne.addStack()
  l2.addSpacer(); icone(l2, heure.symbole, 18, 0.95); l2.addSpacer()

  colonne.addSpacer(5)
  const l3 = colonne.addStack()
  l3.addSpacer(); texte(l3, Math.round(heure.temp) + "°", 12, { gras: true }); l3.addSpacer()
}

function ligneInfo(parent, symbole, libelle) {
  const ligne = parent.addStack()
  ligne.centerAlignContent()
  ligne.spacing = 4
  icone(ligne, symbole, 11, 0.85)
  texte(ligne, libelle, 12, { opacite: 0.9 })
}

function ligneJour(parent, jour) {
  const ligne = parent.addStack()
  ligne.centerAlignContent()

  const gauche = ligne.addStack()
  gauche.size = new Size(52, 0)
  gauche.centerAlignContent()
  texte(gauche, jour.nom, 13, { opacite: 0.95 })

  ligne.addSpacer()
  icone(ligne, jour.symbole, 17, 0.95)
  ligne.addSpacer()

  const droite = ligne.addStack()
  droite.size = new Size(74, 0)
  droite.centerAlignContent()
  droite.addSpacer()
  texte(droite, Math.round(jour.min) + "°", 13, { opacite: 0.7 })
  droite.addSpacer(10)
  texte(droite, Math.round(jour.max) + "°", 13, { gras: true })

  parent.addSpacer(7)
}

// ── Les trois tailles de widget ────────────────────────────────

function vuePetite(w, d) {
  const [libelle, symbole] = infoMeteo(d.code, d.estJour)

  const entete = w.addStack()
  entete.centerAlignContent()
  entete.spacing = 4
  icone(entete, symbole, 15, 0.95)
  texte(entete, d.ville, 12, { opacite: 0.9 })
  entete.addSpacer()

  w.addSpacer(8)
  texte(w, Math.round(d.temp) + "°", 42, { gras: true })
  texte(w, libelle, 12, { opacite: 0.9 })
  w.addSpacer(5)
  texte(w, "↓ " + Math.round(d.min) + "°   ↑ " + Math.round(d.max) + "°", 12, { opacite: 0.85 })
  w.addSpacer()
}

function vueMoyenne(w, d) {
  const [libelle, symbole] = infoMeteo(d.code, d.estJour)

  const principal = w.addStack()
  principal.layoutHorizontally()

  const gauche = principal.addStack()
  gauche.layoutVertically()

  const entete = gauche.addStack()
  entete.centerAlignContent()
  entete.spacing = 4
  icone(entete, symbole, 15, 0.95)
  texte(entete, d.ville, 12, { opacite: 0.9 })

  gauche.addSpacer(6)
  texte(gauche, Math.round(d.temp) + "°", 38, { gras: true })
  texte(gauche, libelle, 12, { opacite: 0.9 })
  gauche.addSpacer(3)
  texte(gauche, "↓ " + Math.round(d.min) + "°  ↑ " + Math.round(d.max) + "°", 11, { opacite: 0.8 })
  gauche.addSpacer()

  principal.addSpacer()

  const droite = principal.addStack()
  droite.layoutHorizontally()
  droite.centerAlignContent()

  const liste = d.heures.slice(0, CONFIG.heuresAffichees)
  liste.forEach((heure, i) => {
    colonneHeure(droite, heure)
    if (i < liste.length - 1) droite.addSpacer(12)
  })
}

function vueGrande(w, d) {
  const [libelle, symbole] = infoMeteo(d.code, d.estJour)

  const entete = w.addStack()
  entete.centerAlignContent()
  entete.spacing = 5
  icone(entete, "location.fill", 12, 0.85)
  texte(entete, d.ville, 14, { gras: true })
  entete.addSpacer()
  texte(entete, d.heureMaj, 11, { opacite: 0.75 })

  w.addSpacer(12)

  const bloc = w.addStack()
  bloc.centerAlignContent()
  bloc.spacing = 12
  icone(bloc, symbole, 50, 1)

  const temperature = bloc.addStack()
  temperature.layoutVertically()
  texte(temperature, Math.round(d.temp) + "°", 44, { gras: true })
  texte(temperature, libelle, 13, { opacite: 0.9, lignes: 2 })

  bloc.addSpacer()

  const details = bloc.addStack()
  details.layoutVertically()
  details.spacing = 5
  ligneInfo(details, "thermometer.medium", "Ressenti " + Math.round(d.ressenti) + "°")
  ligneInfo(details, "humidity.fill", Math.round(d.humidite) + " %")
  ligneInfo(details, "wind", Math.round(d.vent) + " " + d.uniteVent)

  w.addSpacer(12)
  separateur(w)
  w.addSpacer(12)

  const heures = w.addStack()
  heures.layoutHorizontally()
  const liste = d.heures.slice(0, 6)
  liste.forEach((heure, i) => {
    colonneHeure(heures, heure)
    if (i < liste.length - 1) heures.addSpacer()
  })

  w.addSpacer(12)
  separateur(w)
  w.addSpacer(10)

  d.jours.slice(0, CONFIG.joursAffiches).forEach(jour => ligneJour(w, jour))
  w.addSpacer()
}

// ── Assemblage ─────────────────────────────────────────────────

function construire(d, famille, horsLigne) {
  const w = new ListWidget()
  const couleurs = degrade(d.code, d.estJour)
  const fond = new LinearGradient()
  fond.colors = [new Color(couleurs[0]), new Color(couleurs[1])]
  fond.locations = [0, 1]
  fond.startPoint = new Point(0, 0)
  fond.endPoint = new Point(1, 1)
  w.backgroundGradient = fond
  w.setPadding(14, 14, 14, 14)
  w.url = "scriptable:///run/" + encodeURIComponent(Script.name())
  w.refreshAfterDate = new Date(Date.now() + CONFIG.minutesAvantRafraichissement * 60 * 1000)

  const formateur = new DateFormatter()
  formateur.dateFormat = "HH:mm"
  d.heureMaj = formateur.string(new Date(d.horodatage))

  if (famille === "small") vuePetite(w, d)
  else if (famille === "large" || famille === "extraLarge") vueGrande(w, d)
  else vueMoyenne(w, d)

  if (horsLigne) {
    texte(w, "Hors ligne · " + d.heureMaj, 9, { opacite: 0.7 })
  }
  return w
}

function vueErreur(message) {
  const w = new ListWidget()
  const fond = new LinearGradient()
  fond.colors = [new Color("#3a3f47"), new Color("#5a626d")]
  fond.locations = [0, 1]
  w.backgroundGradient = fond
  w.setPadding(14, 14, 14, 14)
  icone(w, "exclamationmark.triangle.fill", 22, 0.9)
  w.addSpacer(8)
  texte(w, "Météo indisponible", 14, { gras: true })
  w.addSpacer(4)
  texte(w, message, 11, { opacite: 0.85, lignes: 4 })
  return w
}

let donnees = null
let horsLigne = false
let messageErreur = "Vérifie ta connexion et l'autorisation de localisation."

try {
  const lieu = await resoudreLieu()
  const json = await recupererMeteo(lieu)
  donnees = normaliser(json, lieu)
  ecrireCache(donnees, lieu)
} catch (erreur) {
  const cache = lireCache()
  if (cache && cache.donnees) {
    donnees = cache.donnees
    horsLigne = true
  } else {
    messageErreur = String(erreur && erreur.message ? erreur.message : erreur)
  }
}

const famille = config.widgetFamily || "medium"
const widget = donnees ? construire(donnees, famille, horsLigne) : vueErreur(messageErreur)

if (config.runsInWidget) {
  Script.setWidget(widget)
} else if (famille === "small") {
  await widget.presentSmall()
} else if (famille === "large" || famille === "extraLarge") {
  await widget.presentLarge()
} else {
  await widget.presentMedium()
}

Script.complete()
