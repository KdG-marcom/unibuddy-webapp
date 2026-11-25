/**
 * build-data.js — genereert data.json uit de Airtable-base "Unibuddy" (view "Webapp: Actief + Profile link").
 * Wordt elk uur uitgevoerd door de GitHub Action (.github/workflows/update-data.yml).
 *
 * Vereist env-variabele AIRTABLE_TOKEN (Personal Access Token, scope data.records:read, alleen deze base).
 * Optioneel: AIRTABLE_BASE (default = de base hieronder).
 *
 * Node 18+ (globale fetch). Geen externe dependencies.
 * Tabellen en velden worden op ID aangesproken: een veld hernoemen in Airtable breekt dit script niet.
 *
 * Privacy: alleen voornaam en chatlink gaan naar data.json. Het script leest geen achternamen of e-mailadressen.
 */
const fs = require('fs');

const BASE = process.env.AIRTABLE_BASE || 'appxPbPpxs5paOebJ';

// Tabel "Unibuddies", view "Webapp: Actief + Profile link".
// Wie in die view staat, komt op de pagina's van zijn of haar opleiding, in de volgorde van de view.
// De filter (status Actief en Profile link ingevuld) beheer je in Airtable, niet hier.
const BUDDY = {
  table: 'tblcGFxy12VdEooXu',
  view: 'viw9uQAgfvdVCSOfT',         // Webapp: Actief + Profile link
  voornaam: 'fld7OnKGJLgvACW1s',     // Voornaam
  link: 'fldJb1wIHQwvvozgK',         // Profile link = de chatlink
  opleiding: 'fldeBWnOYpJkPn9Ot'     // Opleiding (koppeling met Opleidingspagina's website)
};
// Tabel "Opleidingspagina's website" (gesynct)
const PAGINA = {
  table: 'tbluPkETktRnO7TYE',
  title: 'fldf3clRKTj9g37Es',        // title
  url: 'fld2aPKngb5eGcBoB'           // webaddress
};

const arr = v => Array.isArray(v) ? v : (v == null ? [] : [v]);
const idVan = v => (v && typeof v === 'object') ? v.id : v;
const mailSleutel = s => String(s || '').trim().toLowerCase();

/** "https://www.kdg.be/marketing/" -> "/marketing". Dit is de sleutel waarmee de widget de pagina herkent. */
function pad(url) {
  try { return (new URL(String(url).trim()).pathname.replace(/\/+$/, '') || '/').toLowerCase(); }
  catch (e) { return ''; }
}

/** Zet de ruwe Airtable-records om naar de data voor de webapp. */
function bouw({ buddies, paginaRecords }) {
  const pagina = {};
  paginaRecords.forEach(r => { pagina[r.id] = { titel: String(r.fields[PAGINA.title] || '').trim(), pad: pad(r.fields[PAGINA.url]) }; });

  const paginas = {}, zonderOpleiding = [], zonderPagina = [];
  buddies.forEach(r => {
    const naam = String(r.fields[BUDDY.voornaam] || '').trim(), url = String(r.fields[BUDDY.link] || '').trim();
    if (!naam || !/^https:\/\//.test(url)) return;   // de view filtert hier al op; dit is een extra veiligheid
    const gekoppeld = arr(r.fields[BUDDY.opleiding]).map(v => pagina[idVan(v)]).filter(Boolean);
    if (!gekoppeld.length) { zonderOpleiding.push(naam); return; }
    gekoppeld.forEach(p => {
      if (!p.pad) { zonderPagina.push(`${naam} (${p.titel})`); return; }
      const bestaand = paginas[p.pad] || { opleiding: p.titel, studenten: [] };
      if (!bestaand.studenten.some(x => x.url === url)) bestaand.studenten.push({ naam, url });
      paginas[p.pad] = bestaand;
    });
  });
  const gesorteerd = {};
  Object.keys(paginas).sort().forEach(p => gesorteerd[p] = paginas[p]);
  return { data: { updated: new Date().toISOString(), paginas: gesorteerd }, zonderOpleiding, zonderPagina };
}

async function fetchAll(table, velden, view) {
  const TOKEN = process.env.AIRTABLE_TOKEN;
  let records = [], offset;
  do {
    const url = new URL(`https://api.airtable.com/v0/${BASE}/${table}`);
    url.searchParams.set('pageSize', '100');
    url.searchParams.set('returnFieldsByFieldId', 'true');
    if (view) url.searchParams.set('view', view);   // filter en volgorde van de view
    velden.forEach(v => url.searchParams.append('fields[]', v));
    if (offset) url.searchParams.set('offset', offset);
    const res = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}` } });
    if (!res.ok) throw new Error(`${table}: HTTP ${res.status} — ${await res.text()}`);
    const json = await res.json();
    records = records.concat(json.records);
    offset = json.offset;
  } while (offset);
  return records;
}

/** Leest inhoud.json (teksten en links). Een fout in de vorm laat de Action mislukken, zodat je het merkt. */
function leesInhoud() {
  if (!fs.existsSync('inhoud.json')) return {};
  try { return JSON.parse(fs.readFileSync('inhoud.json', 'utf8')); }
  catch (e) { throw new Error('inhoud.json bevat een fout in de vorm (komma, aanhalingsteken of haakje): ' + e.message); }
}

async function main() {
  leesInhoud();   // eerst: zo valt een fout in inhoud.json meteen op
  if (!process.env.AIRTABLE_TOKEN) { console.error('FOUT: AIRTABLE_TOKEN ontbreekt.'); process.exit(1); }
  const velden = o => Object.keys(o).filter(k => k !== 'table' && k !== 'view').map(k => o[k]);
  const [buddies, paginaRecords] = await Promise.all([
    fetchAll(BUDDY.table, velden(BUDDY), BUDDY.view), fetchAll(PAGINA.table, velden(PAGINA))
  ]);
  const { data, zonderOpleiding, zonderPagina } = bouw({ buddies, paginaRecords });
  const aantalPaginas = Object.keys(data.paginas).length;
  // Veiligheid: een lege uitkomst wijst op een fout; dan de vorige data.json laten staan.
  if (!aantalPaginas) throw new Error('Geen enkele pagina met studenten gevonden; data.json niet overschreven.');
  fs.writeFileSync('data.json', JSON.stringify(data, null, 1));
  const aantalStudenten = new Set(Object.values(data.paginas).flatMap(p => p.studenten.map(s => s.url))).size;
  console.log(`data.json geschreven: ${aantalPaginas} pagina's, ${aantalStudenten} studenten (${buddies.length} in de view).`);
  if (zonderOpleiding.length) console.log('In de view maar zonder opleiding, dus niet getoond: ' + zonderOpleiding.join(', '));
  if (zonderPagina.length) console.log('Opleiding zonder webadres, dus niet getoond: ' + zonderPagina.join(', '));
}

module.exports = { bouw, pad, leesInhoud };
if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });
