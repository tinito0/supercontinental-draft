// Extract EJOGC layout classes (consts + int[][] tables) from decompiled source into JSON.
const fs=require("fs");const src=fs.readFileSync(process.argv[2],"utf8").split(/\r?\n/);
const out=[];let cur=null;
for(let i=0;i<src.length;i++){const l=src[i];
 const c=l.match(/^\tpublic class (\S+)\s*$/);if(c){if(cur&&Object.keys(cur.consts).length)out.push(cur);cur={name:c[1],line:i+1,consts:{},tables:{}};continue}
 if(!cur)continue;
 const k=l.match(/public const int (\S+) = (-?\d+);/);if(k){cur.consts[k[1]]=+k[2];continue}
 const t=l.match(/static readonly int\[\]\[\] (\S+) = new int\[(\d+)\]\[\]/);
 if(t){const rows=[];let j=i+2;for(;!/^\t\t\};/.test(src[j]);j++){const m=src[j].match(/new int\[(\d+)\](?: \{ ([^}]*) \})?/);if(m)rows.push(m[2]?m[2].split(",").map(Number):Array(+m[1]).fill(0))}cur.tables[t[1]]=rows;i=j}
}
if(cur&&Object.keys(cur.consts).length)out.push(cur);
fs.writeFileSync(process.argv[3],JSON.stringify(out));
for(const c of out)if(Object.values(c.consts).includes(312))console.log(c.name,"L"+c.line,JSON.stringify(c.consts),Object.entries(c.tables).map(([k,v])=>k+":"+v.length).join(" "));
