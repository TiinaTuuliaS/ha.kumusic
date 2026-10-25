# ha.ku

Selainpohjainen Y2K-henkinen musiikkistudio vaalealla ja tummalla teemalla. Käyttäjä säveltää itse
esimerkiksi technoa, trip hopia, trancea ja eurodancea.

Toteutettuna on frontendin runko, aloitusnäkymä ja viiden raidan
16 askeleen biittiruudukko omalla sävellyssivullaan. Etusivun **Studio**
-kuvake avaa osoitteen `/#/studio`, ja sävellyssivulta pääsee takaisin etusivulle.
Selaimen takaisin- ja eteenpäin-painikkeet toimivat myös. Kevyt hash-navigointi
ei tarvitse reitityskirjastoa tai palvelimen reititysasetuksia.
Askeleita voi kytkeä päälle ja pois klikkaamalla
tai näppäimistöllä (Tab siirtää kohdistusta, välilyönti tai Enter vaihtaa valinnan).
Valitut askeleet näkyvät limenvihreinä. Pienellä näytöllä ruudukkoa voi vierittää
vaakasuunnassa. Valinnat ovat Reactin tilassa: ne säilyvät sivujen välillä
liikuttaessa ja nollautuvat sivun latauksessa.
Ruudukossa on omat synteettiset kick-, virveli-, taputus-, hi-hat- ja bassoäänet.
Äänet tuotetaan selaimen Web Audio API:lla ilman ulkoisia sampleja tai kirjastoja.
Basson jokaiselle askeleelle voi valita sävelen väliltä C2–B2, mukaan lukien
ylennetyt sävelet (#). Valinta tehdään askelruudun alla olevasta valikosta,
ja valittu sävel näkyy myös ruudussa. Valinta esikuuntelee sävelen;
toistossa soivat vain päälle kytketyt askeleet. Oletussävel on C2.
Sävelvalinnat säilyvät sivujen välillä ja nollautuvat sivun latauksessa.

Valitse askeleita ja paina **Toista**. Raidan nimestä voi esikuunnella äänen.
**Pysäytä** katkaisee toiston ja äänet. Tempo on 40–240 BPM; 16 askelta
muodostaa yhden 4/4-tahdin kuudestoistaosanuotteina. Toistuva askel näkyy
violetilla reunuksella. Toisto pysähtyy, kun poistut sävellyssivulta.
Ääni käynnistyy vasta käyttäjän painalluksesta.
Jokaisella raidalla on **▶ / ⏸** -painike. ▶ käynnistää raidan rytmin suoraan,
ja muita raitoja voi lisätä mukaan niiden painikkeista. ⏸ tauottaa kyseisen
raidan kuuntelun; muut jatkavat yhteisessä tempossa. Viimeisen raidan tauotus
pysäyttää toiston, ja seuraava käynnistys alkaa tahdin alusta.
**Toista kaikki** palauttaa kaikki raidat mukaan. Painikkeet eivät muuta
askelvalintoja. Raidan nimen painaminen esikuuntelee yksittäisen äänen.
Jokaisen raidan **Vol.**-liukusäädin säätää sen äänenvoimakkuutta välillä
0–100 %. Oletus on 100 % (aiempi voimakkuus), ja 0 % vaimentaa raidan.
Säätö vaikuttaa myös jo soiviin ääniin ja esikuunteluun. Muutokset tasoitetaan
lyhyellä liu'ulla napsahdusten välttämiseksi. Voimakkuudet säilyvät sivujen
välillä ja nollautuvat sivun latauksessa kuten rytmikuviot.

## Omat sivut

Studiossa on kaksi rytmikuviota, **A** ja **B**. Kummallakin on omat viiden
raidan askelvalinnat ja basson sävelet. Tempo, samplet ja voimakkuudet ovat
yhteiset. **Kopioi A → B** (tai B → A) kopioi nykyisen kuvion toiseen;
olemassa olevan rytmin korvaaminen vahvistetaan. Kuviot ovat toisistaan
riippumattomia. Muokattavan kuvion vaihto pysäyttää toiston.
Neljän tahdin **Soittojärjestys** valitsee jokaiseen tahtiin A:n tai B:n.
**Toista järjestys** soittaa tahdit peräkkäin ja toistaa järjestystä alusta;
vaihto tapahtuu äänikellon mukaan tahdin rajalla. Oranssi korostus ja
tekstinä näkyvä tahti/kuvio kertovat toiston paikan. Muokattava kuvio
pysyy valittuna: askelkorostus näkyy vain, kun juuri se kuvio soi.
**Toista kaikki** ja raitapainikkeet palaavat valitun yksittäisen kuvion
kuunteluun. Uuden työn oletus on A–A–A–B; vanha työ ilman järjestystä
avaa A–A–A–A:n. **Lataa WAV · järjestys** vie nämä neljä tahtia kertaalleen.
Molemmat kuviot tallentuvat kirjastoon ja JSON-varmuuskopioon.
Vanha yksikuviollinen työ avautuu kuviona A, ja B on tyhjä.
Studion WAV-vienti toistaa valittua kuviota neljä tahtia; kirjastossa
A:lle ja B:lle sekä tallennetulle järjestykselle on omat WAV-painikkeet.
JSON-vientiversio on nyt 4, ja versiot 1–3 ovat edelleen tuettuna.

Studion **Äänilähteet · omat WAV-samplet** -kohdasta voi tuoda kullekin
neljälle rumpuraidalle yhden WAV-rumpuiskun (enintään 10 Mt, 5 sekuntia,
mono/stereo). Tuotu sample esikuunnellaan ja otetaan käyttöön.
Äänilähdevalikosta voi vaihtaa takaisin synteesiin. Basso pysyy synteettisenä.
**Tallenna soundi** tallentaa myös omat samplet ja synteesi/sample-valinnat.
Kirjastosta avaaminen palauttaa ne myös uudelleenlatauksen jälkeen.
Uuden työn aloitus tyhjentää Studion samplevalinnat.
Sekä Studion että kirjaston WAV-vienti käyttävät kyseisen työn sampleja.
JSON-varmuuskopio sisältää myös samplejen äänidatan: alkuperäisiä tiedostoja
ei tarvitse siirtää erikseen. Samplet tallennetaan dekoodattuna PCM-äänenä
häviöttömästi suhteessa selaimessa käytettyyn ääneen; alkuperäistä WAV-tiedoston
metadataa ei säilytetä. Myös pois käytöstä kytketyt tuodut samplet säilyvät.
Äänimaailmojen tavoitekuvaukset ovat tiedostossa `AANIMAAILMAT.md`.

- **Studio** (`/#/studio`): 16 askeleen biittiruudukko.
- **Omat soundit** (`/#/sounds`): selaimeen tallennetut sävellykset, jotka
  voi avata takaisin Studioon. **Uusi soundi** aloittaa tyhjän työn.
- **Uusi idea** (`/#/idea`): tekstipohjainen moodboard, jossa on nimi,
  tunnelma ja inspiraatio sekä muistiinpanot.
- **Omat ideat** (`/#/ideas`): tallennettujen ideoiden kirjasto. Idean voi
  avata muokattavaksi ja tallentaa uudelleen.

Ideat tallennetaan **Tallenna idea** -painikkeella tämän selaimen
`localStorage`-muistiin. Tallennus ei synkronoidu laitteiden välillä;
selaintietojen tyhjentäminen poistaa ideat. Tallenna muistiinpano ennen
sivulta poistumista. Kuvien lisäämistä moodboardiin ei ole vielä toteutettu.
Yläpalkin Light/Dark-painikkeella voi vaihtaa teemaa. Valinta tallentuu
selaimeen; ensimmäisellä käynnillä käytetään laitteen väriteemaa.

## Teknologiat

Omat soundit -kirjastossa **Vie JSON-tiedosto** lataa soundin viimeksi
tallennetun version tiedostoksi. **Tuo JSON-tiedosto** lisää ha.kusta viedyn
tiedoston kirjastoon uutena soundina korvaamatta aiempia. Mukana kulkevat nimi,
askeleet, basson sävelet, tempo, voimakkuudet ja omat samplet. Tuonti tarkistaa
tiedostomuodon, version sekä arvojen ja äänidatan kelvollisuuden.
Tiedoston enimmäiskoko on 64 Mt. Uusi vientiversio on 4; myös vanhat version 1–3
projektit toimivat, ja niiden puuttuvat samplevalinnat tarkoittavat synteesiä.
JSON on muokattavan sävellyksen varmuuskopio, ei kuunneltava äänitiedosto.

Studion **Lataa WAV · 4 tahtia** muodostaa nykyisestä työstä kuunneltavan
WAV-tiedoston: sama yhden tahdin kuvio toistuu neljästi.
Studion lisäksi WAV-lataus löytyy Omat soundit -kirjastosta jokaisen soundin
kohdalta; kirjaston lataus käyttää kyseisen soundin tallennettua versiota.
Studiossa vienti käyttää
nykyistä tempoa, basson säveliä ja kaikkien raitojen voimakkuuksia, myös
tallentamattomia muutoksia. Raitojen hetkelliset kuuntelu-/taukovalinnat eivät
rajaa vientiä. Lopussa on 0,5 sekuntia äänten vaimenemiselle, joten tiedosto
ei ole saumaton looppi. Muoto on stereo, 44,1 kHz, 16-bittinen PCM.
Ääni tuotetaan paikallisesti OfflineAudioContextilla samoilla synteesiresepteillä
kuin toistossa. Kohinapohjaisten äänten yksityiskohdat vaihtelevat hieman.
Tyhjää tai kokonaan vaimennettua kuviota ei voi viedä. WAV ei korvaa
JSON-varmuuskopiota tai sävellyksen tallennusta kirjastoon.

Studiossa **Soundin nimi** ja **Tallenna soundi** tallentavat kaikkien viiden
raidan askeleet, basson sävelet, tempon, äänenvoimakkuudet ja omat samplet
selaimen `IndexedDB`-tietokantaan. Vanha localStorage-kirjasto on edelleen
luettavissa ja siirtyy IndexedDB:hen seuraavassa onnistuneessa tallennuksessa.
Kirjastosta avatun työn **Tallenna muutokset**
päivittää saman tallennuksen. Tallenna aina ennen uudelleenlatausta:
vain tallennetut versiot säilyvät, ja ne avataan Omat soundit -kirjastosta.
Tallennukset eivät synkronoidu laitteiden välillä ja poistuvat selaintietojen
tyhjennyksessä. Kyseessä ovat sävellyksen tiedot, eivät WAV-äänitiedostot.
Tallennuksen epäonnistuminen ilmoitetaan, ja työ pysyy auki Studiossa.

- Nyt: React, TypeScript ja Vite sekä tavallinen CSS yhteisine tyylimuuttujineen.
- Myöhemmin: NestJS + TypeScript -backend ja PostgreSQL-tietokanta.
- Musiikin toisto ja reaaliaikainen äänenkäsittely tapahtuvat selaimessa.
- Äänitiedostojen tallennusratkaisu päätetään myöhemmin.

## Kansiorakenne

```text
ha.kumusic/
├── frontend/
│   ├── src/
│   │   ├── App.tsx          # Sivut, teema ja ruudukon tila
│   │   ├── Sequencer.tsx    # Biittiruudukko ja toiston säätimet
│   │   ├── audio.ts         # Äänisynteesi ja äänikellon ajastus
│   │   ├── Ideas.tsx        # Ideoiden muistiinpanot ja kirjasto
│   │   ├── main.tsx         # Reactin käynnistys
│   │   ├── styles.css       # Yhteiset tyylimuuttujat ja pohjatyyli
│   │   └── vite-env.d.ts    # Viten tyyppimääritykset
│   ├── index.html          # Selaimen HTML-aloitussivu
│   ├── tests/audio.test.mjs # Äänen ajastuksen ja pysäytyksen testit
│   ├── package.json        # Riippuvuudet ja komennot
│   ├── package-lock.json   # Asennettujen riippuvuuksien tarkat versiot
│   ├── tsconfig.json       # TypeScript-asetukset
│   └── vite.config.ts      # Viten React-asetukset
├── backend/
│   └── README.md           # Tulevan backendin suunnitelma
├── .gitignore
└── README.md
```

## Käynnistys

Tarvitset Node.js:n ja npm:n. Projekti käyttää Vite 6:ta, joka toimii myös
nykyisellä Node.js 20.11 -ympäristöllä.

Aja projektin juuresta:

```powershell
cd frontend
npm install
npm run dev
```

Avaa terminaalin näyttämä paikallinen osoite (tavallisesti
http://localhost:5173). Pysäytä kehityspalvelin painamalla Ctrl+C.
Backendia ei tarvitse käynnistää.

## Buildin tarkistus

Aja `frontend`-kansiossa:

```powershell
npm run build
```

Komento tarkistaa TypeScriptin ja muodostaa tuotantoversion `frontend/dist`-kansioon.
Voit katsoa tuotantoversiota paikallisesti komennolla `npm run preview`.
Kun `package-lock.json` on käytettävissä, `npm ci` asentaa täsmälleen sen mukaiset
riippuvuudet esimerkiksi uudessa ympäristössä.

`npm test` tarkistaa äänimoottorin ajastuksen, tempon muutoksen,
pysäytyksen, viivästyneen käynnistyksen peruutuksen ja basson sävelkorkeudet.
Testit käyttävät
Web Audio -testikaksoista, eivät toista tai arvioi äänen kuulokuvaa.

## Seuraavat pienet kehitysvaiheet

Jokainen vaihe toteutetaan ja kokeillaan erikseen:

1. WAV-viennin pituuden valinta ja saumaton looppi.
2. Soundien hienosäätö.
3. Haluttaessa lisenssiltään soveltuvan äänipaketin valinta ja lisenssin dokumentointi.

Myöhemmin suunnitellaan melodioiden säveltäminen, USB MIDI -koskettimisto,
mikrofoniäänitys, kappaleen järjestäminen raidoille ja vienti äänitiedostoksi.
Tekoäly voi myöhemmin suositella äänipaketteja; käyttäjä säveltää itse.
Kirjautumista, tietokantaa, MIDIä, äänitystä tai tekoälyä ei ole
toteutettu tässä vaiheessa.
