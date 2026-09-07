// Token regression checks, not a complete accessibility audit of rendered pages.
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
const tokens = Object.fromEntries([...css.matchAll(/--color-([\w-]+):\s*(#[\da-f]{6});/gi)].map(([,k,v])=>[k,v]));
const rgb = name => {
 const hex = tokens[name];
 assert.ok(hex, `Missing hex token: ${name}`);
 return [1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);
};
const lum = c => c.map(v=>v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[0.2126,0.7152,0.0722][i],0);
let count=0;
function check(fg,bg,min=4.5,alpha=1,base='surface-raised') {
 const back=rgb(bg).map((v,i)=>v*alpha+rgb(base)[i]*(1-alpha));
 const a=lum(rgb(fg)), b=lum(back), ratio=(Math.max(a,b)+0.05)/(Math.min(a,b)+0.05);
 assert.ok(ratio>=min,`${fg} / ${bg} @ ${alpha}: ${ratio} < ${min}`);
 console.log(`${fg} / ${bg}${alpha<1?` @ ${alpha}`:''}: ${ratio.toFixed(2)}:1`); count++;
}
for(const bg of ['bg','canvas','surface','surface-raised']) {
 for(const fg of ['text','text-secondary','text-tertiary','text-muted','accent-700']) check(fg,bg);
 check('border-control',bg,3); check('accent',bg,3);
}
for(const bg of ['accent','accent-700','accent-800','alert','alert-700','alert-800']) check('surface-raised',bg);
check('accent-800','accent-100');
check('alert','alert-100');
check('warning','warning-100');
check('warning','warning',4.5,.1);
check('warning','warning',4.5,.06);
check('success-700','success-100');
console.log(`Color OK: ${count} token pairs (unrounded assertions).`);
