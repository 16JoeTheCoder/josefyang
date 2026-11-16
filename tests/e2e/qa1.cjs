const { chromium } = require('playwright');
const B='http://localhost:4321';
const out=[];const log=(k,v)=>{out.push(k+': '+JSON.stringify(v));console.log(k+': '+JSON.stringify(v));};
(async()=>{
const br=await chromium.launch();
async function mk(opts={}){const ctx=await br.newContext({viewport:{width:1440,height:900},...opts});const p=await ctx.newPage();p.errs=[];p.on('pageerror',e=>p.errs.push('PE '+e.message));p.on('console',m=>{if(m.type()==='error')p.errs.push('CE '+m.text())});return p;}
// 1 floor
let p=await mk();await p.goto(B+'/');await p.waitForTimeout(800);
const st=()=>p.evaluate(()=>({n:document.querySelector('[data-floor-index]').textContent,cx:getComputedStyle(document.querySelector('[data-floor-plane]')).getPropertyValue('--cx'),cy:getComputedStyle(document.querySelector('[data-floor-plane]')).getPropertyValue('--cy'),sy:scrollY,cur:[...document.querySelectorAll('[data-stop]')].findIndex(s=>s.classList.contains('is-current'))}));
const fl=await p.evaluate(()=>{const r=document.querySelector('[data-floor]');const b=r.getBoundingClientRect();return {top:b.top+scrollY,h:r.offsetHeight,stops:[...document.querySelectorAll('[data-stop]')].map(s=>[s.dataset.x,s.dataset.y])}});log('floor',fl);
for(let i=0;i<4;i++){await p.evaluate(([t,h,i])=>scrollTo(0,t+(i+.5)*(h-innerHeight)/4),[fl.top,fl.h,i]);await p.waitForTimeout(1200);log('scroll stop'+i,await st());}
await p.screenshot({path:'/tmp/claude-0/qa/floor-last.png'});
// wheel
await p.evaluate(([t])=>scrollTo(0,t+5),[fl.top]);await p.waitForTimeout(500);await p.mouse.move(700,450);
for(let i=0;i<5;i++){await p.mouse.wheel(0,120);await p.waitForTimeout(300);}
await p.waitForTimeout(900);log('after wheel 600',await st());
// keyboard
await p.evaluate(([t])=>scrollTo(0,t+5),[fl.top]);await p.waitForTimeout(600);
await p.focus('[data-floor-stage]');
const keys=[];for(const k of ['ArrowDown','ArrowRight','PageDown','ArrowUp']){await p.keyboard.press(k);await p.waitForTimeout(900);keys.push([k,(await st()).n]);}log('keys',keys);
// tab to button on other stop
await p.evaluate(([t])=>scrollTo(0,t+5),[fl.top]);await p.waitForTimeout(600);
await p.focus('[data-floor-stage]');
let tabs=[];for(let i=0;i<5;i++){await p.keyboard.press('Tab');await p.waitForTimeout(700);tabs.push([await p.evaluate(()=>document.activeElement.textContent.trim().slice(0,30)),(await st()).n]);}log('tabs',tabs);
// skip
await p.evaluate(([t])=>scrollTo(0,t+5),[fl.top]);await p.waitForTimeout(500);
await p.click('[data-floor-skip]');await p.waitForTimeout(1200);
log('skip',{sy:await p.evaluate(()=>scrollY),endOfFloor:fl.top+fl.h-900,focus:await p.evaluate(()=>document.activeElement.id),st:await st()});
// no trap: wheel after last stop
await p.evaluate(([t,h])=>scrollTo(0,t+h-900-5),[fl.top,fl.h]);await p.waitForTimeout(600);
const y0=await p.evaluate(()=>scrollY);for(let i=0;i<6;i++){await p.mouse.wheel(0,300);await p.waitForTimeout(150);}await p.waitForTimeout(500);
log('no trap',{y0,y1:await p.evaluate(()=>scrollY)});
// keyboard at last stop: ArrowDown should scroll page
await p.focus('[data-floor-stage]');await p.keyboard.press('ArrowDown');await p.waitForTimeout(500);log('arrowdown past last',await p.evaluate(()=>scrollY));
log('errs desktop',p.errs);
// click object hover etc skip
// overflow
for(const w of [390,768,1024,1440]){const q=await mk();await q.setViewportSize({width:w,height:900});for(const path of ['/','/projects','/failures','/about','/devlog']){await q.goto(B+path);await q.waitForTimeout(500);const o=await q.evaluate(()=>[document.scrollingElement.scrollWidth,innerWidth]);if(o[0]>o[1])log('OVERFLOW '+w+path,o);}await q.context().close();}
// mobile floor
let m=await mk({viewport:{width:390,height:844}});await m.goto(B+'/');await m.waitForTimeout(600);
log('mobile floor',await m.evaluate(()=>{const s=document.querySelector('[data-floor-stage]');const cs=getComputedStyle(s);return {pos:cs.position,h:s.offsetHeight,fh:document.querySelector('[data-floor]').offsetHeight,plane:getComputedStyle(document.querySelector('[data-floor-plane]')).transform,stops:[...document.querySelectorAll('[data-stop]')].map(x=>{const r=x.getBoundingClientRect();return [Math.round(r.left),Math.round(r.width)]})}}));
await m.evaluate(()=>document.querySelector('[data-floor]').scrollIntoView());await m.screenshot({path:'/tmp/claude-0/qa/floor-mobile.png'});log('mobile errs',m.errs);
let r=await mk({reducedMotion:'reduce'});await r.goto(B+'/');await r.waitForTimeout(600);
log('rm floor',await r.evaluate(()=>{const s=document.querySelector('[data-floor-stage]');return {pos:getComputedStyle(s).position,fh:document.querySelector('[data-floor]').offsetHeight,tf:getComputedStyle(document.querySelector('[data-floor-plane]')).transform,cur:document.querySelectorAll('.is-current').length}}));
await r.evaluate(()=>document.querySelector('[data-floor]').scrollIntoView());await r.screenshot({path:'/tmp/claude-0/qa/floor-rm.png'});log('rm errs',r.errs);
await br.close();})();
