// Copyright 2026 FNG. Use, modification and redistribution are permitted under the conditions in LICENSE:
// credit the source, and visibly link to the site or repository if you use its outputs in a user-facing application.
//! Tables exported by `export_data.py` (items, affix records, slot pools) in the shape the simulator reads.
use serde::Deserialize;
use std::collections::HashMap;

pub const U: u32 = 0xFFFF_FFFF;

#[derive(Deserialize)]
struct RawAffix {
    id: u32,
    label: String,
    is_skill: bool,
    is_socket: bool,
    is_legacy_socket: bool,
    base_weight: u32,
    class_weight: Vec<u32>,
    level_range: [u32; 2],
    restricted_class: u32,
    allowed_types: Vec<u32>,
    quality_mask: u32,
    tier: u32,
    upgrades_to: u32,
    fixed_group_a: u32,
    fixed_group_b: u32,
    exclusion_group: u32,
    exclusion_key: u32,
    exclusion_ids: [u32; 6],
    pick_kind: u32,
    budget_cost: i64,
    formulas: Vec<(u32, String)>,
}

#[derive(Deserialize)]
struct RawItem {
    id: u32,
    name: String,
    type_chain: Vec<u32>,
    slot_type: Option<u32>,
    armor: bool,
    #[serde(default)]
    weapon: bool,
    restricted_class: i32,
    #[serde(default)]
    set_id: u32,
    #[serde(default)]
    table_index: u32,
    #[serde(default)]
    base_weight: u32,
    #[serde(default)]
    class_weight: [u32; 7],
    fixed_slot_groups: [u32; 6],
    primary_pick_count: u32,
    secondary_pick_count: u32,
    flex_pick_count: u32,
    formulas: Vec<(u32, String)>,
    /// hardcore-only item (Ancestors' Grace): only in a slot's `hc_pools`
    #[serde(default)]
    hc_only: bool,
}

#[derive(Deserialize)]
struct RawSlot {
    name: String,
    key: u32,
    pools: HashMap<String, Vec<(usize, u32)>>,
    /// per class, the hardcore pool when it differs from `pools` (LEDGER V194)
    #[serde(default)]
    hc_pools: HashMap<String, Vec<(usize, u32)>>,
    #[serde(default)]
    cross: Vec<usize>,
}

#[derive(Deserialize)]
struct RawDoc {
    classes: Vec<String>,
    season: u32,
    slots: Vec<RawSlot>,
    items: Vec<RawItem>,
    affixes: Vec<RawAffix>,
}

/// One formula spec: the attribute it feeds and the game's formula bytecode.
pub struct Spec {
    pub attr: u32,
    pub code: Vec<u8>,
}

pub struct Affix {
    pub id: u32,
    pub label: String,
    pub weight: [u64; 7],   // base_weight * class_weight, per class
    pub lvl: [u32; 2],
    pub cls: u32,
    pub types: Vec<u32>,
    pub q: u32,
    pub tier: u32,
    pub var: u32,           // "upgrades to" this affix id (the record's own variant chain)
    pub g7c: u32,           // fixed-slot group id A
    pub g80: u32,           // fixed-slot group id B
    pub g84: u32,           // mutual-exclusion group id
    pub g88: u32,           // mutual-exclusion key (checked against another affix's exclusion_ids)
    pub xl: [u32; 6],       // exclusion_ids: other affixes' g88 this one can't coexist with
    pub kind: u32,          // pick_kind: 0 primary, 1 secondary, else flex
    pub cost: i64,          // budget_cost
    pub specs: Vec<Spec>,
    pub legacy_socket: bool,
    pub skill: bool,
    pub socket: bool,
    /// stat family: the label without its tier/quality suffix ("Dex 17" -> "Dex")
    pub stem: String,
    /// group ids (g7c / g80) this affix can fill a fixed slot for
    pub var_idx: Option<usize>,
}

pub struct Item {
    pub id: u32,
    pub name: String,
    pub chain: Vec<u32>,     // sorted
    pub sh: Option<u32>,
    pub armor: bool,
    /// weapons never roll sockets on a primal
    pub weapon: bool,
    /// a worn item (in a Ring, Amulet, Helm, Chest, Legs, Cloak or class-head pool): a primal one gets a socket when it can have one
    /// (see `Sim::picks`); off-hands (sources, shields, mojos, quivers, phylacteries) and weapons do not
    pub worn: bool,
    pub icls: Option<usize>, // class index when the item is class-restricted
    /// Convert Set Item: set-id (0 = not a set item), global item_table.csv idx (one shared
    /// index space across every slot), and the per-class weight field (base_weight * class_weight[class]) used
    /// the same way Hope of Cain's own pool-building uses it.
    pub setid: u32,
    pub idx: u32,
    pub w356: u32,
    pub cmult: [u32; 7],
    pub fixed: [u32; 6],
    pub na: u32,
    pub nb: u32,
    pub nc: u32,
    pub specs: Vec<Spec>,
    /// hardcore-only item (Ancestors' Grace): drawn by Hope of Cain on hardcore heroes only; its life-saving power is not modelled, so no route starts on it
    pub hc_only: bool,
}

pub struct Slot {
    pub name: String,
    pub key: u32,
    /// per class: (item index, pool weight) in table order
    pub pools: Vec<Vec<(usize, u32)>>,
    /// per class: the hardcore Hope of Cain pool when it differs from `pools` (empty = the same); see `Slot::pool`
    pub hc_pools: Vec<Vec<(usize, u32)>>,
    /// classes for which the pool is another class's items
    pub cross: Vec<usize>,
}

impl Slot {
    /// The Hope of Cain pool for a class: the hardcore one on a hardcore hero when this slot has one (LEDGER V194), else the common pool.
    pub fn pool(&self, class: usize, hardcore: bool) -> &Vec<(usize, u32)> {
        if hardcore && !self.hc_pools[class].is_empty() {
            &self.hc_pools[class]
        } else {
            &self.pools[class]
        }
    }
}

pub struct Data {
    pub classes: Vec<String>,
    pub season: u32,
    pub slots: Vec<Slot>,
    pub items: Vec<Item>,
    pub affixes: Vec<Affix>,
    pub group_members: HashMap<u32, Vec<usize>>,
    pub item_by_id: HashMap<u32, usize>,
    /// Convert Set Item: set-id -> member item indices, ordered by their global item_table.csv idx
    /// (the same order the verified pick rule walks). Built once here rather than scanning `items` per call.
    pub set_members: HashMap<u32, Vec<usize>>,
}

fn unhex(s: &str) -> Vec<u8> {
    let b = s.as_bytes();
    (0..b.len() / 2)
        .map(|i| {
            let h = |c: u8| (c as char).to_digit(16).unwrap_or(0) as u8;
            h(b[2 * i]) << 4 | h(b[2 * i + 1])
        })
        .collect()
}

fn specs(v: Vec<(u32, String)>) -> Vec<Spec> {
    v.into_iter().map(|(attr, h)| Spec { attr, code: unhex(&h) }).collect()
}

/// Label without prefix and without the tier / quality suffix: the game's affix families ("1xx_CriticalD IX Secondary" -> "CriticalD").
pub fn stem_of(label: &str) -> String {
    let l = ["1xx_", "21x_", "P6_", "X1_"].iter().fold(label, |l, p| l.strip_prefix(p).unwrap_or(l));
    let mut out: Vec<&str> = Vec::new();
    for t in l.split_whitespace() {
        let numeric = t.chars().all(|c| c.is_ascii_digit() || c == '.');
        let roman = !t.is_empty() && t.chars().all(|c| matches!(c, 'I' | 'V' | 'X'));
        if numeric || roman || matches!(t, "Secondary" | "Legendary" | "Fast" | "Two-Handed" | "Ancient" | "Primal") {
            break;
        }
        out.push(t);
    }
    // every socket affix ("Sockets Helm V", "Sockets XI", ...) is one family
    if out.first() == Some(&"Sockets") {
        return "Sockets".to_string();
    }
    out.join(" ")
}

impl Data {
    pub fn from_json(text: &str) -> Result<Data, String> {
        let doc: RawDoc = serde_json::from_str(text).map_err(|e| e.to_string())?;
        let mut idx: HashMap<u32, usize> = HashMap::new();
        for (i, a) in doc.affixes.iter().enumerate() {
            idx.insert(a.id, i);
        }
        let mut group_members: HashMap<u32, Vec<usize>> = HashMap::new();
        let mut affixes = Vec::with_capacity(doc.affixes.len());
        for (i, a) in doc.affixes.into_iter().enumerate() {
            let mut weight = [0u64; 7];
            for c in 0..7 {
                weight[c] = a.base_weight as u64 * a.class_weight[c] as u64;
            }
            for g in [a.fixed_group_a, a.fixed_group_b] {
                let e = group_members.entry(g).or_default();
                if e.last() != Some(&i) {
                    e.push(i);
                }
            }
            let var_idx = if a.upgrades_to == U { None } else { idx.get(&a.upgrades_to).copied() };
            affixes.push(Affix {
                id: a.id,
                stem: stem_of(&a.label),
                legacy_socket: a.is_legacy_socket,
                skill: a.is_skill,
                socket: a.is_socket,
                label: a.label,
                weight,
                lvl: a.level_range,
                cls: a.restricted_class,
                types: a.allowed_types,
                q: a.quality_mask,
                tier: a.tier,
                var: a.upgrades_to,
                g7c: a.fixed_group_a,
                g80: a.fixed_group_b,
                g84: a.exclusion_group,
                g88: a.exclusion_key,
                xl: a.exclusion_ids,
                kind: a.pick_kind,
                cost: a.budget_cost,
                specs: specs(a.formulas),
                var_idx,
            });
        }
        let mut item_by_id = HashMap::new();
        let mut items = Vec::with_capacity(doc.items.len());
        for (i, it) in doc.items.into_iter().enumerate() {
            item_by_id.insert(it.id, i);
            items.push(Item {
                id: it.id,
                name: it.name,
                chain: it.type_chain,
                sh: it.slot_type,
                armor: it.armor,
                weapon: it.weapon,
                worn: false,
                icls: if it.restricted_class >= 0 { Some(it.restricted_class as usize) } else { None },
                setid: it.set_id,
                idx: it.table_index,
                w356: it.base_weight,
                cmult: it.class_weight,
                fixed: it.fixed_slot_groups,
                na: it.primary_pick_count,
                nb: it.secondary_pick_count,
                nc: it.flex_pick_count,
                specs: specs(it.formulas),
                hc_only: it.hc_only,
            });
        }
        let slots = doc
            .slots
            .into_iter()
            .map(|s| {
                let mut pools = vec![Vec::new(); 7];
                for (k, v) in s.pools {
                    if let Ok(c) = k.parse::<usize>() {
                        if c < 7 {
                            pools[c] = v;
                        }
                    }
                }
                let mut hc_pools = vec![Vec::new(); 7];
                for (k, v) in s.hc_pools {
                    if let Ok(c) = k.parse::<usize>() {
                        if c < 7 {
                            hc_pools[c] = v;
                        }
                    }
                }
                Slot { name: s.name, key: s.key, pools, hc_pools, cross: s.cross }
            })
            .collect::<Vec<Slot>>();
        const WORN: [&str; 9] = ["Ring", "Amulet", "Helm", "Chest", "Legs", "Cloak", "SpiritStone_Monk", "VoodooMask", "WizardHat"];
        for s in slots.iter().filter(|s| WORN.contains(&s.name.as_str())) {
            for pool in s.pools.iter().chain(s.hc_pools.iter()) {
                for &(i, _) in pool {
                    items[i].worn = true;
                }
            }
        }
        let mut set_members: HashMap<u32, Vec<usize>> = HashMap::new();
        for (i, it) in items.iter().enumerate() {
            if it.setid != 0 {
                set_members.entry(it.setid).or_default().push(i);
            }
        }
        for members in set_members.values_mut() {
            members.sort_by_key(|&i| items[i].idx);
        }
        Ok(Data { classes: doc.classes, season: doc.season, slots, items, affixes, group_members, item_by_id, set_members })
    }
}
