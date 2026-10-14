// Copyright 2026 FNG. Use, modification and redistribution are permitted under the conditions in LICENSE:
// credit the source, and visibly link to the site or repository if you use its outputs in a user-facing application.
//! A primal ring or amulet that can have a socket always has it; other items (sources played) keep the ordinary roll. Played in the game (season 40 softcore, Barbarian): Squirt's Necklace from
//! Hope of Cain #29, Reforge, Improve Legendary (crafted primal with a socket), Reforge (natural primal with a socket).
use d3cube::data::Data;
use d3cube::sim::{chain_roots, Sim};
use std::rc::Rc;

fn data() -> Rc<Data> {
    let p = concat!(env!("CARGO_MANIFEST_DIR"), "/../web/data.json");
    Rc::new(Data::from_json(&std::fs::read_to_string(p).expect("web/data.json")).unwrap())
}

/// (stem, value) of every line, a socket as ("Sockets", 0)
fn lines(sim: &Sim, d: &Data, item: usize, aff: &[usize]) -> Vec<(String, f64)> {
    let mut v: Vec<(String, f64)> = sim.values_max(item, aff).iter().filter_map(|l| l.aff.map(|a| (d.affixes[a].stem.clone(), l.value))).collect();
    v.extend(aff.iter().filter(|&&a| d.affixes[a].specs.is_empty()).map(|&a| (d.affixes[a].stem.clone(), 0.0)));
    v.sort_by(|a, b| a.0.cmp(&b.0));
    v
}

fn want(v: &[(&str, f64)]) -> Vec<(String, f64)> {
    let mut v: Vec<(String, f64)> = v.iter().map(|&(s, x)| (s.to_string(), x)).collect();
    v.sort_by(|a, b| a.0.cmp(&b.0));
    v
}

#[test]
fn played_primal_necklace_has_a_socket() {
    let d = data();
    let item = d.items.iter().position(|i| i.name == "Squirt's Necklace").unwrap();
    let slot = d.slots.iter().find(|s| s.name == "Amulet").unwrap();
    let root = chain_roots(&slot.pools[1], slot.key, 40, false, 29, true, 1, &d.items).into_iter().find(|r| r.n == 29).unwrap();
    assert_eq!(root.item, item);
    let mut sim = Sim::new(d.clone(), 1, true);
    let r1 = sim.reforge(item, root.seed);
    let (crafted, seed) = sim.primalize(item, r1.child_seed);
    // played: Str 1,000, CHD 100%, Socket, Gold 80%, Life from Health Globes 38,625 (the model adds Area Damage 20%)
    let got = lines(&sim, &d, item, &crafted);
    for w in want(&[("Gold", 0.8), ("Str", 1000.0), ("CriticalD", 1.0), ("Sockets", 0.0), ("HealthGlobeBonus", 38625.0)]) {
        assert!(got.contains(&w), "crafted primal {:?} lacks {:?}", got, w);
    }
    let r3 = sim.reforge(item, seed);
    assert!(r3.primal);
    assert_eq!(
        lines(&sim, &d, item, &r3.affixes),
        want(&[("Gold", 0.8), ("Str", 1000.0), ("CriticalD", 1.0), ("Vit", 1000.0), ("ColdResist", 210.0), ("Sockets", 0.0)])
    );
}

/// Obsidian Ring of the Zodiac has no primary pick (all four primaries are fixed slots), so a primal one never has a socket.
#[test]
fn primal_zodiac_has_no_socket() {
    let d = data();
    let item = d.items.iter().position(|i| i.name == "Obsidian Ring of the Zodiac").unwrap();
    let mut sim = Sim::new(d.clone(), 0, true);
    for k in 0..50u32 {
        let (aff, _) = sim.primalize(item, k.wrapping_mul(2_654_435_761));
        assert!(!aff.iter().any(|&a| d.affixes[a].socket));
    }
}

/// Replays a played route (Hope of Cain root, then R / P / C steps) and returns the final item's stems, sorted.
fn played(class: usize, slot: &str, n: u32, hc: bool, path: &str) -> (String, Vec<String>) {
    let d = data();
    let s = d.slots.iter().find(|s| s.name == slot).unwrap();
    let r = chain_roots(&s.pools[class], s.key, 40, hc, n, true, class, &d.items).into_iter().find(|r| r.n == n).unwrap();
    let mut sim = Sim::new(d.clone(), class, true);
    let (mut item, mut seed) = (r.item, r.seed);
    let mut aff = sim.drop_item(item, r.x0, r.ancient || r.primal, r.primal);
    for op in path.chars() {
        match op {
            'R' => {
                let g = sim.reforge(item, seed);
                (seed, aff) = (g.child_seed, g.affixes);
            }
            'P' => (aff, seed) = sim.primalize(item, seed),
            _ => {
                let g = sim.convert(item, seed);
                (item, seed, aff) = (g.target, g.child_seed, g.affixes);
            }
        }
    }
    let mut stems: Vec<String> = aff.iter().map(|&a| d.affixes[a].stem.clone()).collect();
    stems.sort();
    (d.items[item].name.clone(), stems)
}

fn sorted(v: &[&str]) -> Vec<String> {
    let mut v: Vec<String> = v.iter().map(|s| s.to_string()).collect();
    v.sort();
    v
}

/// Played (LEDGER V172): season 40 softcore Witch Doctor, Ring Hope #13 (Stone of Jordan), 10 Reforges = a primal ring WITH the socket.
#[test]
fn played_primal_ring_has_a_socket() {
    let (name, stems) = played(3, "Ring", 13, false, "RRRRRRRRRR");
    assert_eq!(name, "Stone of Jordan");
    assert_eq!(stems, sorted(&["MaxMana", "Int", "DamageBonusCold", "Sockets", "Experience"]));
}

/// Played (LEDGER V170): primal SOURCES keep the ordinary roll, no forced socket. Season 40 hardcore Wizard: Source #1 (Etched Sigil)
/// R R P R R R R R; Shoulders #3 (Firebird's Pinions) C R R R C C C C R C R into Firebird's Eye.
#[test]
fn played_primal_sources_have_no_socket() {
    let (name, stems) = played(2, "Orb", 1, true, "RRPRRRRR");
    assert_eq!(name, "Etched Sigil");
    assert_eq!(stems, sorted(&["Int", "CriticalChance", "ArcanePowerOnCrit", "Skill_Wizard_ExplosiveBlast", "MaxArcanePower"]));
    let (name, stems) = played(2, "Shoulders", 3, true, "CRRRCCCCRCR");
    assert_eq!(name, "Firebird's Eye");
    assert_eq!(stems, sorted(&["Int", "CriticalChance", "ArcanePowerOnCrit", "WeaponHitChill1h", "MaxArcanePower"]));
}

/// Played (LEDGER V174): season 40 hardcore Necromancer, Helm #1 (Andariel's Visage), Improve Legendary x3, Reforge = a primal WORN item with a
/// random socket gets it forced, like jewelry (the current model without the rule gave All Res instead).
#[test]
fn played_primal_helm_has_a_socket() {
    let (name, stems) = played(6, "Helm", 1, true, "PPPR");
    assert_eq!(name, "Andariel's Visage");
    assert_eq!(stems, sorted(&["DamageBonusCold", "Int", "Haste", "Sockets"]));
}
