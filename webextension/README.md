# Avtonet Bot Chrome Extension

Ta mapa vsebuje prepis aplikacije v Chrome WebExtension (Manifest V3), brez Puppeteer/Steel.

## Kaj je preneseno iz desktop aplikacije

- shranjevanje uporabnika (`email`, `password`) v `chrome.storage.local`
- osveževanje podatkov o naročnini, `brokerId` in `hdImages` preko `avtonet-server.onrender.com`
- nalaganje aktivnih oglasov po tipih (`car`, `dostavna`, `platisca`)
- izbor oglasov in pavza med posameznimi obnovami
- sekvenčno obnavljanje oglasov z direktnim upravljanjem zavihkov in DOM-a

## Datoteke

- `manifest.json` – dovoljenja, popup, background worker in content script.
- `background.js` – poslovna logika (storage, fetch oglasov, orchestration obnavljanja).
- `content-script.js` – neposredno upravljanje obrazcev/gumbov na `avto.net`.
- `popup.html/css/js` – UI za konfiguracijo, seznam oglasov in status.

## Namestitev v Chrome

1. Odpri `chrome://extensions`
2. Vključi **Developer mode**
3. Klikni **Load unpacked**
4. Izberi mapo `webextension`

## Opombe

- Ker je flow odvisen od konkretnega HTML/CSS na `avto.net`, se lahko selektorji spremenijo. V tem primeru je potrebno posodobiti `content-script.js` in parser v `background.js`.
- Obnovitev uporablja navadno avtomatizacijo klikov in inputov, zato je priporočljivo testiranje na manjšem setu oglasov.
