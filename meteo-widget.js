// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-gray; icon-glyph: circle;

// ───────────────────────────────────────────────────────────────
//  MÉTÉO — widget Scriptable, style « trou noir »
//
//  Noir absolu, monochrome blanc, halo lumineux en bas d'écran.
//  Bas du widget : la bande des jours, dans l'esprit !Boring Weather.
//  Un appui sur le widget ouvre la vue interactive : on fait glisser
//  le doigt sur la frise pour lire la température heure par heure.
//
//  Données : Open-Meteo — gratuit, aucune clé API.
// ───────────────────────────────────────────────────────────────

const CONFIG = {
  unites: "metrique",       // "metrique" (°C, km/h) ou "imperial" (°F, mph)
  villeFixe: "Avignon",     // ville imposée (84000). Vide "" = suivre le GPS
  villeParDefaut: "Avignon",// repli si le GPS est indisponible
  minutesAvantRafraichissement: 30,
  joursAffiches: 8,         // colonnes de la bande des jours (widget grand)
  heuresGraphe: 24,         // portée du graphe horaire du widget
  apercuWidget: false       // true = ouvrir l'aperçu du widget au lieu de la vue interactive
}

const BLANC = "#ffffff"

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

// ── Codes météo WMO ────────────────────────────────────────────

function infoMeteo(code, estJour) {
  const j = estJour !== false
  const table = {
    0:  ["Ciel dégagé",           j ? "sun.max.fill"      : "moon.stars.fill", "clair"],
    1:  ["Peu nuageux",           j ? "sun.min.fill"      : "moon.fill",       "clair"],
    2:  ["Partiellement nuageux", j ? "cloud.sun.fill"    : "cloud.moon.fill", "voile"],
    3:  ["Couvert",               "cloud.fill",                                "nuage"],
    45: ["Brouillard",            "cloud.fog.fill",                            "brume"],
    48: ["Brouillard givrant",    "cloud.fog.fill",                            "brume"],
    51: ["Bruine légère",         "cloud.drizzle.fill",                        "pluie"],
    53: ["Bruine",                "cloud.drizzle.fill",                        "pluie"],
    55: ["Bruine dense",          "cloud.drizzle.fill",                        "pluie"],
    56: ["Bruine verglaçante",    "cloud.sleet.fill",                          "pluie"],
    57: ["Bruine verglaçante",    "cloud.sleet.fill",                          "pluie"],
    61: ["Pluie faible",          "cloud.rain.fill",                           "pluie"],
    63: ["Pluie",                 "cloud.rain.fill",                           "pluie"],
    65: ["Forte pluie",           "cloud.heavyrain.fill",                      "pluie"],
    66: ["Pluie verglaçante",     "cloud.sleet.fill",                          "pluie"],
    67: ["Pluie verglaçante",     "cloud.sleet.fill",                          "pluie"],
    71: ["Neige faible",          "cloud.snow.fill",                           "neige"],
    73: ["Neige",                 "cloud.snow.fill",                           "neige"],
    75: ["Forte neige",           "cloud.snow.fill",                           "neige"],
    77: ["Grains de neige",       "cloud.snow.fill",                           "neige"],
    80: ["Averses",               j ? "cloud.sun.rain.fill" : "cloud.moon.rain.fill", "pluie"],
    81: ["Averses",               "cloud.rain.fill",                           "pluie"],
    82: ["Fortes averses",        "cloud.heavyrain.fill",                      "pluie"],
    85: ["Averses de neige",      "cloud.snow.fill",                           "neige"],
    86: ["Averses de neige",      "cloud.snow.fill",                           "neige"],
    95: ["Orage",                 "cloud.bolt.rain.fill",                      "orage"],
    96: ["Orage et grêle",        "cloud.bolt.rain.fill",                      "orage"],
    99: ["Orage et grêle",        "cloud.bolt.rain.fill",                      "orage"]
  }
  return table[code] || ["Météo indisponible", "questionmark.circle", "nuage"]
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
    // On passera au repli suivant.
  }
  return null
}

async function resoudreLieu() {
  // Le paramètre du widget vise ce widget-là : il passe avant tout le reste.
  const parametre = (args.widgetParameter || "").trim()
  if (parametre) {
    const lieu = await geocoder(parametre)
    if (lieu) return lieu
  }

  const imposee = (CONFIG.villeFixe || "").trim()
  if (imposee) {
    const lieu = await geocoder(imposee)
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
      // Sans nom de ville, on garde « Ma position ».
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

// ── Données ────────────────────────────────────────────────────

async function recupererMeteo(lieu) {
  const params = [
    "latitude=" + lieu.lat.toFixed(4),
    "longitude=" + lieu.lon.toFixed(4),
    "current=temperature_2m,apparent_temperature,is_day,weather_code,relative_humidity_2m,wind_speed_10m",
    "hourly=temperature_2m,weather_code,is_day",
    "daily=weather_code,temperature_2m_max,temperature_2m_min",
    "timezone=auto",
    "forecast_days=8"
  ]
  if (CONFIG.unites === "imperial") {
    params.push("temperature_unit=fahrenheit", "wind_speed_unit=mph")
  }
  const requete = new Request("https://api.open-meteo.com/v1/forecast?" + params.join("&"))
  requete.timeoutInterval = 15
  return await requete.loadJSON()
}

const JOURS_COURTS = ["DIM", "LUN", "MAR", "MER", "JEU", "VEN", "SAM"]

function nomDuJour(dateISO, index) {
  if (index === 0) return "AUJ."
  return JOURS_COURTS[new Date(dateISO + "T12:00:00").getDay()]
}

function normaliser(json, lieu) {
  const actuel = json.current

  // timezone=auto : les horodatages sont locaux au lieu, la comparaison
  // lexicographique sur les chaînes ISO suffit donc à trouver l'heure suivante.
  let debut = json.hourly.time.findIndex(t => t > actuel.time)
  if (debut < 0) debut = 0

  const heures = []
  const fin = Math.min(debut + 48, json.hourly.time.length)
  for (let i = debut; i < fin; i++) {
    const iso = json.hourly.time[i]
    const code = json.hourly.weather_code[i]
    const estJour = json.hourly.is_day[i] === 1
    const [libelle, symbole, famille] = infoMeteo(code, estJour)
    heures.push({
      heure: iso.slice(11, 13),
      label: iso.slice(11, 13) + "h",
      jour: JOURS_COURTS[new Date(iso.slice(0, 10) + "T12:00:00").getDay()],
      dateISO: iso.slice(0, 10),
      temp: json.hourly.temperature_2m[i],
      libelle, symbole, famille, estJour
    })
  }

  const jours = []
  for (let i = 0; i < json.daily.time.length && i < CONFIG.joursAffiches; i++) {
    const [, symboleJour, familleJour] = infoMeteo(json.daily.weather_code[i], true)
    jours.push({
      nom: nomDuJour(json.daily.time[i], i),
      dateISO: json.daily.time[i],
      symbole: symboleJour,
      famille: familleJour,
      min: json.daily.temperature_2m_min[i],
      max: json.daily.temperature_2m_max[i]
    })
  }

  const [libelle, symbole, famille] = infoMeteo(actuel.weather_code, actuel.is_day === 1)
  return {
    ville: lieu.nom,
    temp: actuel.temperature_2m,
    ressenti: actuel.apparent_temperature,
    humidite: actuel.relative_humidity_2m,
    vent: actuel.wind_speed_10m,
    uniteVent: CONFIG.unites === "imperial" ? "mph" : "km/h",
    uniteTemp: CONFIG.unites === "imperial" ? "°F" : "°C",
    code: actuel.weather_code,
    estJour: actuel.is_day === 1,
    libelle, symbole, famille,
    min: json.daily.temperature_2m_min[0],
    max: json.daily.temperature_2m_max[0],
    heures, jours,
    horodatage: Date.now()
  }
}

// ── Dessin : fond « trou noir », réglé par la météo ────────────

// Générateur déterministe : à météo égale, le fond ne scintille pas d'un
// rendu à l'autre. Chaque temps a sa propre graine, donc son propre dessin.
function alea(graine) {
  let etat = (graine >>> 0) || 1
  return function () {
    etat = (etat * 1664525 + 1013904223) >>> 0
    return etat / 4294967296
  }
}

// Bancs de nuages : plusieurs formations plutôt qu'un seul nuage isolé.
// Chaque entrée vaut [x, y, échelle, opacité, dérive], en fractions du cadre.
const BANCS = {
  soleilVoile: [[0.83, 0.150, 1.00, 1.00, 0.000]],
  nuage:       [[0.10, 0.108, 0.72, 0.62, 0.011], [0.40, 0.178, 0.95, 0.82, 0.008],
                [0.74, 0.122, 1.18, 1.00, 0.014], [1.04, 0.192, 0.86, 0.88, 0.006],
                [1.34, 0.140, 0.68, 0.70, 0.010]],
  pluie:       [[0.22, 0.128, 0.74, 0.58, 0.010], [0.60, 0.168, 1.02, 0.92, 0.007],
                [0.94, 0.118, 1.12, 1.00, 0.013], [1.28, 0.176, 0.72, 0.72, 0.009]],
  orage:       [[0.24, 0.132, 0.80, 0.66, 0.009], [0.62, 0.172, 1.06, 0.94, 0.006],
                [0.96, 0.120, 1.16, 1.00, 0.012], [1.30, 0.180, 0.74, 0.74, 0.008]],
  neige:       [[0.20, 0.126, 0.76, 0.60, 0.008], [0.58, 0.170, 1.00, 0.90, 0.006],
                [0.92, 0.120, 1.10, 1.00, 0.011], [1.26, 0.178, 0.70, 0.70, 0.007]]
}

// Mêmes sept temps que la vue interactive : même couleur, même objet dans
// le ciel, même chose qui tombe — en version fixe.
const FONDS = {
  clair:     { grains:175, eclat:1.00, longueur:1.00, trait:1.00, anneau:0.62, halo:1.00,
               c:[255,198,84],  h:[255,140,30],  ciel:"soleil", chute:null },
  clairNuit: { grains:170, eclat:0.80, longueur:1.00, trait:1.00, anneau:0.58, halo:0.95,
               c:[206,225,255], h:[132,172,255], ciel:"lune",   chute:null },
  voile:     { grains:155, eclat:0.84, longueur:0.88, trait:1.25, anneau:0.50, halo:0.90,
               c:[255,213,128], h:[150,164,178], ciel:"soleil", chute:null },
  nuage:     { grains:120, eclat:0.64, longueur:0.70, trait:1.65, anneau:0.38, halo:0.75,
               c:[156,168,180], h:[104,116,129], ciel:"nuage",  chute:null },
  brume:     { grains:105, eclat:0.50, longueur:0.40, trait:2.70, anneau:0.26, halo:1.15,
               c:[178,194,206], h:[124,140,152], ciel:null,     chute:"brume" },
  pluie:     { grains:150, eclat:0.70, longueur:1.18, trait:1.05, anneau:0.42, halo:0.70,
               c:[86,172,255],  h:[28,108,206],  ciel:"nuage",  chute:"pluie" },
  neige:     { grains:175, eclat:0.78, longueur:0.46, trait:1.75, anneau:0.44, halo:0.95,
               c:[224,244,255], h:[158,212,240], ciel:"nuage",  chute:"neige" },
  orage:     { grains:165, eclat:1.00, longueur:1.40, trait:0.90, anneau:0.72, halo:0.85,
               c:[182,126,255], h:[108,42,216],  ciel:"orage",  chute:"pluie" }
}

const GRAINES = { clair: 11, clairNuit: 17, voile: 23, nuage: 37, brume: 51,
                  pluie: 67, neige: 83, orage: 97 }

function melange(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
}

function versHex(c) {
  const d = v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")
  return "#" + d(c[0]) + d(c[1]) + d(c[2])
}

function fondTrouNoir(largeur, hauteur, famille, estJour) {
  const clef = (famille === "clair" && estJour === false) ? "clairNuit"
    : (FONDS[famille] ? famille : "nuage")
  const f = FONDS[clef]
  const nuit = estJour === false
  const gain = f.eclat * (nuit ? 0.58 : 1)

  // Le disque reste blanc, juste teinté par le temps qu'il fait ; ce qui
  // tombe du ciel, lui, garde sa couleur franche.
  const teinteDisque = versHex(melange([255, 255, 255], f.c, 0.32))
  const teinteChute = versHex(melange(f.c, [255, 255, 255], 0.15))
  const teinteCiel = versHex(melange(f.c, [255, 255, 255], 0.45))
  const teinteOmbre = versHex(f.h)

  const dc = new DrawContext()
  dc.size = new Size(largeur, hauteur)
  dc.opaque = true
  dc.respectScreenScale = true

  dc.setFillColor(new Color("#000000"))
  dc.fillRect(new Rect(0, 0, largeur, hauteur))

  const cx = largeur / 2
  const cy = hauteur * 1.03            // horizon juste sous le cadre
  const rayon = largeur * 0.22
  const suivant = alea(20260823 + GRAINES[clef] * 7919)

  // ── La lueur du temps, dans l'angle ──
  // Le widget porte déjà son icône en premier plan : un second soleil dessiné
  // au fond ferait doublon, et se poserait en plein sur le texte. On ne garde
  // donc qu'une ambiance colorée, faite d'anneaux successifs faute de dégradés.
  if (f.ciel) {
    const sx = largeur * 0.82
    const sy = hauteur * 0.13
    const sr = largeur * 0.10
    for (let i = 16; i >= 1; i--) {
      const rr = sr * (0.5 + i * 0.23)
      dc.setFillColor(new Color(i > 10 ? teinteOmbre : teinteCiel, 0.016 * gain))
      dc.fillEllipse(new Rect(sx - rr, sy - rr, rr * 2, rr * 2))
    }
  }

  // ── Halo du disque ──
  for (let i = 16; i >= 1; i--) {
    const rx = rayon * (0.9 + i * 0.46) * f.halo
    const ry = rayon * (0.12 + i * 0.075) * f.halo
    dc.setFillColor(new Color(teinteDisque, 0.013 * gain))
    dc.fillEllipse(new Rect(cx - rx, cy - ry, rx * 2, ry * 2))
  }

  // ── Traînées du disque : le côté qui s'approche brille davantage ──
  for (let n = 0; n < f.grains; n++) {
    const r = rayon * (1.05 + Math.pow(suivant(), 0.55) * 2.9)
    const aplat = 0.14 + suivant() * 0.09
    const angle = suivant() * Math.PI * 2
    const longueur = (0.14 + suivant() * 0.52) * f.longueur
    const derriere = Math.sin(angle) < 0

    const eclat = (0.30 + 0.70 * (0.5 + 0.5 * Math.cos(angle)))
      * (0.35 + 0.65 * (1 - (r / rayon - 1) / 3))
      * (derriere ? 0.55 : 1) * gain

    const chemin = new Path()
    const pas = 7
    for (let k = 0; k <= pas; k++) {
      const a = angle + (k / pas) * longueur
      const p = new Point(cx + Math.cos(a) * r, cy + Math.sin(a) * r * aplat)
      if (k === 0) chemin.move(p); else chemin.addLine(p)
    }
    dc.setStrokeColor(new Color(teinteDisque, Math.min(eclat * 0.32, 0.5)))
    dc.setLineWidth((0.5 + suivant() * 1.4) * f.trait)
    dc.addPath(chemin)
    dc.strokePath()
  }

  // ── Ce qui tombe, incurvé vers le trou noir ──
  // La direction de chaque marque mêle la verticale et la ligne qui vise
  // l'horizon, d'autant plus que la marque en est proche.
  if (f.chute) {
    const combien = f.chute === "brume" ? 26 : 52
    for (let n = 0; n < combien; n++) {
      // La météo appartient à la scène du disque, en bas : plus haut elle
      // viendrait strier l'heure, la courbe et la bande des jours.
      const hautChute = hauteur * 0.45
      const x = (suivant() * 1.3 - 0.15) * largeur
      const y = hautChute + suivant() * Math.max(1, cy - rayon * 0.6 - hautChute)
      const dx = cx - x, dy = cy - y
      const dist = Math.sqrt(dx * dx + dy * dy) || 1
      const prise = Math.max(0, Math.min(1, 1 - (dist - rayon) / (rayon * 3)))
      const proche = 0.25 + 0.55 * prise

      if (f.chute === "neige") {
        const d = (1.4 + suivant() * 2.2)
        dc.setFillColor(new Color(teinteChute, proche * gain))
        dc.fillEllipse(new Rect(x, y, d, d))
      } else if (f.chute === "brume") {
        const l = largeur * (0.10 + suivant() * 0.16)
        dc.setFillColor(new Color(teinteChute, 0.05 * gain))
        dc.fillEllipse(new Rect(x - l / 2, y - 3, l, 6))
      } else {
        const lg = 6 + suivant() * 14
        // 0 = tout droit, 1 = droit sur l'horizon
        const vx = (dx / dist) * prise
        const vy = 1 + (dy / dist) * prise
        const norme = Math.sqrt(vx * vx + vy * vy) || 1
        const trait = new Path()
        trait.move(new Point(x, y))
        trait.addLine(new Point(x + (vx / norme) * lg, y + (vy / norme) * lg))
        dc.setStrokeColor(new Color(teinteChute, proche * gain))
        dc.setLineWidth(0.9)
        dc.addPath(trait)
        dc.strokePath()
      }
    }
  }

  // ── L'orage : le nuage frappe, et le trou noir décharge ──
  if (clef === "orage") {
    const brise = (x0, y0, x1, y1, ecart, segments) => {
      const chemin = new Path()
      chemin.move(new Point(x0, y0))
      const dx = x1 - x0, dy = y1 - y0
      const l = Math.sqrt(dx * dx + dy * dy) || 1
      for (let k = 1; k <= segments; k++) {
        const t = k / segments
        const j = (suivant() - 0.5) * 2 * ecart * Math.sin(Math.PI * t)
        chemin.addLine(new Point(x0 + dx * t - (dy / l) * j, y0 + dy * t + (dx / l) * j))
      }
      return chemin
    }

    // Le trait qui descend du nuage.
    dc.setStrokeColor(new Color(teinteChute, 0.55))
    dc.setLineWidth(1.5)
    dc.addPath(brise(largeur * 0.82, hauteur * 0.52, cx, cy - rayon * 0.9, largeur * 0.05, 7))
    dc.strokePath()

    // Les jets qui jaillissent de l'horizon. Un widget large et plat n'a pas
    // la hauteur pour les accueillir sans traverser la bande des jours.
    const assezHaut = hauteur / largeur > 0.8
    for (let i = 0; assezHaut && i < 3; i++) {
      // On écarte la verticale : un jet qui monte droit traverserait la
      // bande des jours et la courbe.
      const cote = suivant() < 0.5 ? 0.10 : 0.62
      const a = Math.PI + (cote + suivant() * 0.28) * Math.PI
      const x0 = cx + Math.cos(a) * rayon * 1.02
      const y0 = cy + Math.sin(a) * rayon * 1.02
      // Un jet ne doit pas dépasser la zone basse : on raccourcit sa portée
      // plutôt que de le laisser traverser la bande des jours.
      const limite = hauteur * 0.62
      const monte = -Math.sin(a)
      let portee = rayon * (0.6 + suivant() * 0.9)
      if (monte > 0.05) portee = Math.min(portee, Math.max(0, y0 - limite) / (0.85 * monte))
      dc.setStrokeColor(new Color(teinteChute, 0.30 + suivant() * 0.35))
      dc.setLineWidth(1.2)
      dc.addPath(brise(x0, y0, x0 + Math.cos(a) * portee, y0 + Math.sin(a) * portee * 0.85,
                       rayon * 0.16, 7))
      dc.strokePath()
    }
  }

  // ── Horizon des événements, cerclé de lumière sur son arc supérieur ──
  dc.setFillColor(new Color("#000000"))
  dc.fillEllipse(new Rect(cx - rayon, cy - rayon, rayon * 2, rayon * 2))
  const arc = new Path()
  const pas = 40
  for (let k = 0; k <= pas; k++) {
    const a = Math.PI + (k / pas) * Math.PI
    const p = new Point(cx + Math.cos(a) * rayon * 1.02, cy + Math.sin(a) * rayon * 1.02)
    if (k === 0) arc.move(p); else arc.addLine(p)
  }
  dc.setStrokeColor(new Color(teinteDisque, f.anneau * gain))
  dc.setLineWidth(1.3)
  dc.addPath(arc)
  dc.strokePath()

  return dc.getImage()
}

// ── Dessin : graphe horaire ────────────────────────────────────

function grapheHoraire(heures, largeur, hauteur) {
  const dc = new DrawContext()
  dc.size = new Size(largeur, hauteur)
  dc.opaque = false
  dc.respectScreenScale = true

  const serie = heures.slice(0, CONFIG.heuresGraphe)
  if (serie.length < 2) return dc.getImage()

  const temps = serie.map(h => h.temp)
  const tMin = Math.min.apply(null, temps)
  const tMax = Math.max.apply(null, temps)
  const etendue = (tMax - tMin) || 1

  const hautLabels = 15   // bande réservée aux heures, en bas
  const margeHaute = 15   // place pour l'étiquette du maximum
  const hCourbe = hauteur - hautLabels - margeHaute
  const x = i => (i / (serie.length - 1)) * (largeur - 2) + 1
  const y = t => margeHaute + hCourbe - ((t - tMin) / etendue) * hCourbe

  const points = serie.map((h, i) => new Point(x(i), y(h.temp)))

  // Aire sous la courbe.
  const aire = new Path()
  aire.move(new Point(points[0].x, margeHaute + hCourbe))
  points.forEach(p => aire.addLine(p))
  aire.addLine(new Point(points[points.length - 1].x, margeHaute + hCourbe))
  aire.closeSubpath()
  dc.setFillColor(new Color(BLANC, 0.10))
  dc.addPath(aire)
  dc.fillPath()

  // Courbe.
  const ligne = new Path()
  ligne.move(points[0])
  for (let i = 1; i < points.length; i++) ligne.addLine(points[i])
  dc.setStrokeColor(new Color(BLANC, 0.92))
  dc.setLineWidth(1.3)
  dc.addPath(ligne)
  dc.strokePath()

  // Repère « maintenant ».
  dc.setFillColor(new Color(BLANC, 1))
  dc.fillEllipse(new Rect(points[0].x - 3, points[0].y - 3, 6, 6))

  // Étiquettes des extrêmes.
  const iMax = temps.indexOf(tMax)
  const iMin = temps.indexOf(tMin)
  dc.setFont(Font.boldMonospacedSystemFont(10))
  dc.setTextAlignedCenter()
  dc.setTextColor(new Color(BLANC, 0.95))
  dc.drawTextInRect(Math.round(tMax) + "°",
    new Rect(Math.min(Math.max(x(iMax) - 22, 0), largeur - 44), y(tMax) - 15, 44, 13))
  dc.setTextColor(new Color(BLANC, 0.55))
  // Sous le point s'il reste la place, au-dessus sinon : sinon l'étiquette
  // vient s'écraser sur la rangée des heures.
  const yMin = y(tMin)
  const placeDessous = yMin + 15 < margeHaute + hCourbe
  dc.drawTextInRect(Math.round(tMin) + "°",
    new Rect(Math.min(Math.max(x(iMin) - 22, 0), largeur - 44),
             placeDessous ? yMin + 2 : yMin - 15, 44, 13))

  // Heures, alignées sur les points de la courbe.
  dc.setFont(Font.mediumMonospacedSystemFont(9))
  dc.setTextColor(new Color(BLANC, 0.45))
  for (let i = 0; i < serie.length; i += 4) {
    dc.drawTextInRect(serie[i].heure,
      new Rect(Math.min(Math.max(x(i) - 16, 0), largeur - 32), hauteur - hautLabels + 2, 32, 12))
  }

  return dc.getImage()
}

// ── Briques d'affichage ────────────────────────────────────────

function texte(parent, contenu, police, opacite) {
  const t = parent.addText(String(contenu))
  t.font = police
  t.textColor = new Color(BLANC, opacite === undefined ? 1 : opacite)
  t.lineLimit = 1
  t.minimumScaleFactor = 0.5
  return t
}

function icone(parent, nom, taille, opacite) {
  const symbole = SFSymbol.named(nom) || SFSymbol.named("questionmark.circle")
  const image = parent.addImage(symbole.image)
  image.imageSize = new Size(taille, taille)
  image.tintColor = new Color(BLANC, opacite === undefined ? 1 : opacite)
  image.resizable = true
  return image
}

function separateur(parent, opacite) {
  const ligne = parent.addStack()
  ligne.size = new Size(0, 1)
  ligne.backgroundColor = new Color(BLANC, opacite === undefined ? 0.14 : opacite)
  ligne.addSpacer()
}

// Bande des jours : libellé, icône, maximum, minimum — comme la référence.
function bandeDesJours(parent, jours, tailleIcone, taillePolice) {
  const bande = parent.addStack()
  bande.layoutHorizontally()

  jours.forEach((jour, index) => {
    const colonne = bande.addStack()
    colonne.layoutVertically()

    const l1 = colonne.addStack()
    l1.addSpacer()
    texte(l1, jour.nom, Font.mediumMonospacedSystemFont(taillePolice - 1), index === 0 ? 0.95 : 0.5)
    l1.addSpacer()

    colonne.addSpacer(5)
    const l2 = colonne.addStack()
    l2.addSpacer()
    icone(l2, jour.symbole, tailleIcone, 0.92)
    l2.addSpacer()

    colonne.addSpacer(5)
    const l3 = colonne.addStack()
    l3.addSpacer()
    texte(l3, Math.round(jour.max) + "°", Font.boldMonospacedSystemFont(taillePolice), 0.95)
    l3.addSpacer()

    colonne.addSpacer(1)
    const l4 = colonne.addStack()
    l4.addSpacer()
    texte(l4, Math.round(jour.min) + "°", Font.regularMonospacedSystemFont(taillePolice), 0.42)
    l4.addSpacer()

    if (index < jours.length - 1) bande.addSpacer()
  })
}

function enTete(parent, d, taille) {
  const ligne = parent.addStack()
  ligne.centerAlignContent()
  ligne.spacing = 4
  texte(ligne, d.ville.toUpperCase(), Font.mediumMonospacedSystemFont(taille), 0.6)
  icone(ligne, "location.fill", taille - 1, 0.4)
  ligne.addSpacer()
  return ligne
}

// ── Les trois tailles ──────────────────────────────────────────

function vuePetite(w, d) {
  enTete(w, d, 9)
  w.addSpacer(4)

  const corps = w.addStack()
  corps.centerAlignContent()
  texte(corps, Math.round(d.temp) + "°", Font.blackSystemFont(46), 1)
  corps.addSpacer()
  icone(corps, d.symbole, 26, 0.95)

  texte(w, d.libelle.toUpperCase(), Font.mediumMonospacedSystemFont(9), 0.55)
  w.addSpacer()

  const bas = w.addStack()
  bas.centerAlignContent()
  texte(bas, Math.round(d.max) + "°", Font.boldMonospacedSystemFont(11), 0.9)
  bas.addSpacer(6)
  texte(bas, Math.round(d.min) + "°", Font.regularMonospacedSystemFont(11), 0.42)
  bas.addSpacer()
}

function vueMoyenne(w, d) {
  enTete(w, d, 9)
  w.addSpacer(4)

  const corps = w.addStack()
  corps.centerAlignContent()
  texte(corps, Math.round(d.temp) + "°", Font.blackSystemFont(44), 1)
  corps.addSpacer(10)

  const etat = corps.addStack()
  etat.layoutVertically()
  texte(etat, d.libelle.toUpperCase(), Font.mediumMonospacedSystemFont(9), 0.6)
  etat.addSpacer(2)
  const extremes = etat.addStack()
  extremes.centerAlignContent()
  texte(extremes, Math.round(d.max) + "°", Font.boldMonospacedSystemFont(11), 0.9)
  extremes.addSpacer(6)
  texte(extremes, Math.round(d.min) + "°", Font.regularMonospacedSystemFont(11), 0.42)

  corps.addSpacer()
  icone(corps, d.symbole, 30, 0.95)

  w.addSpacer(8)
  separateur(w)
  w.addSpacer(8)

  bandeDesJours(w, d.jours.slice(0, 6), 13, 9)
  w.addSpacer()
}

function vueGrande(w, d) {
  enTete(w, d, 10)
  w.addSpacer(6)

  const corps = w.addStack()
  corps.centerAlignContent()

  const bloc = corps.addStack()
  bloc.layoutVertically()
  texte(bloc, Math.round(d.temp) + "°", Font.blackSystemFont(62), 1)
  bloc.addSpacer(-2)
  texte(bloc, d.libelle.toUpperCase(), Font.mediumMonospacedSystemFont(10), 0.6)

  corps.addSpacer()

  const details = corps.addStack()
  details.layoutVertically()
  details.spacing = 3
  const ressenti = details.addStack(); ressenti.addSpacer()
  texte(ressenti, "RESSENTI " + Math.round(d.ressenti) + "°", Font.regularMonospacedSystemFont(9), 0.5)
  const humidite = details.addStack(); humidite.addSpacer()
  texte(humidite, "HUMIDITÉ " + Math.round(d.humidite) + "%", Font.regularMonospacedSystemFont(9), 0.5)
  const vent = details.addStack(); vent.addSpacer()
  texte(vent, "VENT " + Math.round(d.vent) + " " + d.uniteVent.toUpperCase(), Font.regularMonospacedSystemFont(9), 0.5)

  corps.addSpacer(12)
  icone(corps, d.symbole, 42, 0.95)

  w.addSpacer(10)

  const graphe = w.addImage(grapheHoraire(d.heures, 310, 95))
  graphe.imageSize = new Size(310, 95)

  w.addSpacer(8)
  separateur(w)
  w.addSpacer(10)

  bandeDesJours(w, d.jours.slice(0, CONFIG.joursAffiches), 14, 9)
  w.addSpacer()
}

// ── Assemblage du widget ───────────────────────────────────────

function construire(d, famille, horsLigne) {
  const w = new ListWidget()
  const dimensions = famille === "small" ? [340, 340]
    : (famille === "large" || famille === "extraLarge") ? [728, 764]
    : [728, 340]
  w.backgroundImage = fondTrouNoir(dimensions[0], dimensions[1], d.famille, d.estJour)
  w.backgroundColor = new Color("#000000")
  w.setPadding(14, 15, 14, 15)
  w.url = "scriptable:///run/" + encodeURIComponent(Script.name())
  w.refreshAfterDate = new Date(Date.now() + CONFIG.minutesAvantRafraichissement * 60 * 1000)

  const formateur = new DateFormatter()
  formateur.dateFormat = "HH:mm"
  d.heureMaj = formateur.string(new Date(d.horodatage))

  if (famille === "small") vuePetite(w, d)
  else if (famille === "large" || famille === "extraLarge") vueGrande(w, d)
  else vueMoyenne(w, d)

  if (horsLigne) {
    texte(w, "HORS LIGNE · " + d.heureMaj, Font.regularMonospacedSystemFont(8), 0.4)
  }
  return w
}

function vueErreur(message) {
  const w = new ListWidget()
  w.backgroundColor = new Color("#000000")
  w.setPadding(16, 16, 16, 16)
  icone(w, "exclamationmark.triangle", 20, 0.8)
  w.addSpacer(8)
  texte(w, "MÉTÉO INDISPONIBLE", Font.boldMonospacedSystemFont(11), 0.9)
  w.addSpacer(4)
  const t = texte(w, message, Font.regularMonospacedSystemFont(9), 0.55)
  t.lineLimit = 4
  return w
}

// ── Vue interactive (appui sur le widget) ──────────────────────

async function vueInteractive(d) {
  const charge = JSON.stringify({
    ville: d.ville.toUpperCase(),
    heures: d.heures.map(h => ({
      h: h.heure, j: h.jour, t: h.temp, l: h.libelle.toUpperCase(),
      f: h.famille, d: h.estJour, dt: h.dateISO
    }))
  })

  const html = "<!DOCTYPE html><html lang='fr'><head>"
    + "<meta charset='utf-8'>"
    + "<meta name='viewport' content='width=device-width,initial-scale=1,viewport-fit=cover,user-scalable=no'>"
    + "<style>" + CSS_INTERACTIF + "</style></head><body>"
    + CORPS_INTERACTIF
    + "<script>const DONNEES = " + charge
    + "; const BANCS = " + JSON.stringify(BANCS) + ";"
    + JS_FOND + JS_INTERACTIF + "<\/script>"
    + "</body></html>"

  const vue = new WebView()
  await vue.loadHTML(html)
  await vue.present(true)
}

const CSS_INTERACTIF = `
* { margin:0; padding:0; box-sizing:border-box; -webkit-user-select:none; user-select:none;
    -webkit-tap-highlight-color:transparent; }
html, body { height:100%; background:#000; overflow:hidden;
  font-family:ui-monospace,"SF Mono",Menlo,monospace; color:#fff; }

/* Le disque garde ses traînées : sa toile est assombrie, jamais effacée.
   Le ciel et ce qui en tombe vivent sur une toile réeffacée à chaque
   image, sinon leur lumière s'accumulerait jusqu'au blanc. */
#fond { position:fixed; inset:0; z-index:0; display:block; }
#ciel { position:fixed; inset:0; z-index:1; display:block; pointer-events:none; }
#grain { position:fixed; inset:0; z-index:3; pointer-events:none; opacity:.045;
  background:repeating-linear-gradient(0deg, rgba(255,255,255,.7) 0 1px, transparent 1px 3px); }

#page { position:relative; z-index:2; height:100%; display:flex; flex-direction:column;
  padding:calc(env(safe-area-inset-top) + 24px) 24px calc(env(safe-area-inset-bottom) + 16px); }
#ville { font-size:12px; letter-spacing:.22em; opacity:.55; }

/* Le bloc de lecture : l'heure en titre, la température juste dessous. */
#lecture { margin-top:20px; transform-origin:left top; transition:transform .22s ease; }
#quand { font-size:11px; letter-spacing:.2em; opacity:.55; height:14px; }
#heure { font-family:-apple-system,system-ui,sans-serif; font-weight:900; font-size:104px;
  line-height:.9; letter-spacing:-.055em; font-variant-numeric:tabular-nums;
  text-shadow:0 0 42px rgba(255,255,255,.34); }
#bas { display:flex; align-items:baseline; gap:14px; margin-top:10px; }
#temp { font-family:-apple-system,system-ui,sans-serif; font-weight:800; font-size:46px;
  line-height:1; letter-spacing:-.035em; font-variant-numeric:tabular-nums;
  text-shadow:0 0 26px rgba(255,255,255,.26); }
#etat { font-size:11px; letter-spacing:.2em; opacity:.62; }

/* Pendant le glissement, la lecture grossit et le reste s'efface. */
#page.scrute #lecture { transform:scale(1.08); }
#page.scrute #reperes { opacity:.3; }
#page.scrute #aide { opacity:0; }
#aide { transition:opacity .22s ease; }

/* Les chiffres défilent comme un compteur, dans le sens du glissement. */
@keyframes monte {
  from { transform:translateY(.34em); opacity:0; filter:blur(5px); }
  to   { transform:translateY(0); opacity:1; filter:blur(0); }
}
@keyframes descend {
  from { transform:translateY(-.34em); opacity:0; filter:blur(5px); }
  to   { transform:translateY(0); opacity:1; filter:blur(0); }
}
#heure.avant, #temp.avant   { animation:monte .26s cubic-bezier(.2,.85,.3,1); }
#heure.arriere, #temp.arriere { animation:descend .26s cubic-bezier(.2,.85,.3,1); }
#temp.avant, #temp.arriere  { animation-duration:.3s; }

@media (prefers-reduced-motion: reduce) {
  #heure, #temp { animation:none !important; }
  #lecture { transition:none; }
}
@media (max-height:720px) {
  #heure { font-size:88px; }
  #temp { font-size:38px; }
}

/* La frise : c'est elle qu'on manipule, elle occupe donc tout le bas. */
#frise { position:relative; margin-top:auto; height:380px; touch-action:none; }
#frise::before { content:""; position:absolute; inset:-16px -24px -20px -24px; pointer-events:none;
  background:linear-gradient(to top, rgba(0,0,0,.62), rgba(0,0,0,.20) 62%, rgba(0,0,0,0)); }
#courbe { position:absolute; inset:0; width:100%; height:100%; }

/* Repères en HTML : dans un SVG étiré en largeur, textes et pastilles
   seraient écrasés. Le pourcentage les cale exactement sur la courbe. */
#reperes { position:absolute; inset:0; pointer-events:none; transition:opacity .22s ease; }
#reperes span, #reperes i { position:absolute; transform:translateX(-50%); white-space:nowrap; }
#reperes .hr { bottom:26px; font-size:10px; letter-spacing:.1em; opacity:.42;
  font-variant-numeric:tabular-nums; }
#reperes .hr.gauche { transform:translateX(0); }
#reperes .hr.droite { transform:translateX(-100%); }
#reperes .jr { bottom:4px; font-size:9px; letter-spacing:.2em; opacity:.66;
  transform:translateX(0); padding-left:6px; }
#reperes .pt { width:5px; height:5px; margin:-2.5px 0 0 -2.5px; border-radius:50%;
  background:#fff; opacity:.8; transform:none; }
#reperes .ex { font-size:10px; font-weight:600; letter-spacing:.05em;
  font-variant-numeric:tabular-nums; }
#reperes .ex.haut { margin-top:-21px; opacity:.92; }
#reperes .ex.bas { margin-top:9px; opacity:.5; }

/* Le curseur : un rail, une lueur qui l'accompagne, une prise sur la courbe. */
#bande { position:absolute; top:0; bottom:44px; width:64px; margin-left:-32px; pointer-events:none;
  background:linear-gradient(to right, rgba(255,255,255,0), rgba(255,255,255,.085) 50%,
  rgba(255,255,255,0)); }
#curseur { position:absolute; top:0; bottom:44px; width:1px; background:rgba(255,255,255,.8);
  transform:translateX(-.5px); box-shadow:0 0 14px rgba(255,255,255,.55); }
#curseur::before, #curseur::after {
  content:""; position:absolute; left:-2.5px; width:6px; height:6px; border-radius:50%;
  background:rgba(255,255,255,.85);
}
#curseur::before { top:-3px; }
#curseur::after { bottom:-3px; }
#pastille { position:absolute; width:13px; height:13px; margin:-6.5px 0 0 -6.5px; border-radius:50%;
  background:#fff; box-shadow:0 0 0 4px rgba(255,255,255,.16), 0 0 22px rgba(255,255,255,.95); }
#aide { text-align:center; font-size:10px; letter-spacing:.18em; opacity:.3; margin-top:6px; }
`

const CORPS_INTERACTIF = `
<canvas id="fond"></canvas>
<canvas id="ciel"></canvas>
<div id="page">
  <div id="ville"></div>
  <div id="lecture">
    <div id="quand"></div>
    <div id="heure">--</div>
    <div id="bas">
      <div id="temp">--</div>
      <div id="etat"></div>
    </div>
  </div>
  <div id="frise">
    <svg id="courbe" preserveAspectRatio="none"></svg>
    <div id="reperes"></div>
    <div id="bande"></div>
    <div id="curseur"></div>
    <div id="pastille"></div>
  </div>
  <div id="aide">GLISSER POUR PARCOURIR LES HEURES</div>
</div>
<div id="grain"></div>
`

// Disque d'accrétion animé, et la météo qui lui tombe dessus.
const JS_FOND = `
const TAU = Math.PI * 2;

// Chaque temps a sa couleur, son objet dans le ciel, et ce qui en tombe.
const TEMPS = {
  clair:     { c:[255,198,84],  h:[255,140,30],  ciel:"soleil",      chute:null,
               vitesse:1.30, densite:1.00, eclat:1.00, fondu:0.055, epaisseur:0.9 },
  clairNuit: { c:[206,225,255], h:[132,172,255], ciel:"lune",        chute:null,
               vitesse:1.20, densite:0.95, eclat:0.78, fondu:0.055, epaisseur:0.9 },
  voile:     { c:[255,213,128], h:[150,164,178], ciel:"soleilVoile", chute:null,
               vitesse:1.05, densite:0.92, eclat:0.86, fondu:0.062, epaisseur:1.2 },
  nuage:     { c:[156,168,180], h:[104,116,129], ciel:"nuage",       chute:null,
               vitesse:0.80, densite:0.78, eclat:0.70, fondu:0.078, epaisseur:1.7 },
  brume:     { c:[178,194,206], h:[124,140,152], ciel:null,          chute:"brume",
               vitesse:0.50, densite:0.64, eclat:0.56, fondu:0.085, epaisseur:2.6 },
  pluie:     { c:[86,172,255],  h:[28,108,206],  ciel:"nuage",       chute:"pluie",
               vitesse:1.10, densite:1.00, eclat:0.74, fondu:0.052, epaisseur:1.0 },
  neige:     { c:[224,244,255], h:[158,212,240], ciel:"nuage",       chute:"neige",
               vitesse:0.46, densite:1.00, eclat:0.82, fondu:0.088, epaisseur:1.8 },
  orage:     { c:[182,126,255], h:[108,42,216],  ciel:"orage",       chute:"pluie",
               vitesse:1.70, densite:1.00, eclat:1.00, fondu:0.045, epaisseur:0.8 }
};

function rgba(c, a) {
  return "rgba(" + (c[0] | 0) + "," + (c[1] | 0) + "," + (c[2] | 0) + "," + a.toFixed(3) + ")";
}
function melange(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function demarrerFond() {
  const cvs = document.getElementById("fond");
  const ctx = cvs.getContext("2d");
  const cvsCiel = document.getElementById("ciel");
  const ciel = cvsCiel.getContext("2d");
  let W = 0, H = 0, CX = 0, CY = 0, R = 0, ECH = 1, SX = 0, SY = 0;

  function dimensionner() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = cvs.width = cvsCiel.width = Math.max(1, Math.floor(cvs.parentNode.clientWidth * dpr));
    H = cvs.height = cvsCiel.height = Math.max(1, Math.floor(cvs.parentNode.clientHeight * dpr));
    for (const c of [cvs, cvsCiel]) {
      c.style.width = cvs.parentNode.clientWidth + "px";
      c.style.height = cvs.parentNode.clientHeight + "px";
    }
    CX = W * 0.5;
    CY = H * 0.40;
    R = W * 0.19;
    ECH = W / 400;
    SX = W * 0.83;        // l'objet du ciel, dégagé du grand chiffre de l'heure
    SY = H * 0.155;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);
  }
  dimensionner();
  window.addEventListener("resize", dimensionner);

  // ── Le disque : orbites képlériennes, les proches vont plus vite ──
  const grains = [];
  for (let i = 0; i < 440; i++) {
    const r = 1.02 + Math.pow(Math.random(), 1.7) * 2.6;
    grains.push({
      a: Math.random() * TAU, r: r, e: 0.10 + Math.random() * 0.10,
      v: 0.021 / Math.pow(r, 1.5), l: 0.35 + Math.random() * 0.65,
      xp: 0, yp: 0, x: 0, y: 0, neuf: true
    });
  }

  // ── Ce qui tombe du ciel et se fait happer ──
  const tombants = [];
  for (let i = 0; i < 170; i++) tombants.push({});

  function naitre(p, type, partout) {
    p.type = type;
    p.x = (Math.random() * 1.5 - 0.25) * W;
    p.y = partout ? Math.random() * CY : -Math.random() * H * 0.35;
    p.vx = 0;
    p.taille = 0.9 + Math.random() * 1.4;
    p.phase = Math.random() * TAU;
    if (type === "neige") { p.vy = (1.2 + Math.random() * 0.8) * ECH; p.taille *= 1.9; }
    else if (type === "brume") { p.vy = (0.12 + Math.random() * 0.18) * ECH; p.vx = (Math.random() - 0.5) * ECH; p.taille *= 4; }
    else { p.vy = (3.0 + Math.random() * 2.4) * ECH; }
  }
  for (const p of tombants) naitre(p, "pluie", true);

  const etat = Object.assign({}, TEMPS.nuage);
  etat.c = TEMPS.nuage.c.slice();
  etat.h = TEMPS.nuage.h.slice();
  let cible = TEMPS.nuage, nuit = 0, cibleNuit = 0;
  let eclair = 0, traitsEclair = null, lueurAnneau = 0, derive = 0;

  function ambiance(famille, estJour) {
    const clef = (famille === "clair" && estJour === false) ? "clairNuit" : famille;
    const suivant = TEMPS[clef] || TEMPS.nuage;
    if (suivant.chute !== cible.chute && suivant.chute) {
      for (const p of tombants) naitre(p, suivant.chute, true);
    }
    cible = suivant;
    cibleNuit = estJour === false ? 1 : 0;
  }

  // ── Le ciel : soleil, lune, nuage, orage ──
  function dessinerCiel(gain) {
    const sr = R * 0.42;
    const teinte = etat.c, ombre = etat.h;
    ciel.globalCompositeOperation = "lighter";

    if (etat.ciel === "soleil" || etat.ciel === "lune" || etat.ciel === "soleilVoile") {
      const halo = ciel.createRadialGradient(SX, SY, 0, SX, SY, sr * 2.8);
      halo.addColorStop(0, rgba(teinte, 0.40 * gain));
      halo.addColorStop(0.24, rgba(ombre, 0.14 * gain));
      halo.addColorStop(1, rgba(ombre, 0));
      ciel.fillStyle = halo;
      ciel.beginPath(); ciel.arc(SX, SY, sr * 2.8, 0, TAU); ciel.fill();

      ciel.fillStyle = rgba(melange(teinte, [255, 255, 255], 0.45), 0.95 * gain);
      ciel.beginPath(); ciel.arc(SX, SY, sr, 0, TAU); ciel.fill();

      if (etat.ciel === "lune") {            // on creuse le croissant
        ciel.globalCompositeOperation = "destination-out";
        ciel.beginPath(); ciel.arc(SX + sr * 0.42, SY - sr * 0.30, sr * 0.92, 0, TAU); ciel.fill();
        ciel.globalCompositeOperation = "lighter";
      }
    }

    const nom = etat.ciel === "soleilVoile" ? "soleilVoile"
      : (etat.chute === "pluie" && etat.ciel === "orage") ? "orage"
      : etat.chute === "pluie" ? "pluie"
      : etat.chute === "neige" ? "neige"
      : etat.ciel === "nuage" ? "nuage" : null;

    if (nom) {
      const gris = nom === "soleilVoile" ? [150, 164, 178] : etat.h;
      const corps = melange(gris, [255, 255, 255], 0.22);
      const banc = BANCS[nom];
      ciel.globalCompositeOperation = "source-over";

      for (let n = 0; n < banc.length; n++) {
        const cl = banc[n];
        // Dérive lente, rebouclée hors cadre pour qu'aucun nuage ne surgisse.
        let xf = cl[0] + derive * cl[4];
        xf = ((xf + 0.45) % 1.9 + 1.9) % 1.9 - 0.45;
        const nx = nom === "soleilVoile" ? SX + sr * 0.55 : W * xf;
        const ny = nom === "soleilVoile" ? SY + sr * 0.28 : H * cl[1];
        const ech = sr * cl[2];

        // Les nuages s'estompent à gauche, là où se lisent l'heure et la
        // température : un banc opaque derrière le texte le rendrait sourd.
        const degage = nom === "soleilVoile" ? 1
          : 0.17 + 0.83 * Math.max(0, Math.min(1, (xf - 0.48) / 0.28));
        const al = cl[3] * degage * 0.82 * gain;
        if (al < 0.01) continue;

        const bulles = cl[2] > 0.9
          ? [[-1.10, 0.28, 0.58], [-0.55, 0.00, 0.88], [0.05, -0.20, 1.02],
             [0.72, 0.06, 0.84], [1.35, 0.30, 0.56]]
          : [[-0.70, 0.20, 0.62], [0.00, -0.12, 0.94], [0.78, 0.18, 0.66]];
        for (let i = 0; i < bulles.length; i++) {
          const bx = nx + bulles[i][0] * ech;
          const by = ny + bulles[i][1] * ech;
          const br = ech * bulles[i][2];
          const b = ciel.createRadialGradient(bx, by, br * 0.15, bx, by, br);
          b.addColorStop(0, rgba(corps, al));
          b.addColorStop(0.62, rgba(corps, al * 0.78));
          b.addColorStop(1, rgba(corps, 0));
          ciel.fillStyle = b;
          ciel.beginPath(); ciel.arc(bx, by, br, 0, TAU); ciel.fill();
        }
      }
      ciel.globalCompositeOperation = "lighter";
    }
  }

  // Un trait d'éclair : une ligne brisée dont l'écart s'annule aux extrémités,
  // pour qu'elle parte et arrive exactement où on la veut.
  function cheminEclair(x0, y0, x1, y1, ecart, segments) {
    const pts = [[x0, y0]];
    const dx = x1 - x0, dy = y1 - y0;
    const l = Math.sqrt(dx * dx + dy * dy) || 1;
    for (let k = 1; k <= segments; k++) {
      const t = k / segments;
      const j = (Math.random() - 0.5) * 2 * ecart * Math.sin(Math.PI * t);
      pts.push([x0 + dx * t - (dy / l) * j, y0 + dy * t + (dx / l) * j]);
    }
    return pts;
  }

  function nouvelEclair() {
    traitsEclair = [];

    // Le nuage frappe l'horizon.
    traitsEclair.push({
      pts: cheminEclair(SX, SY + R * 0.5, CX, CY - R * 0.9, W * 0.07, 7),
      large: 1
    });

    // Et le trou noir décharge : deux à quatre jets qui jaillissent du bord.
    const combien = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < combien; i++) {
      const a = Math.PI + Math.random() * Math.PI;      // arc supérieur
      const x0 = CX + Math.cos(a) * R * 1.02;
      const y0 = CY + Math.sin(a) * R * 1.02;
      const portee = R * (1.3 + Math.random() * 1.7);
      const x1 = x0 + Math.cos(a) * portee;
      const y1 = y0 + Math.sin(a) * portee * 0.85;
      traitsEclair.push({ pts: cheminEclair(x0, y0, x1, y1, R * 0.17, 7), large: 0.85 });

      // Une ramification sur la plupart des jets.
      if (Math.random() < 0.7) {
        const j = 2 + Math.floor(Math.random() * 3);
        const bx = x0 + (x1 - x0) * (j / 7), by = y0 + (y1 - y0) * (j / 7);
        const ba = a + (Math.random() - 0.5) * 1.2;
        traitsEclair.push({
          pts: cheminEclair(bx, by, bx + Math.cos(ba) * portee * 0.55,
                            by + Math.sin(ba) * portee * 0.5, R * 0.11, 4),
          large: 0.5
        });
      }
    }
    lueurAnneau = Math.min(1, lueurAnneau + 0.55);      // l'anneau s'embrase
  }

  function dessinerEclair(gain) {
    if (!traitsEclair) return;
    ciel.globalCompositeOperation = "lighter";
    ciel.lineJoin = "round"; ciel.lineCap = "round";
    for (let passe = 0; passe < 2; passe++) {
      for (let n = 0; n < traitsEclair.length; n++) {
        const t = traitsEclair[n];
        ciel.strokeStyle = passe === 0 ? rgba(etat.c, 0.42 * eclair * gain)
                                       : rgba([255, 255, 255], 0.92 * eclair * gain);
        ciel.lineWidth = (passe === 0 ? 9 : 2) * ECH * t.large;
        ciel.beginPath();
        ciel.moveTo(t.pts[0][0], t.pts[0][1]);
        for (let i = 1; i < t.pts.length; i++) ciel.lineTo(t.pts[i][0], t.pts[i][1]);
        ciel.stroke();
      }
    }
  }

  // ── La chute, courbée par la gravité du trou noir ──
  function dessinerChute(gain) {
    if (!etat.chute) return;
    const teinte = melange(etat.c, [255, 255, 255], 0.15);
    ciel.globalCompositeOperation = "lighter";

    for (let i = 0; i < tombants.length; i++) {
      const p = tombants[i];
      if (p.type !== etat.chute) naitre(p, etat.chute, true);

      const dx = CX - p.x, dy = CY - p.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      // Attraction newtonienne, bornée près de l'horizon pour rester stable.
      // Les flocons et la brume, plus légers, doivent d'abord tomber :
      // une attraction lointaine trop forte les aspirerait en entonnoir.
      const prise = p.type === "pluie" ? 2.3 : p.type === "neige" ? 1.0 : 0.6;
      const f = prise * ECH * R * R / Math.max(d * d, R * R * 0.36);
      const xa = p.x, ya = p.y;
      p.vx += (dx / d) * f;
      p.vy += (dy / d) * f + 0.05 * ECH;
      if (p.type === "neige") { p.phase += 0.035; p.vx += Math.sin(p.phase) * 0.05 * ECH; }

      // Vitesse bornée à un demi-rayon par image : sans cela une goutte
      // très accélérée sauterait par-dessus l'horizon sans être happée.
      const vit = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
      const max = R * 0.5;
      if (vit > max) { p.vx = p.vx / vit * max; p.vy = p.vy / vit * max; }
      p.x += p.vx; p.y += p.vy;

      // Avalée : une lueur parcourt l'anneau, et la goutte renaît en haut.
      if (d < R * 1.03) { lueurAnneau = Math.min(1, lueurAnneau + 0.30); naitre(p, etat.chute); continue; }
      if (p.x < -W * 0.35 || p.x > W * 1.35) { naitre(p, etat.chute); continue; }

      // La météo appartient à la scène du trou noir : elle s'éteint sous le
      // disque plutôt que de pleuvoir sur la frise et la bande des jours.
      const sol = CY + R * 0.3;
      const reste = p.y > sol ? 1 - (p.y - sol) / (R * 0.7) : 1;
      if (reste <= 0) { naitre(p, etat.chute); continue; }

      const proche = Math.max(0, 1 - (d - R) / (R * 2.6));
      const alpha = (0.30 + 0.55 * proche) * gain * reste;

      if (p.type === "neige") {
        ciel.fillStyle = rgba(teinte, alpha);
        ciel.beginPath(); ciel.arc(p.x, p.y, p.taille * ECH * 0.9, 0, TAU); ciel.fill();
      } else if (p.type === "brume") {
        ciel.fillStyle = rgba(teinte, alpha * 0.16);
        ciel.beginPath();
        ciel.ellipse(p.x, p.y, p.taille * ECH * 9, p.taille * ECH * 1.5, 0, 0, TAU);
        ciel.fill();
      } else {
        ciel.strokeStyle = rgba(teinte, alpha);
        ciel.lineWidth = p.taille * ECH * 0.8;
        ciel.lineCap = "round";
        ciel.beginPath(); ciel.moveTo(xa, ya); ciel.lineTo(p.x, p.y); ciel.stroke();
      }
    }
  }

  // ── Le disque ──
  function dessinerHorizon(gain, teinteDisque) {
    ctx.globalCompositeOperation = "source-over";
    const creux = ctx.createRadialGradient(CX, CY, R * 0.94, CX, CY, R * 1.1);
    creux.addColorStop(0, "rgba(0,0,0,1)");
    creux.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = creux;
    ctx.beginPath(); ctx.arc(CX, CY, R * 1.1, 0, TAU); ctx.fill();

    // Anneau de photons, arc supérieur seulement : c'est le disque passant
    // devant, en bas, qui referme la silhouette en dôme.
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "butt";
    const vif = Math.min(1, 0.80 + lueurAnneau * 0.6);
    ctx.strokeStyle = rgba(melange(teinteDisque, [255, 255, 255], 0.4), vif * gain);
    ctx.lineWidth = (1.8 + lueurAnneau * 2.4) * ECH * 0.5;
    ctx.beginPath(); ctx.arc(CX, CY, R * 1.02, Math.PI, TAU); ctx.stroke();
    ctx.strokeStyle = rgba(teinteDisque, (0.22 + lueurAnneau * 0.35) * gain);
    ctx.lineWidth = 7;
    ctx.beginPath(); ctx.arc(CX, CY, R * 1.06, Math.PI, TAU); ctx.stroke();
    ctx.lineCap = "round";
  }

  function dessinerNappes(gain, lointain, teinteDisque) {
    ctx.globalCompositeOperation = "lighter";
    const depart = lointain ? Math.PI : 0;
    const arrivee = lointain ? TAU : Math.PI;
    const couches = [[1.03, 1.8, 0.62], [1.14, 1.3, 0.38], [1.42, 1.0, 0.20], [1.95, 0.8, 0.11]];
    for (let i = 0; i < couches.length; i++) {
      const rr = couches[i][0], large = couches[i][1], al = couches[i][2];
      ctx.strokeStyle = rgba(teinteDisque, al * gain * (lointain ? 0.45 : 1) * 0.5);
      ctx.lineWidth = large * Math.max(1, etat.epaisseur * 0.8);
      ctx.beginPath();
      ctx.ellipse(CX, CY, R * rr, R * rr * 0.16, 0, depart, arrivee);
      ctx.stroke();
    }
  }

  function dessinerGrains(visibles, gain, lointain, teinteDisque) {
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < visibles; i++) {
      const g = grains[i];
      if ((Math.sin(g.a) < 0) !== lointain) continue;

      // Effet de phare : le côté qui vient vers nous brille davantage.
      const phare = 0.28 + 0.72 * (0.5 + 0.5 * Math.cos(g.a));
      const chute = 0.30 + 0.70 * Math.max(0, 1 - (g.r - 1) / 3);
      const alpha = Math.min(g.l * phare * chute * gain * (lointain ? 0.45 : 1) * 0.85, 0.95);

      ctx.strokeStyle = rgba(teinteDisque, alpha);
      ctx.lineWidth = (0.6 + g.l * 1.1) * etat.epaisseur;
      ctx.beginPath();
      ctx.moveTo(g.xp, g.yp);
      ctx.lineTo(g.x, g.y);
      ctx.stroke();
    }
  }

  function boucle() {
    const k = 0.045;
    etat.vitesse += (cible.vitesse - etat.vitesse) * k;
    etat.densite += (cible.densite - etat.densite) * k;
    etat.eclat += (cible.eclat - etat.eclat) * k;
    etat.fondu += (cible.fondu - etat.fondu) * k;
    etat.epaisseur += (cible.epaisseur - etat.epaisseur) * k;
    for (let i = 0; i < 3; i++) {
      etat.c[i] += (cible.c[i] - etat.c[i]) * k;
      etat.h[i] += (cible.h[i] - etat.h[i]) * k;
    }
    etat.ciel = cible.ciel;
    etat.chute = cible.chute;
    nuit += (cibleNuit - nuit) * k;
    lueurAnneau *= 0.92;
    derive += 0.0016;

    const gain = (1 - nuit * 0.42) * etat.eclat;
    // Le disque reste blanc, juste teinté par le temps qu'il fait.
    const teinteDisque = melange([255, 255, 255], etat.c, 0.32);

    // Toile du disque : on assombrit, on n'efface pas.
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "rgba(0,0,0," + etat.fondu.toFixed(3) + ")";
    ctx.fillRect(0, 0, W, H);

    const visibles = Math.min(grains.length, Math.max(1, Math.round(grains.length * etat.densite)));
    for (let i = 0; i < grains.length; i++) {
      const g = grains[i];
      g.a += g.v * etat.vitesse;
      if (g.a > TAU) g.a -= TAU;
      g.x = CX + Math.cos(g.a) * g.r * R;
      g.y = CY + Math.sin(g.a) * g.r * R * g.e;
      if (g.neuf) { g.xp = g.x; g.yp = g.y; g.neuf = false; }
    }

    ctx.lineCap = "round";
    dessinerNappes(gain, true, teinteDisque);
    dessinerGrains(visibles, gain, true, teinteDisque);
    dessinerHorizon(gain, teinteDisque);
    dessinerNappes(gain, false, teinteDisque);
    dessinerGrains(visibles, gain, false, teinteDisque);
    for (let i = 0; i < grains.length; i++) { grains[i].xp = grains[i].x; grains[i].yp = grains[i].y; }
    ctx.globalCompositeOperation = "source-over";

    // Toile du ciel : réeffacée, donc rien n'y accumule.
    ciel.setTransform(1, 0, 0, 1, 0, 0);
    ciel.clearRect(0, 0, W, H);
    dessinerCiel(gain);
    dessinerChute(gain);

    if (etat.ciel === "orage") {
      if (eclair < 0.02 && Math.random() < 0.020) { nouvelEclair(); eclair = 1; }
      eclair *= 0.80;
      if (eclair > 0.02) dessinerEclair(gain);
    } else { eclair = 0; traitsEclair = null; }

    ciel.globalCompositeOperation = "source-over";
    requestAnimationFrame(boucle);
  }
  requestAnimationFrame(boucle);

  return { ambiance: ambiance, redimensionner: dimensionner };
}
`

const JS_INTERACTIF = `
const H = DONNEES.heures;
const elPage = document.getElementById("page");
const elHeure = document.getElementById("heure");
const elTemp = document.getElementById("temp");
const elQuand = document.getElementById("quand");
const elEtat = document.getElementById("etat");
const elVille = document.getElementById("ville");
const elFrise = document.getElementById("frise");
const elCourbe = document.getElementById("courbe");
const elReperes = document.getElementById("reperes");
const elBande = document.getElementById("bande");
const elCurseur = document.getElementById("curseur");
const elPastille = document.getElementById("pastille");

elVille.textContent = DONNEES.ville;
const FOND = demarrerFond();

// ── Frise des 48 prochaines heures ──
const L = 1000, HT = 380, BAS = 48, HAUT = 30;   // HT = hauteur CSS de #frise
const temps = H.map(function (x) { return x.t; });
const tMin = Math.min.apply(null, temps), tMax = Math.max.apply(null, temps);
const etendue = (tMax - tMin) || 1;
const px = function (i) { return (i / (H.length - 1)) * L; };
const pc = function (i) { return (i / (H.length - 1)) * 100; };
const py = function (t) { return HAUT + (HT - BAS - HAUT) * (1 - (t - tMin) / etendue); };

// La couleur du temps, ramenée vers le blanc pour rester lisible sur le noir.
function tonHeure(x) {
  const clef = (x.f === "clair" && !x.d) ? "clairNuit" : x.f;
  const c = (TEMPS[clef] || TEMPS.nuage).c;
  return "rgb(" + Math.round(255 - (255 - c[0]) * 0.62)
       + "," + Math.round(255 - (255 - c[1]) * 0.62)
       + "," + Math.round(255 - (255 - c[2]) * 0.62) + ")";
}

elCourbe.setAttribute("viewBox", "0 0 " + L + " " + HT);

// Les heures sans soleil sont assombries : on lit les nuits d'un coup d'œil.
let nuits = "", debutNuit = -1;
for (let i = 0; i <= H.length; i++) {
  const estNuit = i < H.length && !H[i].d;
  if (estNuit && debutNuit < 0) debutNuit = i;
  if (!estNuit && debutNuit >= 0) {
    nuits += '<rect x="' + px(debutNuit).toFixed(1) + '" y="0" width="'
      + (px(i) - px(debutNuit)).toFixed(1) + '" height="' + (HT - BAS)
      + '" fill="#9dc0ff" opacity=".06"/>';
    debutNuit = -1;
  }
}

// Une coupure verticale à chaque changement de journée.
let coupures = "";
for (let i = 1; i < H.length; i++) {
  if (H[i].dt !== H[i - 1].dt) {
    coupures += '<line x1="' + px(i).toFixed(1) + '" y1="0" x2="' + px(i).toFixed(1)
      + '" y2="' + (HT - BAS + 12) + '" stroke="#fff" stroke-opacity=".2" stroke-width="1"'
      + ' stroke-dasharray="2 6" vector-effect="non-scaling-stroke"/>';
  }
}

let ligne = "", aire = "M0," + (HT - BAS);
H.forEach(function (x, i) {
  const c = px(i).toFixed(1) + "," + py(x.t).toFixed(1);
  ligne += (i ? "L" : "M") + c;
  aire += "L" + c;
});
aire += "L" + L + "," + (HT - BAS) + "Z";

// Le trait prend la couleur du temps, heure par heure.
let teintes = "";
H.forEach(function (x, i) {
  teintes += '<stop offset="' + pc(i).toFixed(2) + '%" stop-color="' + tonHeure(x) + '"/>';
});

elCourbe.innerHTML =
    '<defs>'
  + '<linearGradient id="aire" x1="0" y1="0" x2="0" y2="1">'
  + '<stop offset="0" stop-color="#fff" stop-opacity=".22"/>'
  + '<stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>'
  + '<linearGradient id="trait" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="' + L + '" y2="0">'
  + teintes + '</linearGradient></defs>'
  + nuits + coupures
  + '<path d="' + aire + '" fill="url(#aire)"/>'
  + '<path d="' + ligne + '" fill="none" stroke="url(#trait)" stroke-width="2.4"'
  + ' vector-effect="non-scaling-stroke" stroke-linejoin="round" stroke-linecap="round"/>';

// Repères en HTML : le SVG est étiré en largeur, textes et pastilles y
// seraient écrasés. Le pourcentage les cale exactement sur la courbe.
let marques = "";
for (let i = 0; i < H.length; i += 6) {
  const bord = i === 0 ? " gauche" : (i > H.length - 4 ? " droite" : "");
  marques += '<span class="hr' + bord + '" style="left:' + pc(i).toFixed(2) + '%">'
    + H[i].h + '</span>';
}
let jourCourant = null;
H.forEach(function (x, i) {
  if (x.dt === jourCourant) return;
  jourCourant = x.dt;
  marques += '<span class="jr" style="left:' + pc(i).toFixed(2) + '%">'
    + (i === 0 ? "AUJ." : x.j) + '</span>';
});
// L'étiquette d'un extrême se pose du côté où il reste de la place : sinon
// celle du minimum vient s'écraser sur la rangée des heures.
const iMax = temps.indexOf(tMax), iMin = temps.indexOf(tMin);
[[iMax, tMax, py(tMax) < 24 ? "bas" : "haut"],
 [iMin, tMin, py(tMin) > HT - BAS - 28 ? "haut" : "bas"]].forEach(function (e) {
  const g = "left:" + pc(e[0]).toFixed(2) + "%;top:" + (py(e[1]) / HT * 100).toFixed(2) + "%";
  marques += '<i class="pt" style="' + g + '"></i>'
    + '<span class="ex ' + e[2] + '" style="' + g + '">' + Math.round(e[1]) + '°</span>';
});
elReperes.innerHTML = marques;

// ── Affichage d'une heure ──
let indexActuel = -1;

function relancer(el, arriere) {
  el.classList.remove("avant", "arriere");
  void el.offsetWidth;                      // force le navigateur à rejouer l'animation
  el.classList.add(arriere ? "arriere" : "avant");
}

function afficher(i) {
  if (i === indexActuel) return;
  const premier = indexActuel < 0;
  const arriere = !premier && i < indexActuel;
  indexActuel = i;
  const x = H[i];

  elHeure.textContent = x.h + "H";
  elTemp.textContent = Math.round(x.t) + "°";
  elEtat.textContent = x.l;
  elQuand.textContent = i === 0 ? "MAINTENANT" : x.j + "  ·  +" + i + "H";
  FOND.ambiance(x.f, x.d);

  if (!premier) {
    relancer(elHeure, arriere);
    relancer(elTemp, arriere);
  }

  const r = elFrise.getBoundingClientRect();
  const gx = (px(i) / L) * r.width;
  elCurseur.style.left = gx + "px";
  elBande.style.left = gx + "px";
  elPastille.style.left = gx + "px";
  elPastille.style.top = (py(x.t) / HT) * r.height + "px";
}

// ── Glissement du doigt ──
function depuisPointeur(e) {
  const r = elFrise.getBoundingClientRect();
  const p = e.touches && e.touches.length ? e.touches[0] : e;
  const ratio = Math.min(Math.max((p.clientX - r.left) / r.width, 0), 1);
  afficher(Math.round(ratio * (H.length - 1)));
}

let actif = false;
function ouvrir(e) { actif = true; elPage.classList.add("scrute"); depuisPointeur(e); }
function fermer() { actif = false; elPage.classList.remove("scrute"); }

elFrise.addEventListener("touchstart", function (e) { ouvrir(e); e.preventDefault(); }, { passive: false });
elFrise.addEventListener("touchmove", function (e) {
  if (actif) { depuisPointeur(e); e.preventDefault(); }
}, { passive: false });
elFrise.addEventListener("touchend", fermer);
elFrise.addEventListener("touchcancel", fermer);
elFrise.addEventListener("mousedown", ouvrir);
window.addEventListener("mousemove", function (e) { if (actif) depuisPointeur(e); });
window.addEventListener("mouseup", fermer);
window.addEventListener("resize", function () {
  const i = indexActuel < 0 ? 0 : indexActuel; indexActuel = -1; afficher(i);
});

afficher(0);
`

// ── Exécution ──────────────────────────────────────────────────

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

const famille = config.widgetFamily || "large"

if (config.runsInWidget) {
  Script.setWidget(donnees ? construire(donnees, famille, horsLigne) : vueErreur(messageErreur))
} else if (donnees && !CONFIG.apercuWidget) {
  await vueInteractive(donnees)
} else {
  const apercu = donnees ? construire(donnees, famille, horsLigne) : vueErreur(messageErreur)
  if (famille === "small") await apercu.presentSmall()
  else if (famille === "medium") await apercu.presentMedium()
  else await apercu.presentLarge()
}

Script.complete()
