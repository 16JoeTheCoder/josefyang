const { chromium } = require('playwright');
const B='http://localhost:4321';
const log=(k,v)=>console.log(k+': '+JSON.stringify(v));
(async()=>{
const br=await chromium.launch();const p=await (await br.newContext({viewport:{width:1440,height:900}})).newPage();
await p.goto(B+'/projects');await p.waitForTimeout(900);
const info=()=>p.evaluate(()=>[document.querySelector('[data-pos]').textContent,...[...document.querySelectorAll('[data-card]')].slice(0,3).map(c=>{const r=c.getBoundingClientRect();return [Math.round(r.x),Math.round(r.width),Math.round(r.y),Math.round(r.height)]})]);
log('rects',await info());
for(const idx of [1]){
const b=await p.evaluate(i=>{const c=document.querySelectorAll('[data-card]')[i].getBoundingClientRect();return [Math.min(c.x+c.width/2,1350),c.y+c.height/2]},idx);
const hit=await p.evaluate(([x,y])=>{const e=document.elementFromPoint(x,y);return e&&(e.className+' '+e.tagName+' '+(e.closest('[data-card]')?.dataset.index))},b);
log('hit',[b,hit]);
await p.mouse.click(...b);await p.waitForTimeout(1200);log('after click '+idx,await info());}
// click right neighbour after centre 1
await p.click('[data-next]');await p.waitForTimeout(900);
const c2=await p.evaluate(()=>{const c=document.querySelectorAll('[data-card]')[3].getBoundingClientRect();return [Math.min(c.x+c.width/2,1380),c.y+c.height/2]});
await p.mouse.click(...c2);await p.waitForTimeout(1200);log('click right neighbour',await info());
await p.screenshot({path:'/tmp/claude-0/qa/proj2.png'});
await br.close();})();
