// Copyright 2026 FNG. Use, modification and redistribution are permitted under the conditions in LICENSE:
// credit the source, and visibly link to the site or repository if you use its outputs in a user-facing application.
//! Replays the Python model's test vectors (tools/webapp/golden.py) against the Rust port; every field must match exactly.
use d3cube::data::Data;
use d3cube::sim::{chain_roots, Sim};
use serde_json::Value;
use std::rc::Rc;

fn load() -> (Rc<Data>, Value) {
    let dir = concat!(env!("CARGO_MANIFEST_DIR"), "/..");
    let data = std::fs::read_to_string(format!("{}/web/data.json", dir)).expect("web/data.json (run export_data.py)");
    let gold = std::fs::read_to_string(format!("{}/testdata/golden.json", dir))
        .or_else(|_| std::fs::read_to_string(format!("{}/golden.json", dir)))
        .expect("golden.json (run golden.py)");
    (Rc::new(Data::from_json(&data).unwrap()), serde_json::from_str(&gold).unwrap())
}

fn u(v: &Value) -> u64 {
    v.as_u64().unwrap()
}

fn ids(d: &Data, a: &[usize]) -> Vec<u64> {
    a.iter().map(|&i| d.affixes[i].id as u64).collect()
}

fn vals(v: &Value) -> Vec<f64> {
    v.as_array().unwrap().iter().map(|x| x.as_f64().unwrap_or(f64::NAN)).collect()
}

fn same(a: &[f64], b: &[f64]) -> bool {
    a.len() == b.len() && a.iter().zip(b).all(|(x, y)| x == y || (x.is_nan() && y.is_nan()))
}

/// The one place the Rust port knowingly differs from the Python vectors: a primal worn item that can have a socket
/// always has it, landed by its first primary pick (played in the game; see Sim::picks). The Python model left
/// many without, or rolled them on a later pick, so the picks after the first differ. Where such an item does not match,
/// only the draws can still be compared: the child seed (and ancient/primal) must match, and the result must carry the
/// socket. Every other case must match exactly.
fn socket_rule(d: &Data, item: usize) -> bool {
    d.items[item].worn && d.items[item].na > 0
}

fn has_socket(d: &Data, a: &[usize]) -> bool {
    a.iter().any(|&i| d.affixes[i].socket)
}

#[test]
fn chains() {
    let (d, g) = load();
    let mut n = 0;
    for c in g["chain"].as_array().unwrap() {
        let slot = d.slots.iter().find(|s| s.name == c["slot"].as_str().unwrap()).unwrap();
        let cls = u(&c["cls"]) as usize;
        let roots = chain_roots(&slot.pools[cls], u(&c["key"]) as u32, u(&c["season"]) as u32, c["hc"].as_bool().unwrap(), 40, c["eligible"].as_bool().unwrap(), cls, &d.items);
        let want = c["roots"].as_array().unwrap();
        assert_eq!(roots.len(), want.len());
        for (r, w) in roots.iter().zip(want) {
            assert_eq!(d.items[r.item].id as u64, u(&w["item"]), "{} cls {} n {}", slot.name, cls, r.n);
            assert_eq!(r.ancient, w["ancient"].as_bool().unwrap());
            assert_eq!(r.primal, w["primal"].as_bool().unwrap());
            assert_eq!(r.seed as u64, u(&w["seed"]));
            assert_eq!(r.x0, u(&w["x0"]));
            n += 1;
        }
    }
    println!("chain roots checked: {}", n);
}

#[test]
fn reforges() {
    let (d, g) = load();
    let mut ruled = 0;
    let mut fails = 0;
    let mut n = 0;
    for e in g["reforge"].as_array().unwrap() {
        let cls = u(&e["cls"]) as usize;
        let mut sim = Sim::new(d.clone(), cls, e["eligible"].as_bool().unwrap());
        let item = d.item_by_id[&(u(&e["item"]) as u32)];
        let r = sim.reforge(item, u(&e["seed"]) as u32);
        let want_aff: Vec<u64> = e["affixes"].as_array().unwrap().iter().map(u).collect();
        let draws = r.child_seed as u64 == u(&e["child"]) && r.ancient == e["ancient"].as_bool().unwrap() && r.primal == e["primal"].as_bool().unwrap();
        if r.primal && socket_rule(&d, item) && ids(&d, &r.affixes) != want_aff {
            assert!(draws && has_socket(&d, &r.affixes), "socket rule: reforge item {:08x} seed {:08x}", u(&e["item"]), u(&e["seed"]));
            ruled += 1;
            n += 1;
            continue;
        }
        let mut ok = ids(&d, &r.affixes) == want_aff && draws;
        if ok {
            let lines: Vec<f64> = if r.primal {
                sim.values_max(item, &r.affixes).iter().map(|l| l.value).collect()
            } else {
                sim.values(item, r.child_seed, &r.affixes).iter().map(|l| l.value).collect()
            };
            let want = if r.primal { vals(&e["values_max"]) } else { vals(&e["values"]) };
            ok = same(&lines, &want);
        }
        if !ok {
            fails += 1;
            if fails <= 5 {
                println!("  child got {:08x} want {:08x}; anc {} {} prim {} {}", r.child_seed, u(&e["child"]), r.ancient, e["ancient"], r.primal, e["primal"]);
                println!("  values got {:?}
  values want {:?}", sim.values(item, r.child_seed, &r.affixes).iter().map(|l| l.value).collect::<Vec<_>>(), e["values"]);
                println!("MISMATCH reforge item {:08x} cls {} seed {:08x}: got {:?} want {:?}", u(&e["item"]), cls, u(&e["seed"]), ids(&d, &r.affixes), want_aff);
            }
        }
        n += 1;
    }
    println!("reforges checked: {}, mismatches {}, socket rule {}", n, fails, ruled);
    assert_eq!(fails, 0);
}

#[test]
fn drops() {
    let (d, g) = load();
    let mut fails = 0;
    let mut n = 0;
    for e in g["drop"].as_array().unwrap() {
        let cls = u(&e["cls"]) as usize;
        let mut sim = Sim::new(d.clone(), cls, true);
        let item = d.item_by_id[&(u(&e["item"]) as u32)];
        let x0 = u(&e["x0"]);
        let ex = sim.drop_item(item, x0, e["ancient"].as_bool().unwrap(), false);
        let want: Vec<u64> = e["affixes"].as_array().unwrap().iter().map(u).collect();
        let lines: Vec<f64> = sim.values(item, x0 as u32, &ex).iter().map(|l| l.value).collect();
        if ids(&d, &ex) != want || !same(&lines, &vals(&e["values"])) {
            fails += 1;
            if fails <= 5 {
                println!("  values got {:?}
  values want {:?}", lines, vals(&e["values"]));
                println!("MISMATCH drop item {:08x} cls {}: got {:?} want {:?}", u(&e["item"]), cls, ids(&d, &ex), want);
            }
        }
        n += 1;
    }
    println!("drops checked: {}, mismatches {}", n, fails);
    assert_eq!(fails, 0);
}

#[test]
fn converts() {
    let (d, g) = load();
    let mut fails = 0;
    let mut n = 0;
    for e in g["convert"].as_array().unwrap() {
        let item = d.item_by_id[&(u(&e["item"]) as u32)];
        // The Python model ignored the hero's class on a class item; the game spends one extra draw when it differs (see
        // switch.rs played_cross_class_convert), so those vectors are replayed as the item's own class, which is what they computed.
        let cls = d.items[item].icls.unwrap_or(u(&e["cls"]) as usize);
        let mut sim = Sim::new(d.clone(), cls, true);
        let g_ = sim.convert(item, u(&e["seed"]) as u32);
        let want: Vec<u64> = e["affixes"].as_array().unwrap().iter().map(u).collect();
        let want_target = u(&e["target"]);
        let lines: Vec<f64> = sim.values(g_.target, g_.child_seed, &g_.affixes).iter().map(|l| l.value).collect();
        let ok = d.items[g_.target].id as u64 == want_target && ids(&d, &g_.affixes) == want && g_.child_seed as u64 == u(&e["child"])
            && same(&lines, &vals(&e["values"]));
        if !ok {
            fails += 1;
            if fails <= 5 {
                println!(
                    "MISMATCH convert item {:08x} cls {} seed {:08x}: target got {:08x} want {:08x}",
                    u(&e["item"]), cls, u(&e["seed"]), d.items[g_.target].id, want_target
                );
            }
        }
        n += 1;
    }
    println!("converts checked: {}, mismatches {}", n, fails);
    assert_eq!(fails, 0);
}

#[test]
fn primalizes() {
    let (d, g) = load();
    let mut ruled = 0;
    let mut fails = 0;
    let mut n = 0;
    for e in g["primalize"].as_array().unwrap() {
        let cls = u(&e["cls"]) as usize;
        let mut sim = Sim::new(d.clone(), cls, true);
        let item = d.item_by_id[&(u(&e["item"]) as u32)];
        let (ex, child) = sim.primalize(item, u(&e["seed"]) as u32);
        let want: Vec<u64> = e["affixes"].as_array().unwrap().iter().map(u).collect();
        if socket_rule(&d, item) && ids(&d, &ex) != want {
            assert!(child as u64 == u(&e["child"]) && has_socket(&d, &ex), "socket rule: primalize item {:08x} seed {:08x}", u(&e["item"]), u(&e["seed"]));
            ruled += 1;
            n += 1;
            continue;
        }
        let lines: Vec<f64> = sim.values_max(item, &ex).iter().map(|l| l.value).collect();
        if ids(&d, &ex) != want || child as u64 != u(&e["child"]) || !same(&lines, &vals(&e["values_max"])) {
            fails += 1;
            if fails <= 5 {
                println!("MISMATCH primalize item {:08x} cls {}: got {:?} want {:?}", u(&e["item"]), cls, ids(&d, &ex), want);
            }
        }
        n += 1;
    }
    println!("primalizes checked: {}, mismatches {}, socket rule {}", n, fails, ruled);
    assert_eq!(fails, 0);
}
