// Copyright 2026 FNG. Use, modification and redistribution are permitted under the conditions in LICENSE:
// credit the source, and visibly link to the site or repository if you use its outputs in a user-facing application.
// Prepared builds: the side/top navigation and the per-build recipe pages. Reads premade_sc.json / premade_hc.json
// (see export_premade.py); needs no wasm, so it is usable before the search engine has finished loading.
import { statName, statAbbr, CLASS_NAMES, SLOT_NAMES, materials } from "./stats.js?v=0f03afb94a";
import { stepsHtml, matsHtml, tooltipRows, savedList, requestHash } from "./recipe.js?v=0f03afb94a";

const $ = (id) => document.getElementById(id);
const V = new URL(import.meta.url).searchParams.get("v");
const qs = V && V !== "0" ? `?v=${V}` : "";

const cache = {};                 // "sc" | "hc" -> Promise<{season, builds}>
let route = "search";             // "search" (the start page) | "staples" | build id
let current = null;               // loaded data for the active mode

const modeKey = () => ($("hc").value === "1" ? "hc" : "sc");
const className = (c) => CLASS_NAMES[c] || c;
// the class index the generator writes in `by` / `who` / `mystic_by` (the order of data.json's `classes`)
const CLASS_ORDER = ["DemonHunter", "Barbarian", "Wizard", "WitchDoctor", "Monk", "Crusader", "Necromancer"];
const heroName = (c) => className(CLASS_ORDER[c]);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function load(key) {
  if (!cache[key]) {
    cache[key] = fetch(`./premade_${key}.json${qs}`).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .catch((e) => { delete cache[key]; throw e; });
  }
  return cache[key];
}

// ---------- recipe -> the shapes recipe.js renders ----------

const marker = (m) => ({ name: m[0], quality: m[1], lines: m[2] ? [{ stem: m[2], value: m[3] }] : [] });

// `who`: the hero class doing each letter of `path` (only present when the recipe hands the item to another class); a new group starts
// whenever the operation or the hero changes, as in a custom search result.
function hitOf(row, path, lin, who) {
  const route = [];
  const route_class = [];
  [...path].forEach((ch, i) => {
    const last = route[route.length - 1];
    const c = who ? who[i] : undefined;
    if (last && last[0] === ch && route_class[route_class.length - 1] === c) last[1] += 1; else { route.push([ch, 1]); route_class.push(c); }
  });
  // checkpoint k = the item after the first k groups of steps (0 = the Hope of Cain item)
  const checkpoints = [marker(lin[0])];
  let at = 0;
  for (const [, n] of route) { at += n; checkpoints.push(marker(lin[Math.min(at, lin.length - 1)])); }
  return { hope: row.n, slot: row.rs, route, route_class: who ? route_class : [], craft_class: who ? row.craft : undefined, checkpoints, root_name: lin[0][0], name: lin[lin.length - 1][0] };
}

// Cost in Hope of Cain units with the relative prices the search minimises (Convert Set Item 0.75, Hope of Cain 1, Reforge 5, Improve Legendary 25),
// and the plain number of actions (crafts + operations). Cost is what you pay in materials; steps is how long it takes.
const PRICE = { R: 5, C: 0.75, P: 25 };
// hand-overs between heroes (the build's class -> the crafter, crafter -> first step, step -> step, last step -> Mystic) cost 1 each, the generator's default swap price
const handOvers = (row, who) => {
  if (!who) return 0;
  const seq = [row.by, row.craft, ...who, ...(row.mystic ? [row.mystic_by] : [])];
  return seq.reduce((a, c, i) => a + (i && c !== seq[i - 1] ? 1 : 0), 0);
};
const costOf = (n, path, row, who) => Number((n + [...path].reduce((a, c) => a + (PRICE[c] || 0), 0) + (row ? handOvers(row, who) : 0)).toFixed(2));
const stepsOf = (n, path) => n + path.length;
const COST_TIP = "Relative cost: Hope of Cain 1, Reforge 5, Convert Set Item 0.75, Improve Legendary 25. Steps: crafts plus operations.";
// The numbers are for the site's owner (deciding what to ship), not for players, whose materials row says what a recipe costs:
// they only show when the address carries ?costs.
const SHOW_COSTS = new URLSearchParams(location.search).has("costs");
const costHtml = (n, path, row, who) => (SHOW_COSTS ? `<span class="cost" title="${COST_TIP}">cost ${costOf(n, path, row, who)} &middot; ${stepsOf(n, path)} steps</span>` : "");

const linesOf = (tt) => tt.map(([stem, value, max]) => ({ stem, value, max }));

function fullTooltip(tt, need) {
  if (!tt) return "";
  const want = new Set(need);
  const rows = tooltipRows(linesOf(tt)).map((r) => {
    const w = want.has(r.stem);
    return `<span class="${w ? "want" : ""}">${r.label}</span><span class="v ${w ? "want" : ""}">${r.value}</span>`;
  }).join("");
  return `<details class="full" open><summary>Full tooltip</summary><div class="lines">${rows}</div></details>`;
}

function recipeBody(row, path, lin, tt, note = "", tooltip = true, who = row.who) {
  const h = hitOf(row, path, lin, who);
  const mats = matsHtml(materials(h));
  // a recipe that hands the item over names the hero at every step
  const heroes = who ? { cls: row.by, name: heroName } : undefined;
  return (row.intro ? `<p class="mk">${row.intro}</p>` : "") + stepsHtml(h, [], new Set(row.need), heroes) + note + `<div class="mats">${mats}</div>` + (tooltip ? fullTooltip(tt, row.need) : "");
}

const QUALITY = { primal: ["Primal", "t-primal"], crafted: ["Crafted primal", "t-primal"], ancient: ["Ancient", "t-ancient"], normal: ["Legendary", "t-normal"] };

function rowHtml(row, tooltip = true) {
  const name = !row.item ? "" : `<span class="nm">${esc(row.item)}${row.cubed ? ' <span class="cb">(cubed)</span>' : ""}${row.any ? ' <span class="cb">(any item)</span>' : ""}</span>`;
  if (!row.found) {
    return `<div class="rec"><div class="nm">${esc(row.item)}</div><div class="small">No natural primal turned up within the search limits. Try refining the search in <a href="./" data-route="search">Custom search</a>.</div></div>`;
  }
  const [qt, qc] = QUALITY[row.q] || QUALITY.normal;
  const stats = row.need.map((s) => `<span class="want">${esc(statAbbr(s))}</span>`).join(", ");
  // the Mystic hero is named when it is not the one holding the item after the last cube step
  const holder = row.who ? (row.who.length ? row.who[row.who.length - 1] : row.craft) : undefined;
  const mysticBy = row.mystic && row.who && row.mystic_by !== holder ? ` as ${esc(heroName(row.mystic_by))}` : "";
  const mystic = row.mystic ? ` <span class="small">+ Mystic${mysticBy}: ${esc(statName(row.mystic))}</span>`
    : row.nomystic ? ` <span class="small">(no room for ${esc(statName(row.nomystic))} at the Mystic)</span>` : "";
  const craftedNote = row.q === "crafted" ? `<div class="small">Improve Legendary primals: only one can be worn per character.</div>` : "";
  const cheap = (row.cheap || []).map((c) => {
    const [t] = QUALITY[c.q] || QUALITY.normal;
    return `<details class="full cheap"><summary>Cheaper: ${t.toLowerCase()}${SHOW_COSTS ? `, cost ${costOf(row.n, c.path, row, c.who)} (${stepsOf(row.n, c.path)} steps)` : ""}</summary>${recipeBody(row, c.path, c.lin, c.tt, "", tooltip, c.who)}</details>`;
  }).join("");
  return `<details class="rec"><summary${row.item ? "" : ' class="noname"'}>${name}
    <span class="meta"><span class="tag ${qc}">${qt}</span><span class="aff">${stats}</span>${mystic}${costHtml(row.n, row.path, row, row.who)}</span></summary>
    <div class="body">${recipeBody(row, row.path, row.lin, row.tt, craftedNote, tooltip)}${cheap}</div></details>`;
}

function buildHtml(b, data) {
  const slots = [];
  for (const r of b.rows) {
    const last = slots[slots.length - 1];
    if (last && last.name === r.slot) last.rows.push(r); else slots.push({ name: r.slot, rows: [r] });
  }
  const sc = data.hardcore ? "Hardcore" : "Softcore";
  const head = `<div class="bhead"><h2>${esc(b.title)}</h2><span class="small">${esc(className(b.class))} &middot; Season ${data.season} &middot; ${sc}</span></div>`;
  const note = +$("season").value !== data.season
    ? `<div class="warn modeflag">These recipes are for season ${data.season}. Other seasons roll different items, so they will not match.</div>` : "";
  const cards = slots.map((s) => `<section class="card slot"><h3>${esc(s.name)}</h3>${s.rows.map((r) => rowHtml(r)).join("")}</section>`).join("");
  return head + note + cards;
}

// ---------- staples: class-agnostic items, each made on whichever class is cheapest ----------

function staplesHtml(data) {
  const sc = data.hardcore ? "Hardcore" : "Softcore";
  const head = `<div class="bhead"><h2>Staples</h2><span class="small">Any class &middot; Season ${data.season} &middot; ${sc}</span></div>
    <p class="small" style="margin:0 0 12px">Items worth having whatever you play. The Hope of Cain chain differs per class, so each is made on the class where it is cheapest.</p>`;
  const cards = data.staples.map((st) => {
    const t = st.tier;
        const body = t ? rowHtml({ ...t.row, item: st.label, intro: `Make a ${esc(className(t.class))}`, cubed: false, mystic: null }, t.row.need.length > 0) : '<div class="small">No route found.</div>';
    return `<section class="card slot"><h3>${esc(st.item)}</h3>${st.note ? `<p class="small" style="margin:0 0 8px">${esc(st.note)}</p>` : ""}${body}</section>`;
  }).join("");
  return head + cards;
}

// ---------- cheapest natural primal per slot, for salvaging ----------

function salvageHtml(data) {
  const sc = data.hardcore ? "Hardcore" : "Softcore";
  const head = `<div class="bhead"><h2>Cheap primal for salvaging</h2><span class="small">Any class &middot; Season ${data.season} &middot; ${sc}</span></div>
    <p class="small" style="margin:0 0 12px">The quickest natural primal in each slot, any item, on whichever class is cheapest. Improve Legendary is never used, so none of this costs Primordial Ashes. Cheapest first.</p>`;
  const rows = data.salvage.map((a) => {
    const r = a.row;
    const slot = SLOT_NAMES[a.slot] || a.slot;
    return `<details class="rec"><summary><span class="nm">${esc(slot)}</span>
      <span class="meta"><span class="aff">Make a ${esc(className(a.class))}</span>${costHtml(r.n, r.path, r, r.who)}</span></summary>
      <div class="body">${recipeBody(r, r.path, r.lin, r.tt, `<div class="small">You get: ${esc(r.item)}</div>`, false)}</div></details>`;
  }).join("");
  return head + `<section class="card slot">${rows || '<div class="small">Nothing found.</div>'}</section>`;
}

// ---------- navigation ----------

// the lists are rolled for one season; for any other season they would not match, so they are not offered
const listed = (data) => (Math.max(1, Math.round(+$("season").value || 40))) === data.season;

// Saved requests sit right under Custom search. Each opens as a search link for the season and mode chosen now.
function savedHtml() {
  const saved = savedList();
  if (!saved.length) return "";
  const season = Math.max(1, Math.round(+$("season").value || 40)), hc = $("hc").value === "1";
  return `<div class="grp"><span class="gl">Saved</span><button type="button" class="nb"${route === "saved" ? ' aria-current="page"' : ""} data-route="saved">All saved (${saved.length})</button>` +
    saved.map((e) => `<button type="button" class="nb" data-link="${esc(requestHash(e.req, season, hc))}">${esc(e.label)}</button>`).join("") + `</div>`;
}

function navHtml(data) {
  if (!listed(data)) {
    return `<div class="grp"><button type="button" class="nb mode"${route === "search" ? ' aria-current="page"' : ""} data-route="search">Custom search</button></div>` + savedHtml() +
      `<div class="grp"><span class="small">No prepared builds for season ${Math.max(1, Math.round(+$("season").value || 40))}. Custom search works for any season.</span></div>`;
  }
  const groups = [];
  for (const b of data.builds) {
    let g = groups.find((x) => x.cls === b.class);
    if (!g) groups.push(g = { cls: b.class, list: [] });
    g.list.push(b);
  }
  const btn = (id, label, cls = "") => `<button type="button" class="nb ${cls}" data-route="${id}"${route === id ? ' aria-current="page"' : ""}>${label}</button>`;
  return `<div class="grp">${btn("search", "Custom search", "mode")}</div>` + savedHtml() +
    (data.staples && data.staples.length ? `<div class="grp"><span class="gl">Any class</span>${btn("staples", "Staples")}${data.salvage && data.salvage.length ? btn("salvage", "Cheap primals") : ""}</div>` : "") +
    `<div class="grp"><span class="gl top">Builds</span></div>` +
    groups.map((g) => `<div class="grp"><span class="gl">${esc(className(g.cls))}</span>${g.list.map((b) => btn(b.id, esc(b.title))).join("")}</div>`).join("");
}

let announced = "";
function show() {
  if (current && !listed(current) && route !== "search" && route !== "saved") route = "search";   // a build link from another season: fall back to the search
  const isBuild = route !== "search" && route !== "saved";   // "staples" and every build id share the build view
  $("viewSearch").hidden = route !== "search";
  $("viewSaved").hidden = route !== "saved";
  $("viewBuild").hidden = !isBuild;
  if (current) {
    $("nav").innerHTML = navHtml(current);
    const on = $("nav").querySelector('[aria-current="page"]');
    // centre the current build inside the nav only (scrollIntoView would also scroll the page)
    const nav = $("nav");
    if (on) nav.scrollTo({ left: on.offsetLeft - (nav.clientWidth - on.offsetWidth) / 2, top: on.offsetTop - (nav.clientHeight - on.offsetHeight) / 2 });
  }
  if (isBuild && current) {
    const b = current.builds.find((x) => x.id === route);
    $("viewBuild").innerHTML = route === "staples" ? staplesHtml(current) : route === "salvage" ? salvageHtml(current) : b ? buildHtml(b, current) : `<div class="card empty">No such build.</div>`;
    // a card holding exactly one recipe opens from a click anywhere on it (see the click handler below)
    $("viewBuild").querySelectorAll("section.slot").forEach((c) => c.classList.toggle("single", c.querySelectorAll(":scope > details.rec").length === 1));
  }
  // app.js loads the search (or the saved page) for the view; announce each change once, so redrawing the nav does not restart it
  const key = route + "|" + location.hash;
  if (key !== announced) { announced = key; window.dispatchEvent(new CustomEvent("d3-route", { detail: route })); }
}

function go(next, push = true) {
  route = next;
  if (push) history.pushState(null, "", next === "search" ? location.pathname + location.search : "#" + next);
  show();
  window.scrollTo({ top: 0 });
}

function fromHash() {
  let h = "";
  try { h = decodeURIComponent(location.hash.replace(/^#/, "").split("?")[0]); } catch (e) { /* malformed: start page */ }
  route = h || "search";
  if (!["search", "staples", "salvage", "saved"].includes(route) && current && !current.builds.some((b) => b.id === route)) route = "search";
}

async function refresh() {
  try {
    current = await load(modeKey());
  } catch (e) {
    $("nav").innerHTML = `<span class="small">Could not load the prepared builds (${esc(e.message)}). Custom search still works.</span>`;
    fromHash();
    show();   // the search and saved views need no prepared data
    return;
  }
  fromHash();
  show();
}

// Recipes open and close from a click almost anywhere: on the card around a single recipe, or on the recipe itself (its summary
// already toggles natively, so nested summaries and links are left alone). Selecting text never counts as a click.
$("viewBuild").addEventListener("click", (e) => {
  const link = e.target.closest("a[data-route]");
  if (link) { e.preventDefault(); go(link.dataset.route); return; }
  if (String(window.getSelection()).length || e.target.closest("a, button")) return;
  const rec = e.target.closest("details.rec");
  if (rec) {
    if (e.target.closest("summary")) return;          // the recipe's own summary, or a nested one (tooltip, cheaper option): native toggle
    rec.open = !rec.open;
    return;
  }
  const card = e.target.closest("section.slot.single");
  if (card) { const r = card.querySelector(":scope > details.rec"); r.open = !r.open; }
});
$("home").addEventListener("click", (e) => { e.preventDefault(); go("search"); });
$("nav").addEventListener("click", (e) => {
  const l = e.target.closest("button[data-link]");
  if (l) { location.hash = l.dataset.link.slice(1); window.scrollTo({ top: 0 }); return; }
  const b = e.target.closest("button[data-route]");
  if (b) go(b.dataset.route);
});
window.addEventListener("d3-saved", show);
window.addEventListener("popstate", () => { fromHash(); show(); });
$("hc").addEventListener("change", refresh);
$("season").addEventListener("input", show);
// nav is empty until the data arrives; the search view alone must work if the fetch fails, so show it at once.
fromHash();
$("viewSearch").hidden = route !== "search";
refresh();
