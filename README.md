# Chat met een student (Unibuddy)

Kleine webapp die op de opleidingspagina's van kdg.be de chat-studenten van die opleiding toont als tekstlinks. Vervangt de embed van Unibuddy. Zelfde opzet als [late-start-webapp](https://github.com/KdG-marcom/late-start-webapp).

## Opzet

Airtable (base Unibuddy) → GitHub Action (elk uur, token als secret `AIRTABLE_TOKEN`) → `data.json` op GitHub Pages → `widget.js` → kdg.be.

Embed-code op kdg.be (één keer in het herbruikbare blok plakken, in een HTML-paragraaf vlak onder de tekstparagraaf met het icoon en de titel "Chat met een student"):

```html
<div id="kdg-unibuddy-root"></div>
<script src="https://kdg-marcom.github.io/unibuddy-webapp/widget.js" defer></script>
```

De widget herkent de opleiding aan het adres van de pagina. Dezelfde code werkt dus op elke pagina.

**Titel.** De titel en het icoon blijven in de tekstparagraaf van het CMS staan (daar zit ook het anker `#chat`). De widget schuift zichzelf onder die titel, zodat er geen extra witruimte tussen titel en tekst komt. Staat er geen titel vlak voor de widget, dan blijft ze staan waar ze staat. Met `data-titel="1"` op de div toont ze in dat geval zelf een icoon en een titel; staat er wel een titel, dan doet dat attribuut niets.

## Wat pas je waar aan

| Wat | Waar |
|---|---|
| Wie getoond wordt | Airtable, tabel Unibuddies, view "Webapp: Actief + Profile link" |
| Voornaam, chatlink (Profile link), opleiding | Airtable, tabel Unibuddies |
| Adres van de opleidingspagina | Airtable, tabel Opleidingspagina's website (gesynct), veld webaddress |
| Teksten (NL en EN), link naar alle chat-studenten, CSS-klassen van de site | `inhoud.json` |
| Logica | `widget.js` en `build-data.js` |

## Regels

- Een student verschijnt als hij of zij in de view "Webapp: Actief + Profile link" staat (status Actief en Profile link ingevuld) en aan een opleiding gekoppeld is. De filter van de view beheer je in Airtable.
- De volgorde van de namen is de volgorde van de view.
- Geen studenten voor een pagina, of laden mislukt: een algemene zin met de link naar alle chat-studenten.
- Pagina's die met `/en/` beginnen krijgen de Engelse teksten.
- Alleen voornaam en chatlink staan in `data.json`. Het script leest geen achternamen of e-mailadressen.
- Hernoem de view gerust; verwijder ze niet (het script gebruikt haar ID).

## Geen eigen opmaak

De widget schrijft alleen `<p>` en `<a>`. De CSS van de website maakt het blok op, ook na de overgang naar de nieuwe site. Wil je toch een klasse van de site op de links (bijvoorbeeld knoppen), vul die dan in bij `klassen` in `inhoud.json`.

## Analytics

Elke klik op een link in het blok stuurt het GA4-event `unibuddy_click` met de parameters `link_type` (`student` of `alle`), `opleiding`, `student` (voornaam) en `link_url`. De widget gebruikt `gtag` als de site die heeft, anders de dataLayer van Google Tag Manager. Om de parameters in rapporten te zien, registreer je ze in GA4 als aangepaste dimensies.

## Eenmalig instellen

1. Repository `unibuddy-webapp` aanmaken onder KdG-marcom en deze bestanden erin zetten.
2. Airtable-token maken: scope `data.records:read`, alleen base Unibuddy. Bewaren als secret `AIRTABLE_TOKEN` (Settings › Secrets and variables › Actions).
3. GitHub Pages aanzetten op branch `main`.
4. De Action "Update data.json" één keer handmatig starten en de log nakijken.
5. Testen op `https://kdg-marcom.github.io/unibuddy-webapp/?pagina=/marketing`.

## Bestanden

`widget.js` (webapp), `inhoud.json` (teksten en links), `build-data.js` (Airtable → data.json), `data.json`, `index.html` (testpagina), `.github/workflows/update-data.yml`, `README.md`.
