//! Hardcore Hope of Cain amulets (LEDGER V194): a hardcore pool has one more entry than the softcore one, Ancestors' Grace (weight 25).
//! Observed in game on a fresh hardcore seasonal Monk (S40), 2026-10-25: Hope #1-#12 and #76.
use d3cube::{data::Data, sim::chain_roots};
use std::rc::Rc;

fn data() -> Rc<Data> {
    let root = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("..");
    Rc::new(Data::from_json(&std::fs::read_to_string(root.join("web/data.json")).unwrap()).unwrap())
}

fn names(d: &Data, hc: bool, n: u32) -> Vec<String> {
    let hero = d.classes.iter().position(|c| c == "Monk").unwrap();
    let slot = d.slots.iter().find(|s| s.name == "Amulet").unwrap();
    chain_roots(slot.pool(hero, hc), slot.key, 40, hc, n, true, hero, &d.items).iter().map(|r| d.items[r.item].name.clone()).collect()
}

#[test]
fn hardcore_monk_amulets_match_the_game() {
    let d = data();
    let got = names(&d, true, 76);
    let seen = [
        "Rondal's Locket", "Rondal's Locket", "Halcyon's Ascent", "Sunwuko's Shines", "Blackthorne's Duncraig Cross", "Countess Julia's Cameo",
        "The Flavor of Time", "Kymbo's Gold", "The Ess of Johan", "The Ess of Johan", "Ouroboros", "Mara's Kaleidoscope",
    ];
    assert_eq!(&got[..12], &seen);
    assert_eq!(got[75], "Ancestors' Grace");
    assert_eq!(got.iter().filter(|n| *n == "Ancestors' Grace").count(), 1, "first draw of the extra entry is Hope #76");
}

#[test]
fn softcore_amulet_pool_has_no_hardcore_item() {
    let d = data();
    let hero = d.classes.iter().position(|c| c == "Monk").unwrap();
    let slot = d.slots.iter().find(|s| s.name == "Amulet").unwrap();
    assert!(slot.pool(hero, false).iter().all(|&(i, _)| !d.items[i].hc_only));
    assert!(slot.pool(hero, true).iter().any(|&(i, w)| d.items[i].hc_only && w == 25));
    assert!(!names(&d, false, 76).iter().any(|n| n == "Ancestors' Grace"));
}
