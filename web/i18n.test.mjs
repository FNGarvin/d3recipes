import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {readFileSync,readdirSync} from 'node:fs';
import vm from 'node:vm';
import {initSync,Engine} from './pkg/d3cube.js';
// The page's languages (i18n.js and lang/<code>.js): every language has every sentence and stat name, the first language comes from the
// saved choice and then the browser, names follow the language in use, and numbers use the language's format.
const source=readFileSync(new URL('./i18n.js',import.meta.url),'utf8');
const langDir=new URL('./lang/',import.meta.url);
const langFile=code=>readFileSync(new URL(`${code}.js`,langDir),'utf8');
// A page as the browser sets it up: i18n.js runs, then (as document.write does) the file of the first language.
function load({saved=null,languages=['en-US'],storageThrows=false}={}){
  const window={};
  const context=vm.createContext({
    window,
    document:{addEventListener(){},querySelectorAll:()=>[],getElementById:()=>null,documentElement:{}},
    localStorage:{getItem(){if(storageThrows)throw new Error('blocked');return saved;},setItem(){if(storageThrows)throw new Error('blocked');}},
    navigator:{languages,language:languages[0]},
    CustomEvent:function(){}});
  const translations=vm.runInContext(source+';translations',context);
  const i18n=window.D3_I18N;
  const code=i18n.current();
  if(code!=='en')vm.runInContext(langFile(code),context);
  return {window,translations,i18n,context};
}
const loadLang=code=>load({saved:code});
const codes=load().i18n.LANGUAGES.map(l=>l.code);
const others=codes.filter(c=>c!=='en');
const rawFile=code=>{const w={};vm.runInContext(langFile(code),vm.createContext({window:w}));return w.D3_LANG[code];};
const placeholders=s=>(s.match(/\{\w+\}/g)||[]).sort().join(',');

test('there is one file for every language the menu offers, and no other',()=>{
  const files=readdirSync(langDir).filter(f=>f.endsWith('.js')).map(f=>f.slice(0,-3)).sort();
  assert.deepEqual(files,[...others].sort());
});
test('every language has every sentence of the English page, with the same {placeholders}, and no sentence it does not use',()=>{
  const {translations:{en}}=load();
  for(const code of others){
    const text=rawFile(code).text;
    assert.deepEqual(Object.keys(en).filter(k=>!(k in text)),[],code+' lacks sentences');
    assert.deepEqual(Object.keys(text).filter(k=>!(k in en)),[],code+' has sentences the page does not use');
    for(const [k,v] of Object.entries(text)){
      assert.ok(typeof v==='string'&&v.trim(),code+' '+k+' is empty');
      assert.equal(placeholders(v),placeholders(en[k]),code+' '+k+' changes the {placeholders}');
    }
  }
});
test('no language ships its sentences untranslated: only a handful (punctuation, loan words like Softcore) equal the English',()=>{
  const {translations:{en}}=load();
  for(const code of others){
    const text=rawFile(code).text;
    const same=Object.keys(en).filter(k=>text[k]===en[k]);
    assert.ok(same.length<=10,code+' leaves '+same.length+' sentences in English: '+same.join(', '));
  }
});
test('every language names the same stats as Simplified Chinese, the first language that did',()=>{
  const reference=Object.keys(rawFile('zh-CN').stat);
  for(const code of others){
    const stat=rawFile(code).stat;
    assert.deepEqual(reference.filter(k=>!(k in stat)),[],code+' lacks stat names');
    for(const [k,v] of Object.entries(stat))assert.ok(typeof v==='string'&&v.trim(),code+' stat '+k+' is empty');
  }
});
test('the language files hold only the three sections, and no key is both a sentence and a game name',()=>{
  for(const code of others){
    const f=rawFile(code);
    assert.deepEqual(Object.keys(f).sort(),['game','stat','text'],code);
    assert.deepEqual(Object.keys(f.game).filter(k=>k in f.text),[],code);
  }
});
test('a Chinese-only key is a name (item, class, slot, stat), not page text the English page would show as a bare key',()=>{
  const {translations:{en}}=load();
  const text=rawFile('zh-CN').text;
  assert.deepEqual(Object.keys(rawFile('zh-CN').game).filter(k=>!(k in en)&&/^[a-z][A-Za-z0-9]*$/.test(k)&&k in text),[]);
});
test('browser languages map to ours: regions and scripts, Latin-American Spanish, Brazilian Portuguese, the two Chinese',()=>{
  const {languageFor}=load().i18n;
  const want={'en':'en','en-GB':'en','de':'de','de-AT':'de','es':'es','es-ES':'es','es-MX':'es-MX','es-419':'es-MX','es-AR':'es-MX','fr-CA':'fr','it-CH':'it','ja':'ja','ja-JP':'ja',
    'ko-KR':'ko','pl':'pl','pt':'pt-BR','pt-PT':'pt-BR','pt-BR':'pt-BR','ru':'ru','zh':'zh-CN','zh-CN':'zh-CN','zh-Hans':'zh-CN','zh-SG':'zh-CN','zh-TW':'zh-TW',
    'zh-HK':'zh-TW','zh-Hant':'zh-TW','zh-Hant-TW':'zh-TW','sv':null,'':null};
  for(const [tag,code] of Object.entries(want))assert.equal(languageFor(tag),code,tag);
});
test('the first language: a saved choice wins, then the browser languages in order, then English',()=>{
  const first=(o)=>load(o).i18n.current();
  assert.equal(first({saved:'en',languages:['zh-CN']}),'en');
  assert.equal(first({saved:'zh-CN',languages:['en-US']}),'zh-CN');
  assert.equal(first({saved:'zh',languages:['en-US']}),'zh-CN');         // the first version stored "zh"
  assert.equal(first({saved:'fr',languages:['de-DE']}),'fr');
  assert.equal(first({languages:['zh-TW','en']}),'zh-TW');
  assert.equal(first({languages:['de-DE']}),'de');
  assert.equal(first({languages:['sv','pt-PT','en']}),'pt-BR');         // the first language we have
  assert.equal(first({languages:['sv']}),'en');
  assert.equal(first({saved:'xx',languages:['de-DE']}),'de');           // a saved language we no longer offer
  assert.equal(load({saved:'de'}).window.t('tagline'),rawFile('de').text.tagline);
});
test('blocked browser storage does not stop the page',()=>{
  assert.equal(load({storageThrows:true,languages:['en-US']}).window.t('tagline'),load().translations.en.tagline);
  assert.equal(load({storageThrows:true,languages:['ja']}).window.t('tagline'),rawFile('ja').text.tagline);
});
test('a missing sentence reads in English, never as its key',()=>{
  const {window,translations:{en}}=load({saved:'de'});
  assert.equal(window.t('noSuchKeyAnywhere'),'noSuchKeyAnywhere');
  assert.equal(window.t('matsEach',{names:'A',n:'3'}),rawFile('de').text.matsEach.replace('{names}','A').replace('{n}','3'));
  assert.ok(en.tagline);
});
test('item names follow the page language',async()=>{
  const {itemName}=await import('./stats.js');
  const data=JSON.parse(await readFile(new URL('./data.json',import.meta.url),'utf8'));
  const sample=data.items.map(i=>i.name).find(n=>others.every(c=>rawFile(c).game[n]));
  assert.ok(sample,'an item every language names');
  globalThis.window=load({saved:'en'}).window;
  assert.equal(itemName(sample),sample);
  for(const code of others){
    globalThis.window=load({saved:code}).window;
    assert.equal(itemName(sample),rawFile(code).game[sample],code);
  }
  delete globalThis.window;
});
test('numbers and percentages use the format of the page language',async()=>{
  const {numFmt,fmtValue}=await import('./stats.js');
  globalThis.window=load({saved:'en'}).window;
  assert.equal(numFmt(1234567),'1,234,567');
  assert.equal(fmtValue('CriticalChance',0.125),'12.5%');
  globalThis.window=load({saved:'de'}).window;
  assert.equal(numFmt(1234567),'1.234.567');
  assert.match(fmtValue('CriticalChance',0.125),/^12,5\s%$/);
  globalThis.window=load({saved:'fr'}).window;
  assert.equal(numFmt(1234567).replace(/\s/g,' '),'1 234 567');
  delete globalThis.window;
});
test('saved builds and exports carry the game\'s English stat names, whatever language the page shows',async()=>{
  const zh=load({saved:'zh-CN'});
  const stem=Object.keys(rawFile('zh-CN').stat).find(k=>rawFile('zh-CN').stat[k]);
  const {statName,statNameEnglish}=await import('./stats.js');
  globalThis.window=zh.window;
  assert.equal(statName(stem),rawFile('zh-CN').stat[stem]);
  const english=statNameEnglish(stem);
  assert.ok(english&&!/[一-鿿]/.test(english),'English name for '+stem);
  globalThis.window=load({saved:'en'}).window;
  assert.equal(statName(stem),english);
  delete globalThis.window;
});
test('every material a recipe can show has a name in every language',async()=>{
  const {MATERIAL_ICONS,RECIPES}=await import('./stats.js');
  const used=new Set(Object.values(RECIPES).flatMap(r=>Object.keys(r)));
  for(const code of others)for(const name of new Set([...used,...Object.keys(MATERIAL_ICONS)]))assert.ok(rawFile(code).game[name],code+': name for '+name);
});
test('page code has no English message that the table already translates',async()=>{
  const {translations:{en}}=load();
  const files=['app','builds','create-build','search-builds','search-settings','ui','recipe','stats'];
  const code=(await Promise.all(files.map(f=>readFile(new URL(`./${f}.js`,import.meta.url),'utf8')))).join('\n')
    .replace(/\/\*[\s\S]*?\*\//g,'').replace(/(^|[^:'"\w])\/\/[^\n]*/g,'$1')
    .replace(/const _fb=[^\n]*/,''); // the English fallback used only when the translation function is missing
  const found=[];
  for(const [key,text] of Object.entries(en)){
    for(const chunk of text.split(/\{\w+\}/).map(c=>c.trim()).filter(c=>c.length>=14&&c.includes(' ')))
      if(code.includes(chunk)){found.push(key+': '+chunk);break;}
  }
  assert.deepEqual(found,[],'use _t / window.t for these');
});
test('every stat the engine can offer on an item has a name in every language',async()=>{
  const {HIDDEN}=await import('./stats.js');
  initSync({module:await readFile(new URL('./pkg/d3cube_bg.wasm',import.meta.url))});
  const engine=new Engine(await readFile(new URL('./data.json',import.meta.url),'utf8'));
  const stems=new Set();
  for(const it of JSON.parse(engine.describe()).items)for(const c of it.classes||[]){
    const r=JSON.parse(engine.stems(c,it.slot,it.id));
    for(const x of Array.isArray(r)?r:Object.keys(r))stems.add(typeof x==='string'?x:(x.stem||x[0]));
  }
  const alias=s=>{const m=/^Weapon ?Hit ?([A-Za-z]+?)[12]h$/.exec(s);return m?'Hit'+m[1]:s;};
  for(const code of codes.filter(c=>c!=='en')){
    const stat=rawFile(code).stat;
    const missing=[...stems].filter(s=>!HIDDEN.test(s)&&!(s in stat)&&!(alias(s) in stat));
    assert.deepEqual(missing,[],code+': stats with no name');
  }
});
test('every slot title the prepared builds use has a name in every language',async()=>{
  const slots=new Set();
  for(const f of ['premade_sc.json','premade_hc.json']){
    const walk=o=>{if(Array.isArray(o))o.forEach(walk);else if(o&&typeof o==='object')for(const [k,v] of Object.entries(o)){if(k==='slot'&&typeof v==='string')slots.add(v);else walk(v);}};
    walk(JSON.parse(await readFile(new URL('./'+f,import.meta.url),'utf8')));
  }
  assert.ok(slots.size>=10,'slot titles found');
  for(const code of others)assert.deepEqual([...slots].filter(n=>!(n in rawFile(code).game)),[],code+': slot titles with no name');
});
test('every item the engine knows has a name in every language',async()=>{
  initSync({module:await readFile(new URL('./pkg/d3cube_bg.wasm',import.meta.url))});
  const engine=new Engine(await readFile(new URL('./data.json',import.meta.url),'utf8'));
  const names=[...new Set(JSON.parse(engine.describe()).items.map(i=>i.name))];
  for(const code of others){
    const game=rawFile(code).game;
    assert.deepEqual(names.filter(n=>!(n in game)),[],code+': items with no name');
  }
});
test('English skill names read as the game spells them, and builds exported with the old names still import',async()=>{
  const {statNameEnglish,legacyStatNames}=await import('./stats.js');
  const want={Skill_Barbarian_HotA:'Hammer of the Ancients damage',Skill_Wizard_RayofFrost:'Ray of Frost damage',Skill_Monk_WaveofLight:'Wave of Light damage',
    Skill_WitchDoctor_WallofZombies:'Wall of Zombies damage',Skill_Wizard_WaveOfForce:'Wave of Force damage',Skill_Barbarian_CallOfTheAncients:'Call of the Ancients damage',
    Skill_Crusader_FistOfTheHeavens:'Fist of the Heavens damage',Skill_Monk_Wayof100Fists:'Way of the Hundred Fists damage',Skill_Crusader_HeavensFury3:"Heaven's Fury damage",
    Skill_Monk_SevenSidedStrike:'Seven-Sided Strike damage',Skill_WitchDoctor_FireBomb:'Firebomb damage',Skill_Wizard_SpectralBlade:'Spectral Blade damage'};
  for(const [stem,name] of Object.entries(want))assert.equal(statNameEnglish(stem),name,stem);
  assert.deepEqual(legacyStatNames('Skill_Barbarian_HotA'),['Hot A damage']);
  assert.deepEqual(legacyStatNames('Dex'),[]);
});
test('item names from before the game spelling was adopted still match, so builds saved or exported with them import',async()=>{
  const {itemKey}=await import('./stats.js');
  for(const [old,now] of [['Bracer of Destruction','Bracers of Destruction'],['Sherma of Corrosion','Cord of the Sherma'],['Sin Seekers Quivers','Sin Seekers'],
    ['Wojahnni Assaulter Crossbows','Wojahnni Assaulter'],['Squirts Necklace',"Squirt's Necklace"],['Ambos Pride',"Ambo's Pride"],['Defender Of Westmarch','Defender of Westmarch']])
    assert.equal(itemKey(old),itemKey(now),old);
  const data=JSON.parse(await readFile(new URL('./data.json',import.meta.url),'utf8'));
  const names=new Set(data.items.map(i=>i.name));
  for(const now of ['Bracers of Destruction','Cord of the Sherma','Sin Seekers','Wojahnni Assaulter',"Squirt's Necklace","Ambo's Pride"])assert.ok(names.has(now),now);
  for(const old of ['Bracer of Destruction','Sherma of Corrosion','Sin Seekers Quivers','Wojahnni Assaulter Crossbows','Squirts Necklace','Ambos Pride'])assert.ok(!names.has(old),old);
});
