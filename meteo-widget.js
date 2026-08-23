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
  villeParDefaut: "Paris",  // repli si le GPS est indisponible
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

  const [libelle, symbole] = infoMeteo(actuel.weather_code, actuel.is_day === 1)
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
    libelle, symbole,
    min: json.daily.temperature_2m_min[0],
    max: json.daily.temperature_2m_max[0],
    heures, jours,
    horodatage: Date.now()
  }
}

// ── Dessin : fond « trou noir » ────────────────────────────────

function fondTrouNoir(largeur, hauteur) {
  const dc = new DrawContext()
  dc.size = new Size(largeur, hauteur)
  dc.opaque = true
  dc.respectScreenScale = true

  dc.setFillColor(new Color("#000000"))
  dc.fillRect(new Rect(0, 0, largeur, hauteur))

  // Halo diffus le long du bord inférieur : la lueur du disque.
  const cx = largeur / 2
  const cy = hauteur * 1.02
  for (let i = 14; i >= 1; i--) {
    const rx = largeur * (0.30 + i * 0.075)
    const ry = 14 + i * 8
    dc.setFillColor(new Color(BLANC, 0.014))
    dc.fillEllipse(new Rect(cx - rx, cy - ry, rx * 2, ry * 2))
  }

  // Filaments du disque d'accrétion.
  for (let i = 0; i < 6; i++) {
    const rx = largeur * (0.34 + i * 0.075)
    const ry = 6 + i * 6.5
    dc.setStrokeColor(new Color(BLANC, 0.13 - i * 0.019))
    dc.setLineWidth(1)
    dc.strokeEllipse(new Rect(cx - rx, cy - ry, rx * 2, ry * 2))
  }

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
  dc.setLineWidth(1.6)
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
  dc.drawTextInRect(Math.round(tMin) + "°",
    new Rect(Math.min(Math.max(x(iMin) - 22, 0), largeur - 44), Math.min(y(tMin) + 2, margeHaute + hCourbe - 2), 44, 13))

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

  const graphe = w.addImage(grapheHoraire(d.heures, 620, 190))
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
  w.backgroundImage = fondTrouNoir(dimensions[0], dimensions[1])
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
    })),
    jours: d.jours.map(j => ({
      n: j.nom, f: j.famille, x: j.max, m: j.min, dt: j.dateISO
    }))
  })

  const html = "<!DOCTYPE html><html lang='fr'><head>"
    + "<meta charset='utf-8'>"
    + "<meta name='viewport' content='width=device-width,initial-scale=1,viewport-fit=cover,user-scalable=no'>"
    + "<style>" + CSS_INTERACTIF + "</style></head><body>"
    + CORPS_INTERACTIF
    + "<script>const DONNEES = " + charge + ";" + JS_INTERACTIF + "<\/script>"
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

/* Le halo et le disque d'accrétion, sous tout le reste. */
#halo { position:fixed; left:50%; bottom:-56vh; width:200vw; height:96vh; transform:translateX(-50%);
  background:radial-gradient(ellipse at 50% 50%, rgba(255,255,255,.22) 0%, rgba(255,255,255,.05) 36%,
  rgba(255,255,255,0) 70%); pointer-events:none; z-index:0; }
#disque { position:fixed; left:50%; bottom:-13vh; width:165vw; height:26vh; transform:translateX(-50%);
  border-radius:50%; border-top:1px solid rgba(255,255,255,.55);
  box-shadow:0 -1px 30px rgba(255,255,255,.30), inset 0 8px 40px rgba(255,255,255,.10);
  pointer-events:none; z-index:0; }

#page { position:relative; z-index:1; height:100%; display:flex; flex-direction:column;
  padding:calc(env(safe-area-inset-top) + 24px) 24px calc(env(safe-area-inset-bottom) + 16px); }
#ville { font-size:12px; letter-spacing:.22em; opacity:.55; }
#quand { margin-top:22px; font-size:12px; letter-spacing:.2em; opacity:.55; height:15px; }
#temp { font-family:-apple-system,system-ui,sans-serif; font-weight:900; font-size:104px;
  line-height:.94; letter-spacing:-.05em; font-variant-numeric:tabular-nums; }
#etat { margin-top:4px; font-size:12px; letter-spacing:.2em; opacity:.62; height:16px; }
#glyphe { position:absolute; top:calc(env(safe-area-inset-top) + 78px); right:24px;
  width:74px; height:74px; opacity:.92; }

/* Bande des jours, comme en bas du widget. */
#jours { display:flex; justify-content:space-between; gap:2px; margin-top:auto; padding-top:16px;
  border-top:1px solid rgba(255,255,255,.12); }
.jour { flex:1; display:flex; flex-direction:column; align-items:center; gap:5px;
  opacity:.4; transition:opacity .18s ease; }
.jour.actif { opacity:1; }
.jour .nom { font-size:9px; letter-spacing:.06em; }
.jour svg { width:19px; height:19px; }
.jour .max { font-size:12px; font-weight:700; }
.jour .min { font-size:12px; opacity:.5; }

/* Frise de défilement, placée dans la zone du pouce. */
#frise { position:relative; margin-top:22px; height:300px; touch-action:none; }
#courbe { position:absolute; inset:0; width:100%; height:100%; }
#curseur { position:absolute; top:0; bottom:34px; width:1px; background:rgba(255,255,255,.75);
  transform:translateX(-.5px); }
#pastille { position:absolute; width:11px; height:11px; margin:-5.5px 0 0 -5.5px; border-radius:50%;
  background:#fff; box-shadow:0 0 14px rgba(255,255,255,.9); }
#heures { position:absolute; left:0; right:0; bottom:0; height:28px; display:flex;
  justify-content:space-between; font-size:10px; letter-spacing:.1em; opacity:.4; }
#aide { text-align:center; font-size:10px; letter-spacing:.18em; opacity:.3; margin-top:4px; }
`

const CORPS_INTERACTIF = `
<div id="halo"></div><div id="disque"></div>
<div id="page">
  <div id="ville"></div>
  <svg id="glyphe" viewBox="0 0 64 64"></svg>
  <div id="quand"></div>
  <div id="temp">--</div>
  <div id="etat"></div>
  <div id="jours"></div>
  <div id="frise">
    <svg id="courbe" preserveAspectRatio="none"></svg>
    <div id="curseur"></div>
    <div id="pastille"></div>
    <div id="heures"></div>
  </div>
  <div id="aide">GLISSER POUR PARCOURIR LES HEURES</div>
</div>
`

const JS_INTERACTIF = `
const H = DONNEES.heures;
const elTemp = document.getElementById("temp");
const elQuand = document.getElementById("quand");
const elEtat = document.getElementById("etat");
const elVille = document.getElementById("ville");
const elGlyphe = document.getElementById("glyphe");
const elJours = document.getElementById("jours");
const elFrise = document.getElementById("frise");
const elCourbe = document.getElementById("courbe");
const elCurseur = document.getElementById("curseur");
const elPastille = document.getElementById("pastille");
const elHeures = document.getElementById("heures");

elVille.textContent = DONNEES.ville;

// ── Glyphes météo, dessinés en blanc plein ──
function glyphe(famille, estJour) {
  const nuage = '<circle cx="24" cy="34" r="10"/><circle cx="39" cy="31" r="13"/>'
              + '<rect x="24" y="34" width="21" height="10" rx="5"/>';
  if (famille === "clair") {
    return estJour
      ? '<circle cx="32" cy="30" r="15"/>'
      : '<path d="M40 12a19 19 0 1 0 12 30A20 20 0 0 1 40 12z"/>';
  }
  if (famille === "voile") return '<circle cx="42" cy="22" r="10" opacity=".75"/>' + nuage;
  if (famille === "nuage") return nuage;
  if (famille === "brume") {
    return '<g fill="none" stroke="#fff" stroke-width="3.6" stroke-linecap="round">'
      + '<path d="M8 22q6-5 12 0t12 0 12 0 12 0"/>'
      + '<path d="M8 33q6-5 12 0t12 0 12 0 12 0" opacity=".72"/>'
      + '<path d="M8 44q6-5 12 0t12 0 12 0 12 0" opacity=".48"/></g>';
  }
  if (famille === "pluie") return nuage
    + '<rect x="23" y="48" width="2.5" height="9" rx="1.25" opacity=".8"/>'
    + '<rect x="32" y="50" width="2.5" height="9" rx="1.25" opacity=".8"/>'
    + '<rect x="41" y="48" width="2.5" height="9" rx="1.25" opacity=".8"/>';
  if (famille === "neige") return nuage
    + '<circle cx="24" cy="52" r="2.4" opacity=".8"/><circle cx="33" cy="55" r="2.4" opacity=".8"/>'
    + '<circle cx="42" cy="52" r="2.4" opacity=".8"/>';
  return nuage + '<path d="M34 47l-8 9h6l-3 8 10-11h-6z"/>';
}

// ── Bande des jours ──
let bande = "";
DONNEES.jours.forEach(function (j) {
  bande += '<div class="jour" data-jour="' + j.dt + '">'
    + '<div class="nom">' + j.n + '</div>'
    + '<svg viewBox="0 0 64 64" fill="#fff">' + glyphe(j.f, true) + '</svg>'
    + '<div class="max">' + Math.round(j.x) + '°</div>'
    + '<div class="min">' + Math.round(j.m) + '°</div></div>';
});
elJours.innerHTML = bande;
const colonnes = elJours.children;

// ── Courbe des 48 prochaines heures ──
const L = 1000, HT = 300, BAS = 34, HAUT = 26;   // HT = hauteur CSS de #frise
const temps = H.map(function (x) { return x.t; });
const tMin = Math.min.apply(null, temps), tMax = Math.max.apply(null, temps);
const etendue = (tMax - tMin) || 1;
const px = function (i) { return (i / (H.length - 1)) * L; };
const py = function (t) { return HAUT + (HT - BAS - HAUT) * (1 - (t - tMin) / etendue); };

elCourbe.setAttribute("viewBox", "0 0 " + L + " " + HT);

let ligne = "", aire = "M0," + (HT - BAS);
H.forEach(function (x, i) {
  const c = px(i).toFixed(1) + "," + py(x.t).toFixed(1);
  ligne += (i ? "L" : "M") + c;
  aire += "L" + c;
});
aire += "L" + L + "," + (HT - BAS) + "Z";

elCourbe.innerHTML =
    '<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">'
  + '<stop offset="0" stop-color="#fff" stop-opacity=".22"/>'
  + '<stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>'
  + '<path d="' + aire + '" fill="url(#g)"/>'
  + '<path d="' + ligne + '" fill="none" stroke="#fff" stroke-opacity=".85" stroke-width="2"'
  + ' vector-effect="non-scaling-stroke" stroke-linejoin="round"/>';

let reperes = "";
for (let i = 0; i < H.length; i += 6) reperes += "<span>" + H[i].h + "</span>";
elHeures.innerHTML = reperes;

// ── Affichage d'une heure ──
let indexActuel = -1;

function afficher(i) {
  if (i === indexActuel) return;
  indexActuel = i;
  const x = H[i];

  elTemp.textContent = Math.round(x.t) + "°";
  elEtat.textContent = x.l;
  elQuand.textContent = i === 0 ? "MAINTENANT" : x.j + " · " + x.h + "H  +" + i + "H";
  elGlyphe.innerHTML = '<g fill="#fff">' + glyphe(x.f, x.d) + "</g>";

  for (let k = 0; k < colonnes.length; k++) {
    colonnes[k].className = colonnes[k].dataset.jour === x.dt ? "jour actif" : "jour";
  }

  const r = elFrise.getBoundingClientRect();
  elCurseur.style.left = (px(i) / L) * r.width + "px";
  elPastille.style.left = (px(i) / L) * r.width + "px";
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
elFrise.addEventListener("touchstart", function (e) {
  actif = true; depuisPointeur(e); e.preventDefault();
}, { passive: false });
elFrise.addEventListener("touchmove", function (e) {
  if (actif) { depuisPointeur(e); e.preventDefault(); }
}, { passive: false });
elFrise.addEventListener("touchend", function () { actif = false; });
elFrise.addEventListener("mousedown", function (e) { actif = true; depuisPointeur(e); });
window.addEventListener("mousemove", function (e) { if (actif) depuisPointeur(e); });
window.addEventListener("mouseup", function () { actif = false; });
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
