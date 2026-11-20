# Chat met een student (Unibuddy)

Kleine webapp die op de opleidingspagina's van kdg.be de chat-studenten van die opleiding toont als tekstlinks. Vervangt de embed van Unibuddy. Zelfde opzet als [late-start-webapp](https://github.com/KdG-marcom/late-start-webapp).

## Opzet

Airtable (base Unibuddy) → GitHub Action (elk uur, token als secret `AIRTABLE_TOKEN`) → `data.json` op GitHub Pages → `widget.js` → kdg.be.

Embed-code op kdg.be (één keer in het herbruikbare blok plakken, in een HTML-paragraaf):

```html
<div id="kdg-unibuddy-root" data-titel="1"></div>
<script src="https://kdg-marcom.github.io/unibuddy-webapp/widget.js" defer></script>
```

De widget herkent de opleiding aan het adres van de pagina. Dezelfde code werkt dus op elke pagina.

Met `data-titel="1"` toont de widget ook het icoon en de titel. De aparte tekstparagraaf met icoon en titel moet dan weg uit het blok, anders staat de titel er twee keer en komt er extra witruimte tussen titel en tekst. Zonder `data-titel` toont de widget alleen de tekst en de links.

## Wat pas je waar aan

| Wat | Waar |
|---|---|
| Welke student bij welke opleiding | Airtable, tabel Opleidingen, veld Unibuddies |
| Voornaam | Airtable, tabel Unibuddies, veld Voornaam |
| Chatlink | Airtable, tabel Momenteel in Unibuddy, veld Profile link |
| Adres van de opleidingspagina | Airtable, tabel Opleidingen, veld Opleidingsaanbod website |
| Teksten (NL en EN), link naar alle chat-studenten, CSS-klassen van de site | `inhoud.json` |
| Logica | `widget.js` en `build-data.js` |

## Regels

- Een student verschijnt als hij of zij in tabel Opleidingen bij Unibuddies staat **en** met hetzelfde e-mailadres in "Momenteel in Unibuddy" staat met een Profile link. Wie geen link heeft, wordt niet getoond; de Action somt die namen op in haar log.
- De volgorde van de namen is de volgorde in het veld Unibuddies.
- Geen studenten voor een pagina, of laden mislukt: een algemene zin met de link naar alle chat-studenten.
- Pagina's die met `/en/` beginnen krijgen de Engelse teksten.
- Alleen voornaam en chatlink staan in `data.json`. Achternaam en e-mailadres blijven in Airtable.

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
