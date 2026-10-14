// Generates pes/formats/pes2021/binLayout.js from EJOGC layout tables + export-based verification.
const fs=require("fs");const [S,outFile,csvPath]=process.argv.slice(2);
const C=JSON.parse(fs.readFileSync(S+"/rea/layouts.json")).find(c=>c.name==="_2057"&&c.consts._2002===1532);
const kindOf=(e,isBool)=>e.length===4?{kind:"bits",offset:e[0],shift:e[1],bits:e[2],addend:e[3]}:isBool?{kind:"bool",offset:e[0],bit:e[1]}:e[1]<=4?{kind:"uint",offset:e[0],size:e[1]}:{kind:"string",offset:e[0],length:e[1]};
function readVal(buf,b,d){if(d.kind==="string"){const s=buf.subarray(b+d.offset,b+d.offset+d.length);const z=s.indexOf(0);return s.subarray(0,z<0?s.length:z).toString("utf8")}
 if(d.kind==="bool")return (buf[b+d.offset]>>d.bit&1)===1;if(d.kind==="uint"){return d.size===1?buf[b+d.offset]:d.size===2?(d.signed?buf.readInt16LE(b+d.offset):buf.readUInt16LE(b+d.offset)):(d.signed?buf.readInt32LE(b+d.offset):buf.readUInt32LE(b+d.offset))}
 let v=0;for(let i=0;i<d.bits;i++){const p=d.shift+i;if(buf[b+d.offset+(p>>3)]>>(p&7)&1)v+=2**i}return v+d.addend}
const same=(v,x)=>typeof v==="boolean"?(x==="True")===v:String(v)===x||Number(v)===Number(x);
const RENAME={POS:"registeredPosition",GK:"posGK",CB:"posCB",LB:"posLB",RB:"posRB",DMF:"posDMF",CMF:"posCMF",LMF:"posLMF",RMF:"posRMF",AMF:"posAMF",LWF:"posLWF",RWF:"posRWF",SS:"posSS",CF:"posCF",GKAwareness:"gkAwareness",GKCatching:"gkCatching",GKClearing:"gkClearing",GKReflexes:"gkReflexes",GKReach:"gkReach",Foot:"strongFootLeft"};
const camel=s=>RENAME[s]||camel0(s);
const camel0=s=>s.replace(/^[A-Z]+(?=[A-Z][a-z])|^[A-Z]/,m=>m.toLowerCase()).replace(/[^A-Za-z0-9]/g,"");
// TEAM
const T=fs.readFileSync(S+"/dec/Team.raw");const tl=fs.readFileSync(csvPath,"utf8").replace(/^﻿/,"").split(/\r?\n/).filter(Boolean);const th=tl[0].split(";");const trows=tl.slice(1).map(l=>l.split(";"));
const tById=new Map();for(let i=0;i<T.length/1532;i++)tById.set(T.readUInt32LE(i*1532+8),i*1532);
const team=[];C.tables._2002.forEach((e,i)=>{if(!e.length)return;const isBool=trows.some(r=>r[i]==="True"||r[i]==="False");let d=kindOf(e,isBool);let ok=0;for(const r of trows){if(same(readVal(T,tById.get(+r[0]),d),r[i]))ok++}
 if(ok<trows.length&&d.kind==="uint"){const d2={...d,signed:true};let ok2=0;for(const r of trows)if(same(readVal(T,tById.get(+r[0]),d2),r[i]))ok2++;if(ok2>ok){d=d2;ok=ok2}}
 team.push({name:camel(th[i]),...d,evidence:`ejogc#${i}; ${ok}/${trows.length} rows equal in Teams CSV export`,confidence:ok===trows.length?"verified":"partial"})});
// PLAYER
const P=fs.readFileSync(S+"/dec/Player.raw");const prow=JSON.parse(fs.readFileSync(S+"/dec/players_rows.json"));const ph=prow[0];
const pById=new Map();for(let i=0;i<P.length/312;i++)pById.set(P.readUInt32LE(i*312+8),i*312);const pdata=prow.slice(1).filter(r=>pById.has(+r[0]));
const player=[];C.tables._00A0.forEach((e,i)=>{if(!e.length||i>57)return;const label=ph[i];if(!label)return;const isBool=pdata.some(r=>r[i]==="True"||r[i]==="False");const d=kindOf(e,isBool);
 let ok=0,near=0;for(const r of pdata){const v=readVal(P,pById.get(+r[0]),d);if(same(v,r[i]))ok++;if(typeof v==="number"&&Math.abs(v-Number(r[i]))<=5)near++}
 const pct=x=>(100*x/pdata.length).toFixed(1);
 player.push({name:camel(label),...d,evidence:`ejogc#${i}; column order of Players export; ${pct(ok)}% exact${d.kind==="bits"?`, ${pct(near)}% within ±5`:""} over ${pdata.length} id-matched players (export is a different season)`,confidence:ok/pdata.length>0.85?"verified":ok/pdata.length>0.75||(d.kind==="bits"&&d.bits>=5&&near/pdata.length>0.6)||d.kind==="string"?"structural":"unverified"})});
// Cross-check against the independent Player.bin offsets in PES Editor Rebuilt js/app.js (DB_ABIL etc.).
const REBUILT={offensiveAwareness:370,dribbling:352,loftedPass:402,finishing:396,placeKicking:250,curl:332,kickingPower:358,speed:306,acceleration:344,stamina:338,defensiveAwareness:275,ballWinning:312,aggression:384,jump:294,heading:288,lowPass:263,balance:376,physicalContact:390,ballControl:281,tightPossession:416,age:408,country:233,height:216};
const REBUILT_BYTES={name:0xFB,shirt:0x81};
for(const f of player){const bit=f.kind==="bits"?f.offset*8+f.shift:null;
 if(REBUILT[f.name]!=null&&bit===REBUILT[f.name]){f.confidence="verified";f.evidence+="; same bit offset as PES Editor Rebuilt Player.bin layout"}
 if(REBUILT_BYTES[f.name]!=null&&f.offset===REBUILT_BYTES[f.name]){f.confidence="verified";f.evidence+="; same offset as PES Editor Rebuilt; EDIT00000000 player 45685 shows the same name"}
 if(/^gk(Awareness|Catching|Clearing|Reflexes|Reach)$/.test(f.name)){f.confidence="unverified";f.evidence+="; NAME CONFLICT: Rebuilt labels these 5 offsets differently and goalkeeper data could not disambiguate (read-only)"}}
// ASSIGNMENT
const pa=C.tables._1680;const A=[{name:"id",d:pa[0],ev:"19404/19404 unique"},{name:"playerId",d:pa[1],ev:"19382/19404 reference Player.bin ids"},{name:"teamId",d:pa[2],ev:"19381/19404 reference Team.bin ids"},{name:"shirtNumber",d:[12,0,8,1],ev:"ejogc#3 is the raw byte at 12; stored value is number-1, confirmed on real squads (Arsenal: Raya #1=0, Saliba #2=1, Saka #7=6, Odegaard #8=7, Havertz #29=28)"}].map(x=>({name:x.name,...kindOf(x.d,false),evidence:x.ev,confidence:"verified"}));
const js=`// GENERATED by tools/gen_layout (scratchpad) — do not edit by hand.
// Source of offsets: layout tables of "PES 2020 Editor V0.12.8 by Ejogc327" (PES 2021 / Bin mode),
// obtained by decompiling PES2020Editor.exe (sha256 51e967a15e78b005a81da5daffc3eb9ab6bb0988d8e8490cdb599d0d372fe367).
// Only numeric layout facts were taken; no EJOGC code is reproduced. Each field records the evidence
// used to verify it against real PES 2021 data (vendor/UML_Database pesdb + EJOGC exports).
// Fields in the EJOGC tables that could not be labelled are NOT exposed; their bytes are preserved untouched.

export const TEAM_RECORD_SIZE = ${C.consts._2002};
export const PLAYER_RECORD_SIZE = ${C.consts._00A0};
export const ASSIGNMENT_RECORD_SIZE = ${C.consts._1680};

export const TEAM_FIELDS = ${JSON.stringify(team,null,2)};

export const PLAYER_FIELDS = ${JSON.stringify(player,null,2)};

export const ASSIGNMENT_FIELDS = ${JSON.stringify(A,null,2)};
`;
fs.writeFileSync(outFile,js);console.log("team",team.length,"partial:",team.filter(f=>f.confidence!=="verified").map(f=>f.name+" "+f.evidence));
console.log("player",player.length);for(const f of player)console.log(" ",f.name,f.kind,f.confidence,f.evidence.split("; ").slice(2).join("; "));
