// Copyright 2026 FNG. Use, modification and redistribution are permitted under the conditions in LICENSE:
// credit the source, and visibly link to the site or repository if you use its outputs in a user-facing application.
import { statName, statAbbr, isSecondary, RANGE_STEMS, WEAPON_SLOTS, fmtValue, isPct, HIDDEN, CLASS_NAMES, SLOT_NAMES, materials } from "./stats.js?v=0f03afb94a";
import { slotPlural, matsHtml, stepsHtml, mysticCanFinish, tooltipRows, requestHash, parseRequestHash, savedList, savedHas, savedToggle, savedRemove, DEFAULT_CONVERTS } from "./recipe.js?v=0f03afb94a";

const $ = (id) => document.getElementById(id);
// Forward the cache-busting version index.html stamped onto our own src= down to the worker, which forwards it
// again to its own sub-fetches (pkg/d3cube.js, the wasm binary, data.json) — see worker.js and LEDGER V137.
const V = new URL(import.meta.url).searchParams.get("v");
const worker = new Worker(`./worker.js${V ? "?v=" + V : ""}`, { type: "module" });
let info = null;
let stemList = [];           // [{stem, name}]
let statMax = new Map();     // stem -> the highest value the picked item can roll (box units)
let wants = [];              // [{stem, min}]
let itemList = [];           // [{id, name, slot, classes, cross}]
let pickedItem = null;       // the one item the player is chasing
let searchId = 0;
const stemCache = new Map();
const pending = new Map();

// Small persisted preferences (season, mode, theme). Storage can be unavailable (private windows), so never rely on it.
const store = {
  get(k) { try { return localStorage.getItem("d3r-" + k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem("d3r-" + k, v); } catch (e) { /* ignore */ } },
};

// "Before you start" prompt: shown until acknowledged. Version the key so materially changed wording can re-prompt.
const RULES_KEY = "rules-v1";
function initRules() {
  const dlg = $("rules");
  const ok = () => { acked = true; store.set(RULES_KEY, "1"); dlg.close("ok"); };
  $("rulesOk").addEventListener("click", ok);
  // Esc must not count as reading it. Some browsers close a modal <dialog> on Esc even when "cancel" is prevented,
  // so reopen if it closed without the button.
  let acked = !!store.get(RULES_KEY);
  dlg.addEventListener("cancel", (e) => e.preventDefault());
  dlg.addEventListener("close", () => { if (!acked && !dlg.returnValue) dlg.showModal(); });
  $("rulesBtn").addEventListener("click", () => { dlg.returnValue = ""; dlg.showModal(); });
  if (!store.get(RULES_KEY) && typeof dlg.showModal === "function") dlg.showModal();
}
initRules();

worker.onmessage = (e) => {
  const m = e.data;
  if (m.type === "ready") { info = m.info; start(); }
  else if (m.type === "stems") { const r = pending.get(m.key); if (r) { pending.delete(m.key); r({ stems: m.stems, max: m.max }); } }
  else if (m.type === "progress" || m.type === "done") { if (m.id === searchId) onResults(m.results, m.type === "done"); }
  else if (m.type === "error") { $("status").textContent = "Error: " + m.message; $("go").disabled = false; }
};

const className = (c) => CLASS_NAMES[c] || c;
const slotName = (s) => SLOT_NAMES[s] || s;

// ---------- theme, season / mode ----------

function currentTheme() {
  const t = document.documentElement.dataset.theme;
  if (t) return t;
  return window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}
function syncThemeButton() { $("theme").innerHTML = currentTheme() === "dark" ? "&#9788;" : "&#9790;"; }
function initTheme() {
  syncThemeButton();
  $("theme").addEventListener("click", () => {
    const next = currentTheme() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    store.set("theme", next);
    syncThemeButton();
  });
}

function syncContext() {
  const season = Math.max(1, Math.round(+$("season").value || 40));
  $("ctxText").textContent = `Season ${season} · ${$("hc").value === "1" ? "Hardcore" : "Softcore"}`;
  store.set("season", String(season));
  store.set("hc", $("hc").value);
}
function initContext() {
  const s = store.get("season"), h = store.get("hc");
  if (s && +s > 0) $("season").value = s;
  if (h === "0" || h === "1") $("hc").value = h;
  syncContext();
  $("season").addEventListener("input", syncContext);
  $("hc").addEventListener("change", syncContext);
  $("ctxBtn").addEventListener("click", () => {
    const open = $("ctxEdit").hidden;
    $("ctxEdit").hidden = !open;
    $("ctxBtn").setAttribute("aria-expanded", String(open));
    $("ctxBtn").textContent = open ? "done" : "change";
  });
}

// ---------- keyboard-navigable autocomplete ----------
// source() -> [{html, value}] for the current text; Up/Down move, Enter (or click) picks, Escape closes.

function combo(input, box, source, emptyText, onPick) {
  let items = [], active = -1;
  const paint = () => {
    box.innerHTML = items.length
      ? items.map((x, i) => `<div role="option" data-i="${i}">${x.html}</div>`).join("") +
        `<div class="keys" aria-hidden="true"><kbd>&uarr;</kbd><kbd>&darr;</kbd> move <kbd>&crarr;</kbd> select <kbd>esc</kbd> close</div>`
      : `<div class="empty">${emptyText}</div>`;
    setActive(active, false);
  };
  // One highlight only: the keyboard and the mouse pointer move the same marker (a resting pointer must not
  // look like a second, competing selection).
  const setActive = (i, scroll) => {
    active = i;
    box.querySelectorAll("[data-i]").forEach((el, k) => {
      el.classList.toggle("active", k === i);
      el.setAttribute("aria-selected", String(k === i));
    });
    const a = box.querySelector(".active");
    if (a && scroll) a.scrollIntoView({ block: "nearest" });
  };
  const open = () => { items = source(); active = items.length ? 0 : -1; paint(); box.hidden = false; input.setAttribute("aria-expanded", "true"); };
  const close = () => { box.hidden = true; input.setAttribute("aria-expanded", "false"); };
  const pick = (i) => { const x = items[i]; if (!x) return; input.value = ""; close(); onPick(x.value); };
  input.addEventListener("input", open);
  input.addEventListener("focus", open);
  input.addEventListener("keydown", (e) => {
    const down = e.key === "ArrowDown" || e.key === "Down", up = e.key === "ArrowUp" || e.key === "Up";
    if (down || up) {
      e.preventDefault();
      if (box.hidden) { open(); return; }
      if (!items.length) return;
      setActive(down ? Math.min(items.length - 1, active + 1) : Math.max(0, active - 1), true);
    } else if (e.key === "Enter") {
      if (!box.hidden && items.length) { e.preventDefault(); pick(Math.max(0, active)); }
    } else if (e.key === "Escape" || e.key === "Tab") {
      close();
    }
  });
  // mousedown (not click) so the pick lands before the input loses focus
  // Only a pointer that really moved counts: browsers also fire a phantom mousemove when the list scrolls or redraws under
  // a resting pointer, which must not steal the highlight back from the arrow keys.
  let px = -1, py = -1;
  box.addEventListener("mousemove", (e) => {
    if (e.clientX === px && e.clientY === py) return;
    px = e.clientX; py = e.clientY;
    const el = e.target.closest("[data-i]");
    if (el && +el.dataset.i !== active) setActive(+el.dataset.i, false);
  });
  box.addEventListener("mousedown", (e) => {
    const el = e.target.closest("[data-i]");
    if (el) { e.preventDefault(); pick(+el.dataset.i); }
  });
  document.addEventListener("click", (e) => { if (e.target !== input && !box.contains(e.target)) close(); });
  return { close };
}

// ---------- setup ----------

function start() {
  initTheme();
  initContext();
  $("loading").hidden = true;
  $("app").hidden = false;
  $("cls").innerHTML = info.classes.map((c, i) => `<option value="${i}">${className(c)}</option>`).join("");
  $("cls").addEventListener("change", loadStems);
  itemList = info.items;
  combo($("itemFind"), $("itemPick"), itemSource, "No matching item", pickItem);
  combo($("find"), $("pick"), statSource, "No matching stat on this item", (stem) => { wants.push({ stem, min: "" }); renderChips(); });
  $("go").addEventListener("click", go);
  initActions();
  renderItemChips();
  loadStems().then(() => onRoute(routeOfHash()));
}

function itemSource() {
  const q = $("itemFind").value.trim().toLowerCase();
  if (!q) return [];
  return itemList.filter((it) => it.name.toLowerCase().includes(q)).slice(0, 60)
    .map((it) => ({ value: it, html: `${it.name} <span class="hint">${slotName(it.slot)}</span>` }));
}

function statSource() {
  const q = $("find").value.trim().toLowerCase();
  const have = new Set(wants.map((w) => w.stem));
  return stemList.filter((s) => !have.has(s.stem) && (!q || s.name.toLowerCase().includes(q) || s.stem.toLowerCase().includes(q))).slice(0, 60)
    .map((s) => ({ value: s.stem, html: s.name }));
}

function pickItem(it) {
  pickedItem = it;
  const ci = +$("cls").value;
  if (!it.classes.includes(ci) && !it.cross.includes(ci)) $("cls").value = String(it.classes[0] ?? it.cross[0] ?? ci);
  renderItemChips();
  loadStems();
}

// Only one target item per search: once chosen, the search box gives way to the item's chip.
function renderItemChips() {
  const it = pickedItem;
  $("itemChips").innerHTML = it
    ? `<div class="chip"><span>${it.name} <span class="hint">${slotName(it.slot)}</span></span><button title="Choose a different item" aria-label="Choose a different item">&times;</button></div>`
    : "";
  $("itemFind").hidden = !!it;
  if (!it) $("itemPick").hidden = true;
  const b = $("itemChips").querySelector("button");
  if (b) b.addEventListener("click", () => { pickedItem = null; renderItemChips(); loadStems(); $("itemFind").focus(); });
}

function stemsFor(ci, slot, item) {
  const key = ci + "/" + slot + "/" + item;
  if (stemCache.has(key)) return Promise.resolve(stemCache.get(key));
  return new Promise((res) => {
    pending.set(key, (s) => { stemCache.set(key, s); res(s); });
    worker.postMessage({ type: "stems", key, class: ci, slot, item });
  });
}

let stemsGen = 0;   // overlapping loads (a hero ticked, then unticked) commit only the newest
async function loadStems() {
  const gen = ++stemsGen;
  const ci = +$("cls").value;
  const all = new Map();
  const maxOf = new Map();
  if (pickedItem) {
    // what the item can roll for its own class and for every other class (one of them may roll or enchant a stat the item's
    // class never gets, e.g. Lightning damage on a Necromancer's amulet, enchanted by a Wizard)
    const classes = [ci, ...[0, 1, 2, 3, 4, 5, 6].filter((c) => c !== ci)];
    for (const c of classes) {
      const { stems: st, max } = await stemsFor(c, pickedItem.slot, pickedItem.id);
      for (const k of Object.keys(st)) if (!HIDDEN.test(k)) all.set(k, statName(k));
      // the highest each stat can roll on this item for any hero, in the units of the box (percentages as 15, not 0.15)
      for (const [k, v] of Object.entries(max)) { const u = Math.round((isPct(k) ? v * 100 : v) * 1e4) / 1e4; if (!(u <= (maxOf.get(k) ?? -1))) maxOf.set(k, u); }
    }
  }
  if (gen !== stemsGen) return;
  stemList = [...all.entries()].map(([stem, name]) => ({ stem, name })).sort((a, b) => a.name.localeCompare(b.name));
  statMax = maxOf;
  wants = wants.filter((w) => all.has(w.stem));
  renderChips();
}

// a typed minimum, kept between 0 and the item's best roll of that stat ("" stays empty)
function clampMin(stem, v) {
  if (v === "" || Number.isNaN(+v)) return "";
  const hi = statMax.get(stem);
  const x = Math.max(0, hi === undefined ? +v : Math.min(+v, hi));
  return String(Math.round(x * 1e4) / 1e4);
}

function renderChips() {
  $("chips").innerHTML = wants.map((w, i) => `<div class="chip"><span>${statName(w.stem)}</span>${w.stem === "Sockets" ? "" : `<input type="number" step="any" min="0"${statMax.has(w.stem) ? ` max="${statMax.get(w.stem)}" title="Highest this item can roll: ${isPct(w.stem) ? statMax.get(w.stem) + " %" : fmtValue(w.stem, statMax.get(w.stem))}"` : ""} placeholder="min${isPct(w.stem) ? " %" : ""}" value="${w.min}" data-i="${i}">`}<button data-x="${i}" title="Remove" aria-label="Remove">&times;</button></div>`).join("");
  $("chips").querySelectorAll("input").forEach((el) => {
    el.addEventListener("input", () => { wants[+el.dataset.i].min = el.value; });
    // out-of-range numbers are pulled back to the nearest roll the item can have when the box is left
    el.addEventListener("change", () => { const w = wants[+el.dataset.i]; w.min = clampMin(w.stem, el.value); el.value = w.min; });
  });
  $("chips").querySelectorAll("button").forEach((el) => el.addEventListener("click", () => { wants.splice(+el.dataset.x, 1); renderChips(); }));
}

// ---------- search: one pass per result category ----------
// Categories, best first. Each is its own search so the cheapest of EACH kind is found: an ancient or plain legendary
// is usually far cheaper than a primal, and the player chooses the trade. "crafted" (Improve Legendary) only counts
// when the search may end on an Improve Legendary step.
const TIERS = [
  { key: "primal", quality: "primal", crafted: false, label: "primal" },
  { key: "crafted", quality: "crafted", crafted: true, label: "crafted primal" },
  { key: "ancient", quality: "ancient", crafted: false, label: "ancient" },
  { key: "normal", quality: "normal", crafted: false, label: "legendary" },
];

let run = null;   // the run in flight, or the last one: {base, deadline, i, results, wantsSnap, item, show, stopped, capped, warnings, finished, onUpdate, onDone, onCancel}

// The request the form currently describes (see recipe.js for the shape).
function readRequest() {
  const num = (id) => Math.max(0, Math.round(+$(id).value || 0));
  return {
    c: +$("cls").value, i: pickedItem.id, w: wants.map((w) => [w.stem, clampMin(w.stem, String(w.min))]), po: $("po").checked,
    p: ["cc", "ch", "cr", "cp"].map((id) => $(id).value), f: num("floor"), n: Math.max(1, Math.round(+$("top").value || 1)),
    // most hand-overs to another class during the cube steps ("" = no limit), and the cost of each hand-over
    xn: $("xn").value.trim() === "" ? "" : String(Math.max(0, Math.round(+$("xn").value || 0))),
    xs: String(Math.max(0, +$("cs").value || 0)),   // an empty cost searches as 0, so the link says 0
    // most Convert Set Item steps per recipe ("" = no limit)
    cn: $("cn").value.trim() === "" ? "" : String(Math.max(0, Math.round(+$("cn").value || 0))),
  };
}
const contextNow = () => ({ season: Math.max(1, Math.round(+$("season").value || 40)), hc: $("hc").value === "1" });

function baseQuery(req, item, season, hc) {
  // The planner works in whole numbers; hundredths keep ratios like 0.75 exact.
  const cost = (v) => Math.max(1, Math.round((+v || 0) * 100));
  const [cc, ch, cr, cp] = req.p;
  // Improve Legendary is limited by its price alone. Convert stays at 2 here (cheap and branching at every step, it widens the
  // search the most) until it gets a control of its own. set_roots: a set item's recipe may start from any piece of its set.
  return {
    class: req.c, slots: [item.slot], items: [item.id], season, hardcore: hc,
    // every class may take the item (`max_switch` hand-overs during the cube steps, any class at the Mystic)
    switch: [0, 1, 2, 3, 4, 5, 6].filter((c) => c !== req.c), max_switch: req.xn === "" ? 255 : Math.min(254, +req.xn || 0),
    cost_switch: Math.max(0, Math.round((+req.xs || 0) * 100)),
    // an item of no class may also be crafted by another class's Hope of Cain, which counts as a hand-over
    craft_any: item.classes.length > 1,
    eligible: true, n0: 0, maxpos: 4096, maxsteps: 1000, max_primalize: 255, max_convert: (req.cn ?? DEFAULT_CONVERTS) === "" ? 255 : Math.min(254, +(req.cn ?? DEFAULT_CONVERTS) || 0), set_roots: true,
    cost_h: cost(ch), cost_r: cost(cr), cost_p: cost(cp), cost_c: cost(cc), top: 4, min_frac: Math.min(1, req.f / 100),
    wants: req.w.map(([stem, m]) => {
      const min = m === "" ? null : (isPct(stem) ? +m / 100 : +m);
      return { fam: [stem], min: min !== null && !Number.isNaN(min) ? min : null };
    }),
    // "all wanted stats" is the target; routes one stat short come back separately (finish them at the Mystic)
    min_match: req.w.length,
    // the search is cheapest-first, so once a route lands every stat (or all but one, for the Mystic) nothing later is cheaper
    end_on_near: req.w.length >= 2,
  };
}

function startTier() {
  const t = run.tiers[run.i];
  const left = Math.max(1000, run.deadline - performance.now());
  const budget = Math.max(1500, left / (run.tiers.length - run.i));
  const q = { ...run.base, quality: t.quality, end_on_primalize: t.crafted };
  if (t.crafted && q.max_primalize < 1) { nextTier(); return; }
  searchId += 1;
  worker.postMessage({ type: "search", id: searchId, query: q, budgetMs: budget });
  run.onUpdate(run, false, `Searching for ${t.label} recipes…`);
}

function nextTier() {
  run.i += 1;
  if (run.i >= run.tiers.length) { finish(); return; }
  startTier();
}

// One search for one request. The worker runs one search at a time, so a new run replaces (and cancels) the one in flight.
function startRun(req, item, season, hc, secs, onUpdate, onDone, onCancel) {
  if (run && !run.finished) { run.finished = true; worker.postMessage({ type: "cancel" }); if (run.onCancel) run.onCancel(); }
  run = {
    base: baseQuery(req, item, season, hc), deadline: performance.now() + Math.max(1, secs) * 1000,
    // Primal only keeps natural primals alone: no crafted primal, ancient or plain legendary, so the whole time limit goes to them
    tiers: req.po ? TIERS.filter((t) => t.key === "primal") : TIERS, po: !!req.po,
    i: 0, results: {}, wantsSnap: req.w.map((w) => w[0]), item, show: req.n,
    stopped: false, capped: false, warnings: new Set(), finished: false, onUpdate, onDone, onCancel,
  };
  startTier();
}

function onResults(r, final) {
  const t = run.tiers[run.i];
  r.warnings.forEach((w) => run.warnings.add(w));
  run.results[t.key] = r;
  if (final && !r.status.done) run.stopped = true;   // ran out of time in this category
  if (final && r.status.capped) run.capped = true;   // the planner's own search limit, not the clock
  run.onUpdate(run, false);
  if (final) nextTier();
}

function finish() {
  run.finished = true;
  run.onDone(run);
}

// ---------- the search page ----------

let last = null;          // {req, item, season, hc}: what the results on screen answer, for Copy link and Save
let lastApplied = "";     // the request link already loaded into the form
let notice = "";          // one line to show under the next finished search (a link replaced the visitor's season or mode)

function go() {
  if (!pickedItem) { $("status").textContent = "Search for an item you want first."; return; }
  const req = readRequest(), { season, hc } = contextNow();
  const secs = Math.max(1, Math.round(+$("secs").value || 0));
  last = { req, item: pickedItem, season, hc };
  const note = notice;
  notice = "";
  $("out").innerHTML = "";
  $("actions").hidden = true;
  $("go").disabled = true;
  // the address bar now is the link to this search, so bookmarking the page keeps the request, season and mode
  try { history.replaceState(null, "", requestHash(req, season, hc)); lastApplied = location.hash; } catch (e) { /* ignore */ }
  startRun(req, pickedItem, season, hc, secs,
    (r, final, status) => { if (status) $("status").textContent = status; else $("out").innerHTML = resultsHtml(r, false); },
    (r) => {
      $("go").disabled = false;
      $("status").textContent = r.stopped ? "Stopped at the time limit — showing the best found so far. A longer time limit may find more." : note;
      $("out").innerHTML = resultsHtml(r, true);
      showActions();
      dropStale();   // the season or mode changed while this search ran: its results answer the old ones
    },
    () => { $("go").disabled = false; });
}

// results on screen answer one season and mode; once either changes they no longer apply, so drop them
function dropStale() {
  const { season, hc } = contextNow();
  if (!last || (last.season === season && last.hc === hc) || $("go").disabled) return;
  $("out").innerHTML = "";
  $("actions").hidden = true;
  $("status").textContent = `Season or mode changed: search again for Season ${season} · ${hc ? "Hardcore" : "Softcore"}.`;
}
$("season").addEventListener("input", dropStale);
$("hc").addEventListener("change", dropStale);

const labelOf = (item, req) => `${item.name} · ${req.w.map(([s]) => statAbbr(s)).join(", ") || "any roll"}`;

function showActions() {
  $("actions").hidden = false;
  $("actionNote").textContent = "";
  $("saveBtn").textContent = savedHas(last.req) ? "Saved ✓ (remove)" : "Save";
}

function initActions() {
  $("copyLink").addEventListener("click", async () => {
    if (!last) return;
    const url = location.origin + location.pathname + requestHash(last.req, last.season, last.hc);
    try { await navigator.clipboard.writeText(url); $("actionNote").textContent = "Link copied."; }
    catch (e) { $("actionNote").textContent = "Copy the address from the address bar."; }
  });
  $("saveBtn").addEventListener("click", () => {
    if (!last) return;
    const now = savedToggle(last.req, labelOf(last.item, last.req));
    $("saveBtn").textContent = now ? "Saved ✓ (remove)" : "Save";
    $("actionNote").textContent = now ? "Added to Saved." : "Removed from Saved.";
  });
}

// Load a request link into the form and run it. The link's season and mode win over the visitor's remembered ones.
async function applyLink(parsed) {
  const { req, season, hc } = parsed;
  const it = itemList.find((x) => x.id === req.i);
  if (!it || !info.classes[req.c]) { $("status").textContent = "This link names an item or class this version does not know."; return; }
  const was = contextNow();
  $("season").value = String(season);
  $("hc").value = hc ? "1" : "0";
  $("season").dispatchEvent(new Event("input", { bubbles: true }));
  $("hc").dispatchEvent(new Event("change", { bubbles: true }));
  $("cls").value = String(req.c);
  pickedItem = it;
  renderItemChips();
  ["cc", "ch", "cr", "cp"].forEach((id, k) => { $(id).value = req.p[k]; });
  $("xn").value = req.xn;
  $("cn").value = req.cn ?? DEFAULT_CONVERTS;
  $("cs").value = req.xs;
  $("floor").value = String(req.f);
  $("top").value = String(req.n);
  $("po").checked = !!req.po;
  wants = req.w.map(([stem, min]) => ({ stem, min }));
  await loadStems();   // drops any stat the item cannot roll and redraws the chips
  if (was.season !== season || was.hc !== hc) {
    notice = `Opened a link for Season ${season} · ${hc ? "Hardcore" : "Softcore"} (your own setting was ${was.season} · ${was.hc ? "Hardcore" : "Softcore"}; change it at the top).`;
  }
  go();
}

// ---------- the saved page: every saved request, computed for the season and mode chosen now ----------

let savedToken = 0;       // bumped to abandon a computation in flight (leaving the page, or recomputing)
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function stopSaved() { savedToken += 1; }

function renderSaved() {
  const host = $("viewSaved");
  const list = savedList();
  stopSaved();
  if (!list.length) {
    host.innerHTML = `<div class="card empty">Nothing saved yet. Run a search, then press Save under the results.</div>`;
    return;
  }
  const { season, hc } = contextNow();
  host.innerHTML = `<div class="bhead"><h2>Saved</h2><span class="small">Season ${season} &middot; ${hc ? "Hardcore" : "Softcore"}</span></div>
    <div class="actions"><button type="button" class="btn" id="recompute">Recompute</button><span id="savedStatus" class="small"></span></div>` +
    list.map((e) => `<section class="card saved" data-id="${esc(e.id)}"><div class="shead"><h3>${esc(e.label)}</h3>
      <span><a href="${esc(requestHash(e.req, season, hc))}">open in search</a> <button type="button" class="link" data-rm>remove</button></span></div>
      <div class="sout small">Waiting&hellip;</div></section>`).join("");
  host.querySelectorAll("[data-rm]").forEach((b) => b.addEventListener("click", () => {
    const sec = b.closest("section.saved");
    savedRemove(sec.dataset.id);
    sec.remove();
    if (!host.querySelector("section.saved")) renderSaved();
  }));
  $("recompute").addEventListener("click", renderSaved);
  computeSaved(list, season, hc, ++savedToken);
}

function computeSaved(list, season, hc, token) {
  const status = $("savedStatus");
  const step = (k) => {
    if (token !== savedToken) return;
    if (k >= list.length) { status.textContent = ""; return; }
    const e = list[k], req = e.req;
    const item = itemList.find((x) => x.id === req.i);
    const sec = [...$("viewSaved").querySelectorAll("section.saved")].find((s) => s.dataset.id === e.id);
    if (!sec) { step(k + 1); return; }
    const out = sec.querySelector(".sout");
    if (!item || !info.classes[req.c]) { out.textContent = "This item is not in this version."; step(k + 1); return; }
    status.textContent = `Computing ${k + 1} of ${list.length}…`;
    startRun(req, item, season, hc, 20,
      (r, final, st) => { if (!st) { out.classList.remove("small"); out.innerHTML = resultsHtml(r, false); } },
      (r) => { out.classList.remove("small"); out.innerHTML = resultsHtml(r, true); step(k + 1); },
      () => {});
  };
  step(0);
}

// ---------- routes ----------

const routeOfHash = () => { try { return decodeURIComponent(location.hash.replace(/^#/, "").split("?")[0]) || "search"; } catch (e) { return "search"; } };

// builds.js announces every view change (route + fragment); the engine may not be ready yet, in which case start() calls this again.
function onRoute(route) {
  if (!info) return;
  if (route !== "saved") stopSaved();
  if (route === "saved") renderSaved();
  else if (route === "search") {
    const h = location.hash;
    const parsed = h !== lastApplied ? parseRequestHash(h) : null;
    if (parsed) { lastApplied = h; applyLink(parsed); }
  }
}
window.addEventListener("d3-route", (e) => onRoute(e.detail));

// ---------- rendering ----------


const TAGS = {
  primal:  { best: ["Best", "t-best"], part: ["Finish at Mystic", "t-best"] },
  crafted: { best: ["Best · crafted primal", "t-best"], part: ["Crafted primal · finish at Mystic", "t-best"] },
  ancient: { best: ["Great ancient", "t-ancient"], part: ["Great ancient · finish at Mystic", "t-ancient"] },
  normal:  { best: ["Legendary", "t-normal"], part: ["Legendary · finish at Mystic", "t-normal"] },
};
const TIER_OF = { primal: "primal", crafted: "crafted", ancient: "ancient", normal: "normal" };



function hitHtml(h, tier, snap, item, cls) {
  const wantStems = new Set(snap);
  const matchedStems = new Set(h.matched.map((i) => snap[i]));
  const missing = snap.filter((_, i) => !h.matched.includes(i));
  const perfect = !missing.length;
  const [tagText, tagCls] = TAGS[tier][perfect ? "best" : "part"];
  // Headline: the requested stats the item rolls (highlighted), then any other PRIMARY stats it rolled; secondary stats only when
  // requested. A recipe that finishes at the Mystic ends with the stat the Mystic is to roll.
  const seen = new Set();
  const parts = [];
  for (const s of snap) {
    if (matchedStems.has(s)) { seen.add(s); parts.push(`<span class="want">${statAbbr(s)}</span>`); }
  }
  const onWeapon = WEAPON_SLOTS.has(item.slot);
  for (const l of h.lines) {
    if (l.stem === "item power" || seen.has(l.stem) || isSecondary(l.stem) || l.stem === "Sockets" || l.stem === "Indestructible") continue;
    if (wantStems.has(l.stem)) continue;
    if (onWeapon && RANGE_STEMS.has(l.stem)) continue;   // every weapon rolls its damage; it is a given, so it stays in the full tooltip
    seen.add(l.stem);
    parts.push(`<span class="extra">${statAbbr(l.stem)}</span>`);
  }
  if (!perfect) parts.push(`<span class="want">then Mystic: ${missing.map((m) => statAbbr(m)).join(" or ")}</span>`);
  const lines = tooltipRows(h.lines).map((r) => {
    const w = wantStems.has(r.stem);
    return `<span class="${w ? "want" : ""}">${r.label}</span><span class="v ${w ? "want" : ""}">${r.value}</span>`;
  }).join("");
  const mats = matsHtml(materials(h));
  const craftedNote = tier === "crafted" ? `<div class="small">Improve Legendary primals: only one can be worn per character.</div>` : "";
  return `<article class="hit"><div class="head"><span class="tag ${tagCls}">${tagText}</span><span class="aff">${parts.join(", ")}</span></div>
    ${stepsHtml(h, missing, wantStems, { cls, name: (c) => className(info.classes[c]) })}${craftedNote}<div class="mats">${mats}</div>
    <details class="full"><summary>Full tooltip</summary><div class="lines">${lines}</div></details></article>`;
}

// Per category: the cheapest recipes that land every wanted stat, plus one "finish at the Mystic" recipe when it beats
// them (or when nothing lands every stat) — a rated best-effort instead of an empty answer.
function pickHits(key, r, snap, show) {
  const perfect = r.full.slice(0, show);
  let partial = [];
  if (snap.length >= 2) {
    const best = perfect.length ? perfect[0].cost : Infinity;
    const wantStems = new Set(snap);
    // only recipes whose item has a line the Mystic can swap out
    partial = r.near.filter((h) => h.cost < best && mysticCanFinish(h, snap.filter((_, i) => !h.matched.includes(i)), wantStems)).slice(0, 1);
  }
  return [...perfect, ...partial];
}

function resultsHtml(run, final) {
  const snap = run.wantsSnap;
  let html = "";
  if (run.warnings.size) html += `<div class="warn">${[...run.warnings].join("; ")}</div>`;
  // Drop any recipe that a better category matches or beats on cost with at least as many of the wanted stats
  // (e.g. a crafted primal that costs more than a natural primal): it would only be noise.
  const shown = [];
  let body = "";
  for (const t of TIERS) {
    const r = run.results[t.key];
    if (!r) continue;
    for (const h of pickHits(t.key, r, snap, run.show)) {
      if (shown.some((s) => s.matched >= h.matched.length && s.cost <= h.cost)) continue;
      shown.push({ matched: h.matched.length, cost: h.cost });
      body += hitHtml(h, TIER_OF[t.key], snap, run.item, run.base.class);
    }
  }
  if (shown.length) html += `<section class="card">${body}</section>`;
  else if (final) {
    const why = run.po && !run.stopped && !run.capped
      ? "No primal recipe found. Try fewer stats or a longer time limit, or untick Primal only."
      : run.stopped
      ? "Nothing passable turned up before the time limit. Raise the time limit under Costs and Limits or drop a stat."
      : run.capped
        ? "No recipe turned up within the search limit. Try fewer stats or a lower good-roll floor."
        : "No passable recipe found. Try fewer stats or a lower good-roll floor.";
    html += `<section class="card"><div class="empty">${why}</div></section>`;
  }
  return html;
}
