/**
 * KdG – Chat met een student (vervangt de Unibuddy-embed op de opleidingspagina's)
 * Embed op kdg.be (in het herbruikbare blok; data-titel="1" laat de widget ook icoon en titel tonen):
 *   <div id="kdg-unibuddy-root" data-titel="1"></div>
 *   <script src="https://kdg-marcom.github.io/unibuddy-webapp/widget.js" defer></script>
 * De widget herkent de opleiding aan het adres van de pagina en toont de chat-studenten als tekstlinks.
 * De data komt uit data.json (zelfde map), elk uur ververst vanuit Airtable. Teksten en links: inhoud.json.
 * Geen eigen opmaak: alleen <p> en <a>, zodat de CSS van de website (ook de nieuwe) het blok opmaakt.
 */
(function () {
  "use strict";
  var script = document.currentScript;
  var root = document.getElementById("kdg-unibuddy-root");
  if (!root || root.dataset.kdgUnibuddy) return;
  root.dataset.kdgUnibuddy = "1";

  // Waar staan data.json en inhoud.json? Standaard naast dit script; anders via data-src / data-inhoud op de div.
  var DATA_URL = root.dataset.src || (script && script.src ? new URL("data.json", script.src).href : "data.json");
  var INHOUD_URL = root.dataset.inhoud || (script && script.src ? new URL("inhoud.json", script.src).href : "inhoud.json");

  // Ingebouwde standaardwaarden. De echte inhoud staat in inhoud.json en overschrijft ze.
  var STD = {"teksten": {"nl": {"titel": "Chat met een student", "intro": "Stel je vraag over de opleiding of het studentenleven aan een student {opleiding}.", "chat": "Chat met {namen}.", "of": "of", "alle": "Bekijk alle chat-studenten van KdG", "leeg": "Stel je vraag over studeren en het studentenleven aan KdG aan een van onze studenten.", "leegLink": "Bekijk alle chat-studenten"}, "en": {"titel": "Chat with a student", "intro": "Ask a student of {opleiding} your question about the programme or student life.", "chat": "Chat with {namen}.", "of": "or", "alle": "See all KdG chat students", "leeg": "Ask one of our students your question about studying and student life at KdG.", "leegLink": "See all chat students"}}, "links": {"alle": {"nl": "https://www.kdg.be/chat", "en": "https://www.kdg.be/chat"}}, "klassen": {"student": "", "alle": "chevron-after", "icoon": "iconmoon icon-question"}};

  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  var veiligeUrl = function (u) { return /^https:\/\//.test(String(u || "")) ? u : ""; };

  // Welke pagina? Standaard het adres van de pagina zelf; data-pagina op de div overschrijft dat (voor tests).
  var pagina = (root.dataset.pagina || location.pathname).replace(/\/+$/, "").toLowerCase() || "/";
  var taal = root.dataset.taal || (/^\/en(\/|$)/.test(pagina) ? "en" : "nl");

  function samenvoegen(inh) {
    var uit = JSON.parse(JSON.stringify(STD));
    if (!inh || typeof inh !== "object") return uit;
    ["nl", "en"].forEach(function (t) {
      var bron = inh.teksten && inh.teksten[t];
      if (bron) Object.keys(bron).forEach(function (k) { if (k.charAt(0) !== "_" && typeof bron[k] === "string") uit.teksten[t][k] = bron[k]; });
    });
    if (inh.links && inh.links.alle) ["nl", "en"].forEach(function (t) { if (veiligeUrl(inh.links.alle[t])) uit.links.alle[t] = inh.links.alle[t]; });
    if (inh.klassen) ["student", "alle", "icoon"].forEach(function (k) { if (typeof inh.klassen[k] === "string") uit.klassen[k] = inh.klassen[k]; });
    return uit;
  }

  // soort = "student" of "alle": dat gaat mee naar Analytics.
  function link(url, tekst, klasse, soort) {
    return '<a href="' + esc(url) + '" data-kdg-chat="' + soort + '"' + (klasse ? ' class="' + esc(klasse) + '"' : "") + ">" + esc(tekst) + "</a>";
  }

  // ---------- Analytics ----------
  // Elke klik op een link in het blok wordt een GA4-event "unibuddy_click" met:
  //   link_type = student | alle, opleiding, student (voornaam, leeg bij "alle"), link_url.
  // Via gtag als de site die heeft, anders via de dataLayer van Google Tag Manager. Zonder een van beide gebeurt er niets.
  var opleidingNaam = "";
  root.addEventListener("click", function (e) {
    var a = e.target && e.target.closest ? e.target.closest("a[data-kdg-chat]") : null;
    if (!a) return;
    var soort = a.getAttribute("data-kdg-chat");
    var params = { link_type: soort, opleiding: opleidingNaam, student: soort === "student" ? a.textContent : "", link_url: a.href };
    try {
      if (typeof window.gtag === "function") window.gtag("event", "unibuddy_click", params);
      else if (Array.isArray(window.dataLayer)) window.dataLayer.push(Object.assign({ event: "unibuddy_click" }, params));
    } catch (err) { /* meten mag de link nooit blokkeren */ }
  });

  function toon(data, inh) {
    var c = samenvoegen(inh), T = c.teksten[taal] || c.teksten.nl, alleUrl = c.links.alle[taal] || c.links.alle.nl;
    var p = data && data.paginas && data.paginas[pagina];
    var studenten = ((p && p.studenten) || []).filter(function (s) { return s && s.naam && veiligeUrl(s.url); });
    // Met data-titel="1" op de div toont de widget ook het icoon en de titel (dan staat het hele blok in één stuk).
    var kop = root.dataset.titel ? '<p' + (c.klassen.icoon ? ' class="' + esc(c.klassen.icoon) + '"' : "") + "></p><h5>" + esc(T.titel) + "</h5>" : "";
    if (!studenten.length) {
      root.innerHTML = kop + "<p>" + esc(T.leeg) + "</p><p>" + link(alleUrl, T.leegLink, c.klassen.alle, "alle") + "</p>";
      return;
    }
    opleidingNaam = p.opleiding || "";
    var links = studenten.map(function (s) { return link(s.url, s.naam, c.klassen.student, "student"); });
    var namen = links.length === 1 ? links[0] : links.slice(0, -1).join(", ") + " " + esc(T.of) + " " + links[links.length - 1];
    root.innerHTML = kop +
      "<p>" + esc(T.intro).split("{opleiding}").join(esc(p.opleiding)) + "</p>" +
      "<p>" + esc(T.chat).split("{namen}").join(namen) + "</p>" +
      "<p>" + link(alleUrl, T.alle, c.klassen.alle, "alle") + "</p>";
  }

  var haal = function (url) { return fetch(url, { cache: "no-cache" }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }); };
  // Lukt het laden niet? Dan het algemene blok met de link naar alle chat-studenten.
  Promise.all([haal(DATA_URL).catch(function () { return null; }), haal(INHOUD_URL).catch(function () { return null; })])
    .then(function (r) { toon(r[0], r[1]); })
    .catch(function () { toon(null, null); });
})();
