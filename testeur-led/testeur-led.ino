/*
  Testeur de LED de rétroéclairage TV (LG Innotek DRT 3.0, LED d'environ 6 V)
  Carte : Elegoo UNO R3

  L'Arduino ne donne que 5 V, trop peu pour ces LED. C'est donc la pile 9 V
  qui alimente la LED, et l'Arduino l'allume via le transistor PN2222.
  Il mesure ensuite la tension pour dire si la LED est bonne.

  Branchement (une seule LED à la fois) :

    Pile 9V (+) ── résistance 220 Ω ──┬── patte (+) de la LED
                                      │
                                   10 kΩ
                                      │
                                      ├──────────── A0
                                      │
                                   10 kΩ
                                      │
                                     GND

    patte (–) de la LED ── C (collecteur) du PN2222
    Broche 7 ── résistance 1 kΩ ── B (base) du PN2222
    E (émetteur) du PN2222 ── GND
    Pile 9V (–) ── GND de l'Arduino   (indispensable : masse commune)

  Ouvrir le Moniteur série à 9600 bauds pour lire les résultats.
*/

const int PIN_TRANSISTOR = 7;
const int PIN_MESURE = A0;
const int PIN_LED_CARTE = 13;

const float VREF = 5.0;             // tension de référence de l'UNO
const float FACTEUR_DIVISEUR = 2.0; // deux résistances de 10 kΩ
const float RESISTANCE = 220.0;     // résistance en série avec la LED

// Moyenne de plusieurs lectures pour lisser le bruit, en volts
float lireTension() {
  long somme = 0;
  for (int i = 0; i < 20; i++) {
    somme += analogRead(PIN_MESURE);
    delay(2);
  }
  return (somme / 20.0) * VREF / 1023.0 * FACTEUR_DIVISEUR;
}

void setup() {
  pinMode(PIN_TRANSISTOR, OUTPUT);
  pinMode(PIN_LED_CARTE, OUTPUT);
  digitalWrite(PIN_TRANSISTOR, LOW);
  Serial.begin(9600);
  Serial.println(F("=== Testeur de LED de retroeclairage ==="));
  Serial.println(F("Un test toutes les 3 secondes. Deplace les fils d'une LED a l'autre."));
  Serial.println();
}

void loop() {
  // 1) Transistor bloqué : on mesure la tension de la pile
  digitalWrite(PIN_TRANSISTOR, LOW);
  delay(50);
  float vPile = lireTension();

  // 2) Transistor passant : le courant traverse la LED
  digitalWrite(PIN_TRANSISTOR, HIGH);
  digitalWrite(PIN_LED_CARTE, HIGH);
  delay(50);
  float vLed = lireTension();
  delay(1000); // on laisse la LED allumée 1 s pour la voir
  digitalWrite(PIN_TRANSISTOR, LOW);
  digitalWrite(PIN_LED_CARTE, LOW);

  float courant_mA = (vPile - vLed) / RESISTANCE * 1000.0;

  Serial.print(F("Pile : "));
  Serial.print(vPile, 2);
  Serial.print(F(" V | LED : "));
  Serial.print(vLed, 2);
  Serial.print(F(" V | Courant : "));
  Serial.print(courant_mA, 1);
  Serial.print(F(" mA  ->  "));

  if (vPile < 3.0) {
    Serial.println(F("Pile non detectee : verifie la pile et le fil GND commun."));
  } else if (courant_mA < 2.0) {
    Serial.println(F("AUCUN COURANT : LED morte, ou branchee a l'envers (inverse ses fils)."));
  } else if (vLed < 2.0) {
    Serial.println(F("COURT-CIRCUIT : LED en court-circuit, ou fils qui se touchent."));
  } else if (vLed < 4.5) {
    Serial.println(F("DOUTEUSE : tension trop basse pour une LED de 6 V (puce interne grillee ?)."));
  } else {
    Serial.println(F("LED OK"));
  }

  if (vPile >= 3.0 && vPile < 7.0) {
    Serial.println(F("   (attention : pile 9 V faible, remplace-la si les resultats sont bizarres)"));
  }

  delay(2000);
}
