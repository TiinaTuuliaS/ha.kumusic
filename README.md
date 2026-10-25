# ha.ku

Selainpohjainen Y2K-henkinen musiikkistudio vaalealla ja tummalla teemalla. Käyttäjä säveltää itse
esimerkiksi technoa, trip hopia, trancea ja eurodancea.

Toteutettuna on frontendin runko, aloitusnäkymä ja viiden raidan
16 askeleen biittiruudukko omalla sävellyssivullaan. Etusivun **Avaa studio**
-linkki avaa osoitteen `/#/studio`, ja sävellyssivulta pääsee takaisin etusivulle.
Selaimen takaisin- ja eteenpäin-painikkeet toimivat myös. Kevyt hash-navigointi
ei tarvitse reitityskirjastoa tai palvelimen reititysasetuksia.
Askeleita voi kytkeä päälle ja pois klikkaamalla
tai näppäimistöllä (Tab siirtää kohdistusta, välilyönti tai Enter vaihtaa valinnan).
Valitut askeleet näkyvät limenvihreinä. Pienellä näytöllä ruudukkoa voi vierittää
vaakasuunnassa. Valinnat ovat Reactin tilassa: ne säilyvät sivujen välillä
liikuttaessa ja nollautuvat sivun latauksessa.
Ruudukossa on omat synteettiset kick-, virveli-, taputus-, hi-hat- ja bassoäänet.
Äänet tuotetaan selaimen Web Audio API:lla ilman ulkoisia sampleja tai kirjastoja.
Bassossa on aluksi yksi sävel (C2); sävelkorkeuksien valinta tehdään myöhemmin.

Valitse askeleita ja paina **Toista**. Raidan nimestä voi esikuunnella äänen.
**Pysäytä** katkaisee toiston ja äänet. Tempo on 40–240 BPM; 16 askelta
muodostaa yhden 4/4-tahdin kuudestoistaosanuotteina. Toistuva askel näkyy
violetilla reunuksella. Toisto pysähtyy, kun poistut sävellyssivulta.
Ääni käynnistyy vasta käyttäjän painalluksesta.

## Omat sivut

- **Studio** (`/#/studio`): 16 askeleen biittiruudukko.
- **Omat soundit** (`/#/sounds`): kirjaston aloitusnäkymä tuleville omille
  sävellyksille. Äänitiedostoja tai kappaleita ei vielä tallenneta.
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
pysäytyksen ja viivästyneen käynnistyksen peruutuksen. Testit käyttävät
Web Audio -testikaksoista, eivät toista tai arvioi äänen kuulokuvaa.

## Seuraavat pienet kehitysvaiheet

Jokainen vaihe toteutetaan ja kokeillaan erikseen:

1. Basson sävelten valinta ja melodian rakentaminen.
2. Raitakohtaiset äänenvoimakkuudet ja soundien hienosäätö.
3. Rytmikuvioiden tallennus Omat soundit -kirjastoon.
4. Haluttaessa lisenssiltään soveltuvan äänipaketin valinta ja lisenssin dokumentointi.

Myöhemmin suunnitellaan melodioiden säveltäminen, USB MIDI -koskettimisto,
mikrofoniäänitys, kappaleen järjestäminen raidoille ja vienti äänitiedostoksi.
Tekoäly voi myöhemmin suositella äänipaketteja; käyttäjä säveltää itse.
Kirjautumista, tietokantaa, MIDIä, äänitystä tai tekoälyä ei ole
toteutettu tässä vaiheessa.
