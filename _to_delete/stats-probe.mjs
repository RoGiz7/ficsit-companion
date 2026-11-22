import fs from 'fs'; import os from 'os';
import { Parser } from '@etothepii/satisfactory-file-parser';
const gd=JSON.parse(fs.readFileSync(os.homedir()+'/mnt/com.rogiz7.ficsitcompanion/gamedata.json','utf8'));
const nm=c=>(gd.items[c]&&(gd.items[c].name.es||gd.items[c].name.en))||(gd.buildings[c]&&(gd.buildings[c].name.es||gd.buildings[c].name.en))||c;
const leafOf=p=>((String((p&&p.pathName)||p||'').split('/').pop())||'').split('.').pop()||'';
const flat=p=>{const out={};const v=p&&p.values; if(!Array.isArray(v))return out;
 for(const[k,val]of v){const key=leafOf(k);
  if(typeof val==='number') out[key]=(out[key]||0)+val;
  else if(val&&val.properties) for(const inner of Object.values(val.properties)){
    const iv=inner&&inner.values; if(Array.isArray(iv)) for(const[kk,n]of iv) if(typeof n==='number'){const k2=leafOf(kk); out[k2]=(out[k2]||0)+n;}}}
 return out;};
const buf=fs.readFileSync(os.homedir()+'/mnt/SaveGames/76561197988051783/Lurra bi.sav');
const save=Parser.ParseSave('Lurra bi', buf.buffer.slice(buf.byteOffset, buf.byteOffset+buf.byteLength));
const lv=save.levels||{}; const lvls=Array.isArray(lv)?lv:Object.values(lv);
for(const l of lvls) for(const o of (l.objects||[])){
  if(!/FGStatisticsSubsystem/.test(o.typePath||'')) continue;
  const p=o.properties||{};
  for(const [key,label] of [['mCreaturesKilledCount','BAJAS'],['mConsumablesConsumedCount','CONSUMIDO'],['mItemsPickedUp','RECOGIDO'],['mItemsManuallyCraftedCount','FABRICADO A MANO'],['mActorsBuiltCount','CONSTRUIDO']]){
    const m=flat(p[key]); const e=Object.entries(m).sort((a,b)=>b[1]-a[1]);
    console.log(`\n--- ${label} --- ${e.length} tipos, total ${e.reduce((s,x)=>s+x[1],0).toLocaleString('es')}`);
    for(const [c,n] of e.slice(0,7)) console.log('   ',String(n).padStart(7), nm(c));
  }
}
