/**
 * KdG – Chat met een student (vervangt de Unibuddy-embed op de opleidingspagina's)
 * Embed op kdg.be (in het herbruikbare blok, in een HTML-paragraaf onder de tekstparagraaf met icoon en titel):
 *   <div id="kdg-unibuddy-root"></div>
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
  var STD = {"teksten": {"nl": {"titel": "Chat met een student", "intro": "Stel je vraag over de opleiding of het studentenleven aan een student {opleiding}.", "chat": "Chat met {namen}.", "of": "of", "alle": "Bekijk alle chat-studenten van KdG", "leeg": "Stel je vraag over studeren en het studentenleven aan KdG aan een van onze studenten.", "leegLink": "Bekijk alle chat-studenten"}, "en": {"titel": "Chat with a student", "intro": "Ask a student of {opleiding} your question about the programme or student life.", "chat": "Chat with {namen}.", "of": "or", "alle": "See all KdG chat students", "leeg": "Ask one of our students your question about studying and student life at KdG.", "leegLink": "See all chat students"}}, "links": {"alle": {"nl": "https://www.kdg.be/chat", "en": "https://www.kdg.be/chat"}}, "klassen": {"student": "", "alle": "chevron-after", "alleIcoon": "icon icon-chevron", "icoon": "iconmoon icon-question"}};

  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  var veiligeUrl = function (u) { return /^https:\/\//.test(String(u || "")) ? u : ""; };

  // Welke pagina? Standaard het adres van de pagina zelf; data-pagina op de div overschrijft dat (voor tests).
  var pagina = (root.dataset.pagina || location.pathname).replace(/\/+$/, "").toLowerCase() || "/";
  var taal = root.dataset.taal || (/^\/en(\/|$)/.test(pagina) ? "en" : "nl");

  // Staat de titel "Chat met een student" in een apart blok vlak voor de widget (zoals in het CMS van kdg.be)?
  // Dan schuift de widget zichzelf onder die titel, zodat er geen extra witruimte tussen titel en tekst komt.
  // Vindt ze zo'n titel niet, dan blijft ze staan waar ze staat.
  function onderTitel() {
    var el = root;
    for (var i = 0; i < 6 && el && el.parentElement; i++) {
      var prev = el.previousElementSibling;
      if (prev) {
        var hs = prev.matches("h2,h3,h4,h5,h6") ? [prev] : prev.querySelectorAll("h2,h3,h4,h5,h6");
        var h = hs[hs.length - 1];
        if (h && !h.nextElementSibling && prev.textContent.trim() === h.textContent.trim()) { h.parentNode.insertBefore(root, h.nextSibling); return true; }
        return false;
      }
      el = el.parentElement;
    }
    return false;
  }
  var heeftTitel = false;
  try { heeftTitel = onderTitel(); } catch (err) { /* lukt het niet, dan blijft de widget gewoon staan */ }

  function samenvoegen(inh) {
    var uit = JSON.parse(JSON.stringify(STD));
    if (!inh || typeof inh !== "object") return uit;
    ["nl", "en"].forEach(function (t) {
      var bron = inh.teksten && inh.teksten[t];
      if (bron) Object.keys(bron).forEach(function (k) { if (k.charAt(0) !== "_" && typeof bron[k] === "string") uit.teksten[t][k] = bron[k]; });
    });
    if (inh.links && inh.links.alle) ["nl", "en"].forEach(function (t) { if (veiligeUrl(inh.links.alle[t])) uit.links.alle[t] = inh.links.alle[t]; });
    if (inh.klassen) ["student", "alle", "alleIcoon", "icoon"].forEach(function (k) { if (typeof inh.klassen[k] === "string") uit.klassen[k] = inh.klassen[k]; });
    return uit;
  }

  // soort = "student" of "alle": dat gaat mee naar Analytics.
  // icoon = klasse van een leeg <i>-element achter de tekst (het pijltje van de site bij chevron-after).
  function link(url, tekst, klasse, soort, icoon) {
    return '<a href="' + esc(url) + '" data-kdg-chat="' + soort + '"' + (klasse ? ' class="' + esc(klasse) + '"' : "") + ">" + esc(tekst) +
      (icoon ? '<i class="' + esc(icoon) + '"></i>' : "") + "</a>";
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
    // Eigen studenten van de pagina; anders die van de pagina in "toonStudentenVan" (bv. afstudeerrichting -> opleiding).
    var paginas = (data && data.paginas) || {};
    var bron = inh && inh.toonStudentenVan && typeof inh.toonStudentenVan[pagina] === "string" ? inh.toonStudentenVan[pagina].replace(/\/+$/, "").toLowerCase() : "";
    var p = paginas[pagina] || (bron ? paginas[bron] : null);
    var studenten = ((p && p.studenten) || []).filter(function (s) { return s && s.naam && veiligeUrl(s.url); });
    // Met data-titel="1" op de div toont de widget zelf het icoon en de titel, maar alleen als er nog geen titel boven staat.
    var kop = root.dataset.titel && !heeftTitel ? '<p' + (c.klassen.icoon ? ' class="' + esc(c.klassen.icoon) + '"' : "") + "></p><h5>" + esc(T.titel) + "</h5>" : "";
    if (!studenten.length) {
      root.innerHTML = kop + "<p>" + esc(T.leeg) + "</p><p>" + link(alleUrl, T.leegLink, c.klassen.alle, "alle", c.klassen.alleIcoon) + "</p>";
      return;
    }
    opleidingNaam = p.opleiding || "";
    var links = studenten.map(function (s) { return link(s.url, s.naam, c.klassen.student, "student"); });
    var namen = links.length === 1 ? links[0] : links.slice(0, -1).join(", ") + " " + esc(T.of) + " " + links[links.length - 1];
    root.innerHTML = kop +
      "<p>" + esc(T.intro).split("{opleiding}").join(esc(p.opleiding)) + "</p>" +
      "<p>" + esc(T.chat).split("{namen}").join(namen) + "</p>" +
      "<p>" + link(alleUrl, T.alle, c.klassen.alle, "alle", c.klassen.alleIcoon) + "</p>";
  }

  var haal = function (url) { return fetch(url, { cache: "no-cache" }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }); };
  // Lukt het laden niet? Dan het algemene blok met de link naar alle chat-studenten.
  Promise.all([haal(DATA_URL).catch(function () { return null; }), haal(INHOUD_URL).catch(function () { return null; })])
    .then(function (r) { toon(r[0], r[1]); })
    .catch(function () { toon(null, null); });
})();
