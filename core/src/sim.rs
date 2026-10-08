// Copyright 2026 FNG. Use, modification and redistribution are permitted under the conditions in LICENSE:
// credit the source, and visibly link to the site or repository if you use its outputs in a user-facing application.
//! Port of `reforge.py` (class Sim), the `predict.py` chain, and `research/primalize_predict.py`.  The Python is the reference: every rule
//! here must give the same answer as it (see tests/golden.rs).
use crate::data::{Data, Item, Spec, U};
use std::collections::HashMap;
use std::rc::Rc;

pub const MULT: u64 = 0x6AC690C5;
pub const COST_ATTR: u32 = 0x187;
pub const WILDCARD: u32 = 0xEA3A_D528;
pub const SEED_HI: u64 = 0x1A4;

#[inline]
pub fn step(x: u64) -> u64 {
    (x & 0xFFFF_FFFF).wrapping_mul(MULT).wrapping_add(x >> 32)
}

pub struct Rng {
    pub x: u64,
    pub n: u32,
}

impl Rng {
    pub fn new(seed: u32) -> Rng {
        Rng { x: (666u64 << 32) | seed as u64, n: 0 }
    }
    pub fn from_state(x: u64) -> Rng {
        Rng { x, n: 0 }
    }
    #[inline]
    pub fn draw(&mut self) -> u32 {
        self.x = step(self.x);
        self.n += 1;
        self.x as u32
    }
    pub fn lo(&self) -> u32 {
        self.x as u32
    }
}

/// Python's `a % b` for integers (sign of the divisor).
fn pymod(a: i64, b: i64) -> i64 {
    if b == 0 {
        return 0;
    }
    ((a % b) + b) % b
}

/// The game's formula bytecode.  `rng == None` evaluates RandomInt at its upper bound (a primal roll).
pub fn eval_formula(code: &[u8], mut rng: Option<&mut Rng>) -> f64 {
    let mut st: Vec<f64> = Vec::with_capacity(8);
    let mut i = 0;
    while i < code.len() {
        let op = code[i];
        if op == 0 {
            break;
        }
        match op {
            5 => {
                // 5-word attribute lookup (only in offhand item powers): value not modelled, the RandomInt below still draws
                st.push(f64::NAN);
                i += 32;
            }
            6 => st.push(f32::from_le_bytes([code[i + 4], code[i + 5], code[i + 6], code[i + 7]]) as f64),
            1 => {
                let fi = code[i + 4];
                if fi == 4 {
                    let hi = st.pop().unwrap_or(0.0);
                    let lo = st.pop().unwrap_or(0.0);
                    if hi.is_nan() || lo.is_nan() {
                        if let Some(r) = rng.as_deref_mut() {
                            r.draw();
                        }
                        st.push(f64::NAN);
                    } else {
                        match rng.as_deref_mut() {
                            Some(r) => st.push((lo as i64 + pymod(r.draw() as i64, hi as i64 - lo as i64 + 1)) as f64),
                            None => st.push(hi.trunc()),
                        }
                    }
                } else if fi == 0 || fi == 1 {
                    let y = st.pop().unwrap_or(0.0);
                    let x = st.pop().unwrap_or(0.0);
                    st.push(if fi == 0 {
                        if y < x { y } else { x }
                    } else if y > x {
                        y
                    } else {
                        x
                    });
                } else if fi == 11 {
                    // wraps the attribute lookup: unchanged
                } else {
                    return f64::NAN;
                }
            }
            0xB => {
                let y = st.pop().unwrap_or(0.0);
                let x = st.pop().unwrap_or(0.0);
                st.push(x + y)
            }
            0xC => {
                let y = st.pop().unwrap_or(0.0);
                let x = st.pop().unwrap_or(0.0);
                st.push(x - y)
            }
            0xD => {
                let y = st.pop().unwrap_or(0.0);
                let x = st.pop().unwrap_or(0.0);
                st.push(x * y)
            }
            0xE => {
                let y = st.pop().unwrap_or(0.0);
                let x = st.pop().unwrap_or(0.0);
                st.push(x / y)
            }
            0x10 => {
                let x = st.pop().unwrap_or(0.0);
                st.push(-x)
            }
            _ => return f64::NAN,
        }
        i += 8;
    }
    st.last().copied().unwrap_or(0.0)
}

/// (float)r * 2^-32 rounded to single precision, as the game computes it for the chain (predict.unit)
pub fn unit_f32(r: u32) -> f32 {
    (r as f32) * 2.0f32.powi(-32)
}

pub const ANCIENT_CHANCE: f64 = 0.1;
pub const PRIMAL_CHANCE: f64 = 0.025;

pub struct Reforged {
    pub affixes: Vec<usize>,
    pub child_seed: u32,
    pub ancient: bool,
    pub primal: bool,
}

/// Result of a Convert Set Item: a DIFFERENT item id than the source, always non-Ancient.
pub struct Converted {
    pub target: usize,
    pub affixes: Vec<usize>,
    pub child_seed: u32,
}

/// One rolled line of an item tooltip: `aff` = affix index (None = the item's own power), attr id, value.
pub struct Line {
    pub aff: Option<usize>,
    pub attr: u32,
    pub value: f64,
}

struct BaseElig {
    list: Vec<usize>,
}

/// Does an affix with these item types fit the item? Skill-damage affixes used to check only {slot_hash, item.own}
/// (chain[0]), never the item's full ancestor chain -- missed inheritance (Cloak's chain includes ChestArmor,
/// and the real skill-affix records allow ChestArmor but not Cloak directly, so e.g. Fan of Knives silently
/// never became a candidate on Cloak items). Fixed to use the SAME full-chain check as every other affix
/// category, matching the Python fix exactly (one code path, no `a.skill` special case).
fn fits(item: &Item, types: &[u32], wild: bool) -> bool {
    types.iter().any(|&t| (wild && t == WILDCARD) || item.chain.binary_search(&t).is_ok() || item.sh == Some(t))
}

pub struct Sim {
    pub d: Rc<Data>,
    pub hero: usize,
    pub eligible: bool,
    pub ilvl: u32,
    pub quality: u32,
    pub(crate) cls: usize,
    /// primal weapons never roll a socket (set by `primalize` for weapons)
    ban_sockets: bool,
    base: HashMap<(usize, usize, bool), Rc<BaseElig>>,
    twins: HashMap<usize, [usize; 7]>,
    /// a primal worn item is being rolled: if it can have a socket, its first primary pick lands it (see `picks`). Played: a Squirt's
    /// Necklace, a Stone of Jordan (natural and crafted) and an Andariel's Visage got it; two primal sources (Etched Sigil, Firebird's Eye)
    /// did not (LEDGER V170-V174); off-hands keep the ordinary roll
    force_socket: bool,
}

impl Sim {
    pub fn new(d: Rc<Data>, hero: usize, eligible: bool) -> Sim {
        Sim { d, hero, eligible, ilvl: 70, quality: 9, cls: hero, ban_sockets: false, base: HashMap::new(), twins: HashMap::new(), force_socket: false }
    }

    pub(crate) fn set_class(&mut self, it: &Item) {
        self.cls = it.icls.unwrap_or(self.hero);
    }

    fn excluded(&self, cand: usize, existing: &[usize]) -> bool {
        let c = &self.d.affixes[cand];
        if self.ban_sockets && c.socket {
            return true;
        }
        for &ex in existing {
            let e = &self.d.affixes[ex];
            let mut hit = if c.g7c == U { false } else { c.g7c == e.g7c || c.g7c == e.g80 };
            if c.g80 != U && (c.g80 == e.g80 || c.g80 == e.g7c) {
                hit = true;
            }
            if c.g84 == U {
                if hit {
                    return true;
                }
            } else if hit || (e.g84 != U && c.g84 != e.g84) {
                return true;
            }
        }
        false
    }

    pub(crate) fn eligible_base(&self, item: &Item, ai: usize, skip_level: bool, skip_quality: bool, wild: bool) -> bool {
        let a = &self.d.affixes[ai];
        if a.legacy_socket || (self.ban_sockets && a.socket) {
            return false;
        }
        if !skip_level && !(a.lvl[0] <= self.ilvl && self.ilvl <= a.lvl[1]) {
            return false;
        }
        if a.cls != U && a.cls as usize != self.cls {
            return false;
        }
        if !fits(item, a.types.as_slice(), wild) {
            return false;
        }
        if !skip_quality && (a.q >> self.quality) & 1 == 0 {
            return false;
        }
        a.weight[self.cls] >= 1
    }

    /// For each class, the first class that rolls this item exactly like it (itself when none does). The class only
    /// enters a Reforge or Improve Legendary through which affixes it may take and their weights, so two classes giving
    /// the same weight to every affix the item can draw roll the same item (Barbarian and Crusader on most rings).
    /// The affixes compared are the base picks' candidates (eligible_base without its class part) plus every member of
    /// the item's fixed-slot groups, whatever its type, as resolve_slot's last pass takes them: a superset of what a
    /// roll can meet, so classes are never merged by mistake. Not for Convert, which also weighs the target items by class.
    pub fn class_twins(&mut self, item_idx: usize) -> [usize; 7] {
        if let Some(t) = self.twins.get(&item_idx) {
            return *t;
        }
        let item = &self.d.items[item_idx];
        let groups: Vec<u32> = item.fixed.iter().copied().filter(|&g| g != U).collect();
        let fit: Vec<usize> = (0..self.d.affixes.len())
            .filter(|&ai| {
                let a = &self.d.affixes[ai];
                let base = !a.legacy_socket
                    && a.lvl[0] <= self.ilvl
                    && self.ilvl <= a.lvl[1]
                    && fits(item, a.types.as_slice(), false)
                    && (a.q >> self.quality) & 1 == 1;
                base || (a.tier <= self.ilvl && groups.iter().any(|&g| a.g7c == g || a.g80 == g))
            })
            .collect();
        let sig = |c: usize| -> Vec<u64> {
            fit.iter().map(|&ai| { let a = &self.d.affixes[ai]; if a.cls != U && a.cls as usize != c { 0 } else { a.weight[c] } }).collect()
        };
        let sigs: Vec<Vec<u64>> = (0..7).map(sig).collect();
        let mut t = [0usize; 7];
        for c in 0..7 {
            t[c] = (0..=c).find(|&b| sigs[b] == sigs[c]).unwrap();
        }
        self.twins.insert(item_idx, t);
        t
    }

    #[inline]
    fn weight(&self, ai: usize) -> u64 {
        self.d.affixes[ai].weight[self.cls]
    }

    fn variant(&self, mut ai: usize, swaps: u32) -> usize {
        for _ in 0..swaps {
            match self.d.affixes[ai].var_idx {
                Some(n) => ai = n,
                None => break,
            }
        }
        ai
    }

    fn add_affix(&self, existing: &mut Vec<usize>, ai: usize) -> bool {
        if !self.fits(existing, ai) {
            return false;
        }
        existing.push(ai);
        true
    }

    /// The exclusion-key and budget rules of `add_affix`, without adding.
    fn fits(&self, existing: &[usize], ai: usize) -> bool {
        if existing.len() >= 6 {
            return false;
        }
        let new = &self.d.affixes[ai];
        let mut total = new.cost;
        for &ex in existing.iter() {
            let e = &self.d.affixes[ex];
            total += e.cost;
            let (n88, e88) = (new.g88, e.g88);
            if n88 == U {
                if e88 != U && new.xl.contains(&e88) {
                    return false;
                }
            } else if e.xl.contains(&n88) || (e88 != U && new.xl.contains(&e88)) {
                return false;
            }
        }
        total < 4
    }

    /// Mystic: positions in `aff` whose line can be swapped for a stat of one of `fams` (stems, lower case) by the same rules a roll
    /// obeys: some affix of that stat that this item can roll must pass `excluded` and `fits` against the item's other lines.
    /// `same_kind`: the new stat must also be the same kind (primary / secondary, from the data) as the line it replaces.
    /// `cls`: the class of the hero at the Mystic, which offers what that class can roll (a Necromancer never gets Lightning damage).
    pub fn mystic_swaps(&mut self, item_idx: usize, aff: &[usize], fams: &[String], same_kind: bool, cls: usize) -> Vec<usize> {
        let hero = self.hero;
        self.hero = cls;
        let targets: Vec<usize> =
            self.candidate_affixes(item_idx).into_iter().filter(|&t| fams.iter().any(|f| self.d.affixes[t].stem.to_lowercase() == *f)).collect();
        self.hero = hero;
        let mut out = Vec::new();
        let mut rest = Vec::with_capacity(aff.len());
        for pos in 0..aff.len() {
            rest.clear();
            rest.extend(aff.iter().enumerate().filter(|&(i, _)| i != pos).map(|(_, &a)| a));
            let kind = self.d.affixes[aff[pos]].kind;
            if targets.iter().any(|&t| (!same_kind || self.d.affixes[t].kind == kind) && !self.excluded(t, &rest) && self.fits(&rest, t)) {
                out.push(pos);
            }
        }
        out
    }

    fn resolve_slot(&self, item: &Item, gid: u32, existing: &[usize], rng: &mut Rng, swaps: u32) -> Option<usize> {
        let members = self.d.group_members.get(&gid)?;
        for wild in 0..3 {
            let mut best: Option<u32> = None;
            let mut tied: Vec<usize> = Vec::new();
            for &ai in members {
                let a = &self.d.affixes[ai];
                if !(a.g7c == gid || a.g80 == gid) {
                    continue;
                }
                let ok = if wild == 2 {
                    !((a.cls != U && a.cls as usize != self.cls) || a.weight[self.cls] < 1 || self.excluded(ai, existing))
                } else {
                    self.eligible_base(item, ai, true, true, wild == 1) && !self.excluded(ai, existing)
                };
                if !ok || a.tier > self.ilvl {
                    continue;
                }
                match best {
                    Some(b) if a.tier < b => {}
                    Some(b) if a.tier == b => tied.push(ai),
                    _ => {
                        best = Some(a.tier);
                        tied.clear();
                        tied.push(ai);
                    }
                }
            }
            if !tied.is_empty() {
                let pick = if tied.len() > 1 { tied[(rng.draw() as usize) % tied.len()] } else { tied[0] };
                return Some(self.variant(pick, swaps));
            }
        }
        None
    }

    fn base_list(&mut self, item_idx: usize) -> Rc<BaseElig> {
        let key = (item_idx, self.cls, self.ban_sockets);
        if let Some(b) = self.base.get(&key) {
            return b.clone();
        }
        let d = self.d.clone();
        let item = &d.items[item_idx];
        let list: Vec<usize> = (0..d.affixes.len()).filter(|&ai| self.eligible_base(item, ai, false, false, false)).collect();
        let b = Rc::new(BaseElig { list });
        self.base.insert(key, b.clone());
        b
    }

    fn fixed_slots(&self, item: &Item, rng: &mut Rng, swaps: u32, existing: &mut Vec<usize>) -> usize {
        let mut unresolved = 0;
        for i in 0..6 {
            let gid = item.fixed[i];
            if gid == U {
                continue;
            }
            if let Some(ai) = self.resolve_slot(item, gid, existing, rng, swaps) {
                self.add_affix(existing, ai);
            } else {
                unresolved += 1;
            }
        }
        unresolved
    }

    /// weighted primary/secondary picks; `converge` = Improve Legendary (follow the variant chain to its end)
    fn picks(&mut self, item_idx: usize, rng: &mut Rng, swaps: u32, converge: bool, lead_primary: usize, existing: &mut Vec<usize>) {
        let d = self.d.clone();
        let item = &d.items[item_idx];
        let (a, b, c) = (item.na as usize, item.nb as usize, item.nc as usize);
        let n = (lead_primary + a + b + c).min(6usize.saturating_sub(existing.len()));
        let base = self.base_list(item_idx);
        let mut kinds: Vec<Option<u32>> = Vec::with_capacity(lead_primary + a + b + c);
        kinds.extend(std::iter::repeat(Some(0)).take(lead_primary));
        kinds.extend(std::iter::repeat(Some(0)).take(a));
        kinds.extend(std::iter::repeat(Some(1)).take(b));
        kinds.extend(std::iter::repeat(None).take(c));
        kinds.truncate(n);
        let mut cands: Vec<usize> = Vec::with_capacity(256);
        // A primal worn item that can have a socket always has it (played: a Squirt's Necklace, a Stone of Jordan and an Andariel's
        // Visage; primal sources did not, see `force_socket`). The first primary pick still makes its draw, but what it
        // lands is the item's highest socket affix, past the affix budget; the later picks then see it on the item.
        // Nothing changes when a fixed slot already gave a socket, or when the item has no primary pick at all (Ring of the
        // Zodiac, whose primaries are all fixed, never has one).
        let mut socket = None;
        if self.force_socket && !existing.iter().any(|&e| d.affixes[e].socket) {
            socket = (0..d.affixes.len())
                .filter(|&ai| {
                    // by the item's own types, never the wildcard (which every socket affix lists, gloves included)
                    let a = &d.affixes[ai];
                    a.socket && !a.legacy_socket && a.kind == 0 && a.tier <= self.ilvl && fits(item, a.types.as_slice(), false)
                })
                .max_by_key(|&ai| d.affixes[ai].tier);
        }
        for kind in kinds {
            cands.clear();
            for &ai in base.list.iter() {
                if let Some(k) = kind {
                    if d.affixes[ai].kind != k {
                        continue;
                    }
                }
                if !self.excluded(ai, existing) {
                    cands.push(ai);
                }
            }
            if cands.is_empty() {
                continue;
            }
            let total: u64 = cands.iter().map(|&x| self.weight(x)).sum();
            let v = rng.draw() as u64 % total;
            let mut acc = 0u64;
            let mut pick = *cands.last().unwrap();
            for &x in cands.iter() {
                acc += self.weight(x);
                if v < acc {
                    pick = x;
                    break;
                }
            }
            if kind == Some(0) {
                if let Some(sk) = socket.take() {
                    existing.push(sk);
                    continue;
                }
            }
            let fin = if converge {
                let mut p = pick;
                loop {
                    let nv = self.variant(p, 1);
                    if nv == p {
                        break p;
                    }
                    p = nv;
                }
            } else {
                self.variant(pick, swaps)
            };
            self.add_affix(existing, fin);
        }
    }

    /// Every affix that can appear on the item for the hero's class (primary/secondary pool plus the fixed-slot groups), for the UI's stat list.
    pub fn candidate_affixes(&mut self, item_idx: usize) -> Vec<usize> {
        let d = self.d.clone();
        let item = &d.items[item_idx];
        self.set_class(item);
        let mut out: Vec<usize> = self.base_list(item_idx).list.clone();
        for &gid in item.fixed.iter().filter(|&&g| g != U) {
            if let Some(members) = d.group_members.get(&gid) {
                for &ai in members {
                    if self.eligible_base(item, ai, true, true, true) {
                        out.push(ai);
                    }
                }
                // resolve_slot's last pass ignores the item type, but only when no member fits it (a Stone of Jordan's
                // maximum-resource slot holds only affixes typed for other items), so the class's members join then.
                if !members.iter().any(|&ai| self.eligible_base(item, ai, true, true, true) && d.affixes[ai].tier <= self.ilvl) {
                    let last: Vec<usize> = members.iter().copied().filter(|&ai| {
                        let a = &d.affixes[ai];
                        (a.g7c == gid || a.g80 == gid) && a.tier <= self.ilvl && !(a.cls != U && a.cls as usize != self.cls) && a.weight[self.cls] >= 1
                    }).collect();
                    // only the highest tier is ever taken (a Mana jewel's line is tier 1)
                    let top = last.iter().map(|&ai| d.affixes[ai].tier).max();
                    out.extend(last.into_iter().filter(|&ai| Some(d.affixes[ai].tier) == top));
                }
            }
        }
        out.sort_unstable();
        out.dedup();
        out
    }

    /// What a Reforge of (item, seed) produces (reforge.py Sim.reforge).
    pub fn reforge(&mut self, item_idx: usize, seed: u32) -> Reforged {
        let d = self.d.clone();
        let item = &d.items[item_idx];
        self.set_class(item);
        let extra = if matches!(item.icls, Some(c) if c != self.hero) { 1 } else { 0 };
        let mut rng = Rng::new(seed);
        let unit = |r: u32| r as f64 * 2.0f64.powi(-32);
        let ancient = unit(rng.draw()) <= ANCIENT_CHANCE;
        let primal = ancient && self.eligible && unit(rng.draw()) <= PRIMAL_CHANCE;
        let swaps = if ancient || primal { 2 } else { 1 };
        for _ in 0..extra {
            rng.draw();
        }
        // a primal weapon never rolls a socket; a fixed slot left unresolved by that is replaced by one primary pick made first
        let weapon_primal = primal && item.weapon;
        self.ban_sockets = weapon_primal;
        let mut existing = Vec::with_capacity(6);
        let unresolved = self.fixed_slots(item, &mut rng, swaps, &mut existing);
        rng.draw(); // discarded draw (legendary)
        let lead = if weapon_primal { unresolved } else { 0 };
        self.force_socket = primal && item.worn;
        self.picks(item_idx, &mut rng, swaps, false, lead, &mut existing);
        self.force_socket = false;
        self.ban_sockets = false;
        Reforged { affixes: existing, child_seed: rng.lo(), ancient, primal }
    }

    /// Affixes of a Hope of Cain item (reforge.py Sim.drop): the builder on the full 64-bit chain state.
    /// `ancient` is true for an ancient or primal drop; `primal` for a primal one (which gets all its sockets).
    pub fn drop_item(&mut self, item_idx: usize, x0: u64, ancient: bool, primal: bool) -> Vec<usize> {
        let d = self.d.clone();
        let item = &d.items[item_idx];
        self.set_class(item);
        let swaps = if ancient { 2 } else { 1 };
        let mut rng = Rng::from_state(x0);
        let mut existing = Vec::with_capacity(6);
        self.fixed_slots(item, &mut rng, swaps, &mut existing);
        rng.draw();
        self.force_socket = primal && item.worn;
        self.picks(item_idx, &mut rng, swaps, false, 0, &mut existing);
        self.force_socket = false;
        existing
    }

    /// Every item sharing item_idx's set, in item_table.csv idx order, INCLUDING item_idx itself
    /// (empty if item_idx is not a set item, or the item's set data is missing). Port of reforge.py Sim.set_pool.
    pub fn set_pool(&self, item_idx: usize) -> Vec<usize> {
        let setid = self.d.items[item_idx].setid;
        if setid == 0 {
            return Vec::new();
        }
        self.d.set_members.get(&setid).cloned().unwrap_or_default()
    }

    /// Convert Set Item: pool = set-mates minus the source, weighted by w356*cmult[class] (the
    /// SAME field Hope of Cain uses), one MWC step past the Reforge-family start point (x0) picks the target; that
    /// SAME x0 seeds the target's stat generation (drop_item, unmodified) and becomes its own future seed (lo(x0),
    /// the same pattern Hope of Cain uses for its own drops). A hero of another class than a class item's spends one extra
    /// draw after the pick, as Hope of Cain does (chain_roots), and the item is built from and seeded by the state after it
    /// (played: a Demon Hunter converting a Crusader's Spaulders of Valor). Caller must check `set_pool(item_idx).len() > 2`
    /// first (the recipe is unavailable on 2-piece sets) -- panics on an empty pool otherwise.
    pub fn convert(&mut self, item_idx: usize, seed: u32) -> Converted {
        let d = self.d.clone();
        let item = &d.items[item_idx];
        self.set_class(item);
        let pool: Vec<usize> = self.set_pool(item_idx).into_iter().filter(|&i| i != item_idx).collect();
        let weights: Vec<u64> = pool.iter().map(|&i| d.items[i].w356 as u64 * d.items[i].cmult[self.cls] as u64).collect();
        let total: u64 = weights.iter().sum();
        let x0 = step((666u64 << 32) | seed as u64);
        let v = (x0 as u32) as u64 % total;
        let mut acc = 0u64;
        let mut target = *pool.last().expect("convert() called on an item with no set-mates (check set_pool().len() > 2 first)");
        for (&cand, &w) in pool.iter().zip(weights.iter()) {
            acc += w;
            if v < acc {
                target = cand;
                break;
            }
        }
        let x0 = if matches!(item.icls, Some(c) if c != self.hero) { step(x0) } else { x0 };
        let affixes = self.drop_item(target, x0, false, false);
        Converted { target, affixes, child_seed: x0 as u32 }
    }

    /// Improve Legendary (primalize_predict.primalize, MODEL B): returns (affixes, child seed).
    pub fn primalize(&mut self, item_idx: usize, seed: u32) -> (Vec<usize>, u32) {
        let d = self.d.clone();
        let item = &d.items[item_idx];
        self.set_class(item);
        // on weapons no socket is ever offered, and an unresolved fixed slot (the socket group) is replaced by one primary pick made first
        self.ban_sockets = item.weapon;
        let mut rng = Rng::new(seed);
        let mut existing = Vec::with_capacity(6);
        let unresolved = self.fixed_slots(item, &mut rng, 2, &mut existing);
        rng.draw(); // one extra draw before the picks
        let lead = if item.weapon { unresolved } else { 0 };
        self.force_socket = item.worn;
        self.picks(item_idx, &mut rng, 2, true, lead, &mut existing);
        self.force_socket = false;
        self.ban_sockets = false;
        (existing, rng.lo())
    }

    /// The rolled numbers in game order (reforge.py Sim.values); the cost pseudo-attribute is not in the specs.
    pub fn values(&self, item_idx: usize, seed: u32, affixes: &[usize]) -> Vec<Line> {
        let item = &self.d.items[item_idx];
        let mut x = step((666u64 << 32) | seed as u64);
        if item.armor {
            x = step(x);
        }
        let mut rng = Rng::new(x as u32);
        let mut out = Vec::new();
        for s in &item.specs {
            out.push(Line { aff: None, attr: s.attr, value: eval_formula(&s.code, Some(&mut rng)) });
        }
        for &ai in affixes {
            for s in &self.d.affixes[ai].specs {
                out.push(Line { aff: Some(ai), attr: s.attr, value: eval_formula(&s.code, Some(&mut rng)) });
            }
        }
        out
    }

    /// Every value at its maximum (a primal / Improve Legendary tooltip).
    pub fn values_max(&self, item_idx: usize, affixes: &[usize]) -> Vec<Line> {
        let item = &self.d.items[item_idx];
        let mut out = Vec::new();
        let mk = |s: &Spec, aff: Option<usize>| Line { aff, attr: s.attr, value: eval_formula(&s.code, None) };
        for s in &item.specs {
            out.push(mk(s, None));
        }
        for &ai in affixes {
            for s in &self.d.affixes[ai].specs {
                out.push(mk(s, Some(ai)));
            }
        }
        out
    }
}

pub struct ChainRoot {
    pub n: u32,
    pub item: usize,
    pub ancient: bool,
    pub primal: bool,
    pub seed: u32,
    pub x0: u64,
}

pub fn first_seed(key: u32, season: u32, hardcore: bool) -> u64 {
    let mut lo = key.wrapping_add(season);
    if hardcore {
        lo ^= 0xFFFF_FFFF;
    }
    (SEED_HI << 32) | lo as u64
}

/// Hope of Cain results 1..=n_max of a slot pool (predict.py sequence + plan.chain_roots).
pub fn chain_roots(pool: &[(usize, u32)], key: u32, season: u32, hardcore: bool, n_max: u32, eligible: bool, hero: usize, items: &[Item]) -> Vec<ChainRoot> {
    let total: u64 = pool.iter().map(|p| p.1 as u64).sum();
    if total == 0 {
        return Vec::new();
    }
    let mut st = vec![first_seed(key, season, hardcore)];
    for _ in 0..n_max + 6 {
        let l = *st.last().unwrap();
        st.push(step(l));
    }
    let anc_t = 0.1f32;
    let pri_t = 0.025f32;
    let mut out = Vec::new();
    for n in 1..=n_max as usize {
        let v = (st[n + 1] as u32) as u64 % total;
        let mut acc = 0u64;
        let mut pick = pool.last().unwrap().0;
        for &(item, w) in pool {
            acc += w as u64;
            if v < acc {
                pick = item;
                break;
            }
        }
        // an item of another class than the hero's (a Wizard transmuting a Demon Hunter quiver) costs one extra draw after the pick
        let sh = if matches!(items[pick].icls, Some(c) if c != hero) { 1 } else { 0 };
        // the ancient (n+2) and primal (n+3) rolls come first; the mismatch draw follows them, then the seed (V110)
        let (dd, ee) = (st[n + 2] as u32, st[n + 3] as u32);
        let ancient = unit_f32(dd) <= anc_t;
        let primal = ancient && eligible && unit_f32(ee) <= pri_t;
        out.push(ChainRoot {
            n: n as u32,
            item: pick,
            ancient,
            primal,
            seed: st[n + if ancient { 3 } else { 2 } + sh] as u32,
            x0: st[n + if ancient { 3 } else { 2 } + sh],
        });
    }
    out
}
