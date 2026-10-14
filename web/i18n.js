const translations = {
  en: {
    tagline: "Targeted Crafting Recipes for Diablo 3 on Consoles",
    headerNote: "Recipes only work on brand new level 1 seasonal characters — go directly to Adventure Mode and do not gain any XP before crafting.",
    ctxChange: "change",
    resultsFor: "Results for",
    mysticPlus: "+ Mystic",
    footerZhBy: "Chinese localization by",
    footerAnd: " and ",
    seasonLabel: "Season {s}",
    footerPeriod: ".",
    footerLetUsKnow: "Let us know on GitHub",
    importFailedList: " Failed: {f}.",
    importSkipped: "{n}: skipped {s}",
    potionSlot: "Potion slot",
    invalidSavedBuildData: "Invalid saved build data",
    unknownItemShort: "Unknown item",
    orJoin: " or ",
    backToStart: "Back to the start",
    switchThemeAria: "Switch light or dark theme",
    navAria: "Prepared builds and custom search",
    matsEach: "{names}: {n} each",
    listSep: ", ",
    sanctifyAvailable: "Sanctification is available in this season.",
    beforeStart: "Before you start",
    beforeStartDesc: "Every recipe here assumes these. Skipping one is the usual reason a result doesn't match.",
    bs1: "Unlock primals first: clear a solo Greater Rift 70 on another hero of the same season and mode.",
    bs2: "Use a fresh level 1 seasonal hero.",
    bs3: "Don't gain any XP, including in town by reading Haedrig's book.",
    bs4: "Don't do any earlier transmutes on the slot.",
    bs5: "Follow the steps in order.",
    bs6: "Check each intermediate item against the stats shown, and stop if one doesn't match.",
    understand: "I understand",
    loadingTables: "Loading the item tables…",
    step1Title: "1. Class and item",
    cls: "Class",
    itemYouWant: "Item you want",
    searchItemsPh: "Search items: crown, boots, quiver…",
    step2Title: "2. Stats you want",
    primalOnly: "Primal only",
    primalOnlyTitle: "Only show recipes that end on a natural primal. Crafted primals (Improve Legendary), ancients and plain legendaries are skipped, so the search spends its whole time limit on natural primals.",
    searchStatsPh: "Search stats: crit, cooldown, dexterity, multishot…",
    pickNote: "Pick as many as you like. Recipes that land all of them are listed first; if one stat is missing, the Mystic can usually add it.",
    costsLimits: "Costs and Limits",
    costsDesc: "Relative cost of one step of each kind. The search finds the recipe with the lowest total by these weights, so only the ratios matter.",
    convert: "Convert",
    convertTitle: "Convert Set Item",
    hopeOfCain: "Hope of Cain",
    reforge: "Reforge",
    sanctification: "Sanctification",
    ashes: "Ashes",
    ashesTitle: "Improve Legendary (100 Primordial Ashes)",
    heroSwap: "Hero swap",
    heroSwapTitle: "Relative cost of handing the item to a hero of another class (a throwaway level 1 will do), in the same units as the costs before it. Higher means fewer swaps.",
    goodRoll: "Good roll (%)",
    goodRollTitle: "Minimum roll for a wanted stat on ancient and legendary results, as a percentage of its maximum. Primals are always maximum.",
    recipesShown: "Recipes shown",
    timeLimit: "Time limit (s)",
    branchDesc: "How far the search may branch. Converts and hero swaps cost little, so each one more can find cheaper recipes but makes the search much slower. Leave a box empty for no limit. A hero swap hands the item to another class for a cube step: the item keeps its seed and the hero's class changes what it rolls. Any class may also create the item (each class's Hope of Cain picks and rolls differently), which counts as a hero swap; the later cube steps and the Mystic may be any class too.",
    mostSanct: "Most Sanctifications",
    mostSanctTitle: "Most Sanctification (Angelic Crucible) steps in one recipe. 0 turns Sanctification off, whatever its cost; leave empty for no limit. The default is 2 in seasons with Angelic Crucibles and 0 in others.",
    mostConverts: "Most converts",
    mostConvertsTitle: "Most Convert Set Item steps in one recipe. Leave empty for no limit.",
    mostSwaps: "Most hero swaps",
    mostSwapsTitle: "Most hand-overs to another class during the cube steps of one recipe. Leave empty for no limit. A hand-over just for the Mystic does not count.",
    noLimit: "no limit",
    sanctWarn: "Sanctification is enabled for an unsupported season. These results are not supported; use them only for emulator testing.",
    findRecipes: "Find Recipes",
    copyLink: "Copy link",
    save: "Save",
    editBuilds: "Edit builds",
    savedBuilds: "Saved builds",
    newBuild: "New build",
    cloneBuild: "Clone build",
    importBuilds: "Import builds",
    exportAllBuilds: "Export all saved builds",
    deleteSavedBuild: "Delete saved build",
    buildName: "Build name",
    buildNamePh: "My build",
    characterClass: "Character class",
    buildDesc: "Choose items and required affixes for each slot. Empty slots are skipped. Saved definitions can be used for a future search of the whole build. The TOML generator uses the first two stat priorities together and treats the third as a Mystic finish; arrange them in the order you want.",
    saveBuild: "Save build",
    exportToml: "Export TOML",
    buildDefLabel: "Build definition (ready to append to builds.toml)",
    localSaveNote: "Saved locally in this browser. Export a copy for backup; clearing browser data removes local builds.",
    searchBuildItems: "Search build items",
    chooseSavedBuild: "Choose a saved build",
    anyItemPlaceholder: "Any item",
    createNewBuild: "Create new build",
    findBuildItems: "Find build items",
    cancel: "Cancel",
    footerBeforeStart: "Before you start",
    season: "Season",
    mode: "Mode",
    softcore: "Softcore",
    hardcore: "Hardcore",

    customSearch: "Custom search",
    editBuildsNav: "Edit builds",
    searchBuildItemsNav: "Search build items",
    navSaved: "Saved",
    allSaved: "All saved",
    noPreparedBuilds: "No prepared builds for season {s}. Custom search works for any season.",
    anyClass: "Any class",
    staples: "Staples",
    cheapPrimals: "Cheap primals",
    builds: "Builds",
    couldNotLoadPrepared: "Could not load the prepared builds ({e}). Custom search still works.",

    cubed: "(cubed)",
    anyItem: "(any item)",
    noNaturalPrimal: "No natural primal turned up within the search limits. Try refining the search in Custom search.",
    cost: "cost",
    steps: "steps",
    asClass: "as {c}",
    noRoomFor: "(no room for {s} at the Mystic)",
    improveLegendaryPrimalNote: "Improve Legendary primals: only one can be worn per character.",
    cheaper: "Cheaper:",
    theseRecipesForSeason: "These recipes are for season {s}. Other seasons roll different items, so they will not match.",
    staplesTitle: "Staples",
    staplesDesc: "Items worth having whatever you play. The Hope of Cain chain differs per class, so each is made on the class where it is cheapest.",
    makeClass: "Make a {c}",
    noRouteFound: "No route found.",
    cheapPrimalSalvagingTitle: "Cheap primal for salvaging",
    cheapPrimalSalvagingDesc: "The quickest natural primal in each slot, any item, on whichever class is cheapest. Improve Legendary is never used, so none of this costs Primordial Ashes. Cheapest first.",
    youGet: "You get:",
    nothingFound: "Nothing found.",
    fullTooltip: "Full tooltip",
    noSuchBuild: "No such build.",

    "opens portals to a treasure room: an ancient gives a better map than a normal one; a primal is overkill": "opens portals to a treasure room: an ancient gives a better map than a normal one; a primal is overkill",
    "double crit socket": "double crit socket",
    "Equip on Follower: your follower cannot die.": "Equip on Follower: your follower cannot die.",

    qualityPrimal: "Primal",
    qualityCraftedPrimal: "Crafted primal",
    qualityAncient: "Ancient",
    qualityLegendary: "Legendary",

    tagBest: "Best",
    tagFinishMystic: "Finish at Mystic",
    tagBestCraftedPrimal: "Best · crafted primal",
    tagCraftedPrimalFinishMystic: "Crafted primal · finish at Mystic",
    tagGreatAncient: "Great ancient",
    tagGreatAncientFinishMystic: "Great ancient · finish at Mystic",
    tagLegendary: "Legendary",
    tagLegendaryFinishMystic: "Legendary · finish at Mystic",

    mysticFinish: "then Mystic:",
    crucibleNote: "Or use an Angelic Crucible for the last step to create a Sanctified item. Its seasonal power replaces an ordinary secondary affix on six-affix items. The listed cost and materials assume Improve Legendary with ashes.",

    costTip: "Relative cost: Hope of Cain 1, Reforge 5, Convert Set Item 0.75, Improve Legendary 25. Steps: crafts plus operations.",
    keyboardMove: "move",
    keyboardSelect: "select",
    keyboardClose: "close",

    errorPrefix: "Error: ",
    searchingRecipes: "Searching for {t} recipes…",
    stoppedAtLimit: "Stopped at the time limit — showing the best found so far. A longer time limit may find more.",
    noPrimalRecipeFound: "No primal recipe found. Try fewer stats, a longer time limit, or untick Primal only.",
    nothingBeforeLimit: "Nothing passable turned up before the time limit. Raise the time limit under Costs and Limits or drop a stat.",
    noRecipeInLimit: "No recipe turned up within the search limit. Try fewer stats or a lower good-roll floor.",
    noPassableRecipe: "No passable recipe found. Try fewer stats or a lower good-roll floor.",

    chooseDifferentItem: "Choose a different item",
    chooseDifferentItemFor: "Choose a different item for {s}",
    itemLabel: "Item",
    noMatchingItem: "No matching item",
    loadingAffixes: "Loading affixes...",
    statsYouWant: "Stats you want",
    affixHelp: "Leave empty for any roll. The search goes for all of them (the Mystic may add one); the order is kept when you export.",
    unavailableOnItem: " (unavailable on this item)",
    moveUpPriority: "Move up in priority",
    moveStatUp: "Move {s} up",
    removeStat: "Remove {s}",
    minPh: "min",
    highestRoll: "Highest this item can roll: {v}",
    noMatchingStats: "No matching stats.",
    classChanged: "Class changed. Items unavailable to this class were removed.",
    enterBuildName: "Enter a build name.",
    selectAtLeastOneItem: "Select at least one item.",
    waitAffixesSave: "Wait for the affixes to finish loading before saving.",
    buildSaved: "Build saved in this browser.",
    couldNotSaveBuild: "Could not save build: {e}",
    savedBuildLoaded: "Saved build loaded.",
    newBuildNotice: "New build.",
    savedBuildDeleted: "Saved build deleted. The editor still contains its items.",
    chooseTomlSmall: "Choose a TOML file smaller than 2 MB.",
    importingProgress: "Importing {n} ({i} of {t})...",
    duplicateBuildName: "Duplicate build name in this file. Rename it before importing.",
    importCancelled: "Import cancelled. No builds were saved.",
    savedBuildsChangedConflict: "Saved builds changed while you were deciding. Review the updated conflicts.",
    importComplete: "Import complete: {a} added, {r} overwritten, {k} kept or identical.",
    importFailed: "Import failed: {e}",
    unsupportedSlot: "Unsupported equipment slot: {s}",
    unknownItem: "Unknown item: {s}",
    slotRepeated: "The file repeats an equipment slot.",
    noMatchingClass: "No matching character class. Add a valid class field to the build.",
    itemUnavailableToClass: "{i} is unavailable to {c}",
    waitAffixesClone: "Wait for the affixes to finish loading before cloning.",
    copySuffix: " - Copy",
    buildCloned: "Build cloned and saved. You are editing {n}.",
    couldNotCloneBuild: "Could not clone build: {e}",
    noSavedBuildsExport: "No saved builds to export.",
    exportedBuilds: "Exported {n} saved builds. Unsaved editor changes are not included.",
    couldNotExportBuilds: "Could not export saved builds: {e}",
    savedBuildConflicts: "Saved build conflicts",
    conflictExplanation: "These imported builds differ from saved builds with the same name. Choose how to handle them. New builds will also be imported.",
    keepSaved: "Keep saved",
    overwriteConflicts: "Overwrite conflicts",
    importAsCopies: "Import as copies",
    cancelImport: "Cancel import",
    importConflicts: "Import conflicts",
    searchEngineUnavailable: "Search engine unavailable: {e}. Reload the page to retry.",
    couldNotLoadAffixes: "Could not load affixes: {e}",
    couldNotLoadItemTables: "Could not load item tables: {e}",
    workerCrashed: "Worker crashed",
    couldNotReadWorker: "Could not read the worker response",

    timeLimitPerItem: "Time limit per item (s)",
    noSavedBuildsYet: "No saved builds yet. Create a build to get started.",
    savedBuildChanged: "Saved build changed. Search again with its updated items and stats.",
    buildNoLongerSaved: "Selected build is no longer saved. Choose another build.",
    couldNotLoadSavedBuilds: "Could not load saved builds: {e}",
    excludedFromSearch: "Excluded from search",
    notSearched: "Not searched",
    searchCancelled: "Search cancelled.",
    buildSearchComplete: "Build search complete. Costs use the selected weights.",
    searchingItemTier: "Searching {n} ({t})...",
    noMatchingRecipe: "No matching recipe found.",
    chooseSpecificItemFirst: "Choose a specific item in the editor before searching.",
    itemUnavailable: "Item unavailable.",
    alreadyHaveIt: "Already have it",
    alreadyHaveItem: "Already have {n}",
    searchFailed: "Search failed: {e}",
    searchEnginePrefix: "Search engine: {e}",
    settingsChangedResearch: "Settings changed — search again",
    sizeLimitReached: "The search reached its size limit, so a cheaper recipe may exist.",
    timeLimitReached: "The search stopped at the time limit; a longer limit may find a better recipe.",
    seasonCtx: "Season {s} · {m}",
    actionDone: "done",
    searchFirstItem: "Search for an item you want first.",
    ctxChanged: "Season or mode changed: search again for Season {s} · {m}.",
    savedToggleOn: "Saved ✓ (remove)",
    savedToggleOff: "Save",
    linkCopied: "Link copied.",
    copyAddress: "Copy the address from the address bar.",
    savedHeader: "Saved",
    openedLink: "Opened a link for Season {s} · {m} (your own setting was {os} · {om}; change it at the top).",
    addedToSaved: "Added to Saved.",
    removedFromSaved: "Removed from Saved.",
    anyRoll: "any roll",

    noMatchingStatItem: "No matching stat on this item",
    linkNamesUnknown: "This link names an item or class this version does not know.",
    nothingSavedYetDesc: "Nothing saved yet. Run a search, then press Save under the results.",
    savedTitle: "Saved",
    recompute: "Recompute",
    openInSearch: "open in search",
    remove: "remove",
    waiting: "Waiting…",
    itemNotInVersion: "This item is not in this version.",
    computingProgress: "Computing {n} of {t}…",

    opSanctify: "Sanctify × {n}",
    opReforge: "Reforge × {n}",
    opImproveWithAshes: "Improve with ashes × {n}",
    opConvert: "Convert × {n}",
    craftAndUpgrade: "Craft & upgrade {n} {item}",
    stopOnNote: "(stop on {t})",
    mysticRoll: "Mystic: roll {s}",
    mysticArrow: "Mystic: {legal} → {target}",
    asBy: "as {c}",
    withShort: "w/",

    switchThemeTitle: "Switch light / dark",
    footerThanks: "Thanks to Blizzard Entertainment for thirty years of Diablo, to jester (d3hack) for making offline seasons possible, and to Maxroll for the build guides.",
    footerQuestions: "Questions or suggestions?",
    footerFanMade: "d3recipes is a fan-made tool, not affiliated with or endorsed by Blizzard Entertainment. Diablo® III is a trademark or registered trademark of Blizzard Entertainment, Inc. Crafting-material icons depict items from the game and are © Blizzard Entertainment, Inc.; they are shown for identification only."
  },
};

// The languages the page offers: the game's own 13. English is built in above; every other language is one file, lang/<code>.js,
// loaded only when it is the one in use. `html` is the <html lang> value, `num` the number format, `fallback` a language to read
// before English when a string is missing. To add or correct a language, edit its file (see README, "Translating").
const LANGUAGES = [
  { code: "en", name: "English", html: "en", num: "en-US" },
  { code: "de", name: "Deutsch", html: "de", num: "de-DE" },
  { code: "es", name: "Español (España)", html: "es-ES", num: "es-ES" },
  { code: "es-MX", name: "Español (Latinoamérica)", html: "es-419", num: "es-MX", fallback: "es" },
  { code: "fr", name: "Français", html: "fr", num: "fr-FR" },
  { code: "it", name: "Italiano", html: "it", num: "it-IT" },
  { code: "ja", name: "日本語", html: "ja", num: "ja-JP" },
  { code: "ko", name: "한국어", html: "ko", num: "ko-KR" },
  { code: "pl", name: "Polski", html: "pl", num: "pl-PL" },
  { code: "pt-BR", name: "Português (Brasil)", html: "pt-BR", num: "pt-BR" },
  { code: "ru", name: "Русский", html: "ru", num: "ru-RU" },
  { code: "zh-CN", name: "简体中文", html: "zh-CN", num: "zh-CN" },
  { code: "zh-TW", name: "繁體中文", html: "zh-TW", num: "zh-TW" },
];
const languageEntry = (code) => LANGUAGES.find((l) => l.code === code);

// Which of our languages a browser language tag means, or null: "de-AT" is German, "zh-HK" Traditional Chinese, any Latin-American Spanish
// the Latin-American one, any Portuguese the Brazilian one.
function languageFor(tag) {
  const lower = String(tag || "").toLowerCase();
  const exact = LANGUAGES.find((l) => l.code.toLowerCase() === lower);
  if (exact) return exact.code;
  const primary = lower.split("-")[0];
  if (primary === "zh") return /(^|-)(tw|hk|mo|hant)(-|$)/.test(lower) ? "zh-TW" : "zh-CN";
  if (primary === "es") return /(^|-)(419|mx|us|ar|bo|cl|co|cr|cu|do|ec|gt|hn|ni|pa|pe|pr|py|sv|uy|ve)(-|$)/.test(lower) ? "es-MX" : "es";
  if (primary === "pt") return "pt-BR";
  const same = LANGUAGES.find((l) => l.code.toLowerCase() === primary);
  return same ? same.code : null;
}

// Saved choice first, then the browser's languages in order of preference, then English.
function initialLang() {
  try {
    const saved = localStorage.getItem("d3r-lang");
    if (saved === "zh") return "zh-CN";   // the first version of the language switch stored "zh"
    if (languageEntry(saved)) return saved;
  } catch (e) { /* storage blocked: fall through */ }
  const prefs = (navigator.languages && navigator.languages.length) ? navigator.languages : [navigator.language];
  for (const tag of prefs) {
    const code = languageFor(tag);
    if (code) return code;
  }
  return "en";
}
let currentLang = initialLang();

// The version tag this script was loaded with (?v=...), passed on to the language files so a deploy never mixes old and new.
const VERSION = (() => {
  try { const m = /\?v=([\w-]+)/.exec(document.currentScript.src); return m ? "?v=" + m[1] : ""; } catch (e) { return ""; }
})();
const languageUrl = (code) => "lang/" + code + ".js" + VERSION;

// A language's strings as one table: the game's names, the page's sentences, and the stat names (as stat_<stem>).
const tables = {};
function dictFor(code) {
  if (code === "en") return translations.en;
  if (tables[code]) return tables[code];
  const file = window.D3_LANG && window.D3_LANG[code];
  if (!file) return null;
  const d = Object.assign({}, file.game, file.text);
  for (const [k, v] of Object.entries(file.stat || {})) d["stat_" + k] = v;
  return (tables[code] = d);
}

// The first language's file is written into the page right here, so it is there before any page code runs.
if (currentLang !== "en" && typeof document !== "undefined" && typeof document.write === "function" && document.readyState === "loading") {
  document.write('<script src="' + languageUrl(currentLang) + '"><\/script>');
}

function t(key, params) {
  const entry = languageEntry(currentLang);
  let str = (dictFor(currentLang) || {})[key];
  if (!str && entry && entry.fallback) str = (dictFor(entry.fallback) || {})[key];
  str = str || translations.en[key] || key;
  if (params) {
    Object.keys(params).forEach((k) => {
      str = str.replace(new RegExp(`\\{${k}\\}`, "g"), () => String(params[k]));
    });
  }
  return str;
}

// Numbers in the format of the language in use (1,234.5 or 1.234,5 or 1 234,5).
function fmtNum(n, options) {
  const entry = languageEntry(currentLang);
  try { return Number(n).toLocaleString(entry ? entry.num : "en-US", options); } catch (e) { return Number(n).toLocaleString("en-US", options); }
}

window.t = t;
window.fmtNum = fmtNum;
window.D3_I18N = { LANGUAGES, languageFor, dictFor, initialLang, current: () => currentLang };

function applyTranslations() {
  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.getAttribute("data-i18n");
    el.textContent = t(key);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
    const key = el.getAttribute("data-i18n-placeholder");
    el.setAttribute("placeholder", t(key));
  });
  document.querySelectorAll("[data-i18n-title]").forEach(el => {
    const key = el.getAttribute("data-i18n-title");
    el.setAttribute("title", t(key));
  });
  document.querySelectorAll("[data-i18n-aria-label]").forEach(el => {
    const key = el.getAttribute("data-i18n-aria-label");
    el.setAttribute("aria-label", t(key));
  });
  const entry = languageEntry(currentLang);
  if (entry) document.documentElement.lang = entry.html;
  const menu = document.getElementById("langSelect");
  if (menu) menu.value = currentLang;
}

// Switch to another language: load its file if it is not there yet, remember the choice, redraw the page.
function setLanguage(code) {
  if (!languageEntry(code)) return;
  const finish = () => {
    currentLang = code;
    try { localStorage.setItem("d3r-lang", code); } catch (e) { /* storage blocked */ }
    applyTranslations();
    window.dispatchEvent(new CustomEvent("d3-lang-change", { detail: code }));
  };
  if (dictFor(code)) return finish();
  const script = document.createElement("script");
  script.src = languageUrl(code);
  script.onload = finish;
  script.onerror = () => applyTranslations();   // the menu goes back to the language still in use
  document.head.appendChild(script);
}

document.addEventListener("DOMContentLoaded", () => {
  // the first language's file did not load: show what is in use (English) rather than a choice that is not there
  if (!dictFor(currentLang)) currentLang = "en";
  const menu = document.getElementById("langSelect");
  if (menu) {
    LANGUAGES.forEach((l) => { const o = document.createElement("option"); o.value = l.code; o.textContent = l.name; o.lang = l.html; menu.appendChild(o); });
    menu.addEventListener("change", () => setLanguage(menu.value));
  }
  applyTranslations();
});
