/**
 * build-data.js — genereert data.json uit de Airtable-base "Unibuddy".
 * Wordt elk uur uitgevoerd door de GitHub Action (.github/workflows/update-data.yml).
 *
 * Vereist env-variabele AIRTABLE_TOKEN (Personal Access Token, scope data.records:read, alleen deze base).
 * Optioneel: AIRTABLE_BASE (default = de base hieronder).
 *
 * Node 18+ (globale fetch). Geen externe dependencies.
 * Tabellen en velden worden op ID aangesproken: een veld hernoemen in Airtable breekt dit script niet.
 *
 * Privacy: alleen voornaam en chatlink gaan naar data.json. Achternaam en e-mailadres blijven in Airtable;
 * het e-mailadres dient alleen om de twee tabellen aan elkaar te koppelen.
 */
const fs = require('fs');

const BASE = process.env.AIRTABLE_BASE || 'appxPbPpxs5paOebJ';

// Tabel "Opleidingen": wie hier bij "Unibuddies" staat, komt op de pagina's van die opleiding.
const OPL = {
  table: 'tblz6NgeU6q1VwL18',
  title: 'fldhfPlHZZX1mS0xl',        // title
  buddies: 'fldVOZ1923uoRIFNw',      // Unibuddies (koppeling)
  url: 'fldMoKfdp0Anm8kqF'           // webaddress (from Opleidingsaanbod website)
};
// Tabel "Unibuddies"
const BUDDY = {
  table: 'tblcGFxy12VdEooXu',
  voornaam: 'fld7OnKGJLgvACW1s',     // Voornaam
  mail: 'fldfEqGu307lRRv41'          // E-mail (alleen om te koppelen)
};
// Tabel "Momenteel in Unibuddy" (export uit Unibuddy)
const LIVE = {
  table: 'tbluz1zJDv0w6mHd6',
  mail: 'fldFg6MV9dWrBsTfZ',         // Email (alleen om te koppelen)
  link: 'fldIg6mKpyepLnUju'          // Profile link = de chatlink
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
function bouw({ opl, buddies, live }) {
  const link = {};
  live.forEach(r => {
    const m = mailSleutel(r.fields[LIVE.mail]), l = String(r.fields[LIVE.link] || '').trim();
    if (m && /^https:\/\//.test(l)) link[m] = l;
  });
  const buddy = {};
  buddies.forEach(r => {
    buddy[r.id] = { naam: String(r.fields[BUDDY.voornaam] || '').trim(), url: link[mailSleutel(r.fields[BUDDY.mail])] || '' };
  });

  const paginas = {}, zonderLink = [], zonderPagina = [];
  opl.forEach(r => {
    const f = r.fields, titel = String(f[OPL.title] || '').trim();
    const gekoppeld = arr(f[OPL.buddies]).map(v => buddy[idVan(v)]).filter(b => b && b.naam);
    if (!gekoppeld.length) return;
    gekoppeld.filter(b => !b.url).forEach(b => zonderLink.push(`${b.naam} (${titel})`));
    const studenten = gekoppeld.filter(b => b.url).map(b => ({ naam: b.naam, url: b.url }));
    const paden = [...new Set(arr(f[OPL.url]).map(pad).filter(Boolean))];
    if (!paden.length) { zonderPagina.push(titel); return; }
    if (!studenten.length) return;
    paden.forEach(p => {
      const bestaand = paginas[p] || { opleiding: titel, studenten: [] };
      studenten.forEach(s => { if (!bestaand.studenten.some(x => x.url === s.url)) bestaand.studenten.push(s); });
      paginas[p] = bestaand;
    });
  });
  const gesorteerd = {};
  Object.keys(paginas).sort().forEach(p => gesorteerd[p] = paginas[p]);
  return { data: { updated: new Date().toISOString(), paginas: gesorteerd }, zonderLink, zonderPagina };
}

async function fetchAll(table, velden) {
  const TOKEN = process.env.AIRTABLE_TOKEN;
  let records = [], offset;
  do {
    const url = new URL(`https://api.airtable.com/v0/${BASE}/${table}`);
    url.searchParams.set('pageSize', '100');
    url.searchParams.set('returnFieldsByFieldId', 'true');
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
  const velden = o => Object.keys(o).filter(k => k !== 'table').map(k => o[k]);
  const [opl, buddies, live] = await Promise.all([
    fetchAll(OPL.table, velden(OPL)), fetchAll(BUDDY.table, velden(BUDDY)), fetchAll(LIVE.table, velden(LIVE))
  ]);
  const { data, zonderLink, zonderPagina } = bouw({ opl, buddies, live });
  const aantalPaginas = Object.keys(data.paginas).length;
  // Veiligheid: een lege uitkomst wijst op een fout; dan de vorige data.json laten staan.
  if (!aantalPaginas) throw new Error('Geen enkele pagina met studenten gevonden; data.json niet overschreven.');
  fs.writeFileSync('data.json', JSON.stringify(data, null, 1));
  const aantalStudenten = new Set(Object.values(data.paginas).flatMap(p => p.studenten.map(s => s.url))).size;
  console.log(`data.json geschreven: ${aantalPaginas} pagina's, ${aantalStudenten} studenten.`);
  if (zonderLink.length) console.log(`Niet getoond, geen Profile link gevonden in "Momenteel in Unibuddy" (${zonderLink.length}): ` + zonderLink.join(', '));
  if (zonderPagina.length) console.log('Opleidingen met studenten maar zonder webadres: ' + zonderPagina.join(', '));
}

module.exports = { bouw, pad, leesInhoud };
if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });
