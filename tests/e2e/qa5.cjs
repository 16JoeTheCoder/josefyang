const { chromium } = require('playwright');
const B='http://localhost:4321';
const log=(k,v)=>console.log(k+': '+JSON.stringify(v));
(async()=>{
const br=await chromium.launch();const ctx=await br.newContext({viewport:{width:1440,height:900}});const p=await ctx.newPage();
const errs=[];p.on('pageerror',e=>errs.push('PE '+e.message));p.on('console',m=>{if(m.type()==='error'||m.type()==='warning')errs.push(m.type()+' '+m.text().slice(0,200))});
await p.goto(B+'/');await p.waitForTimeout(300);
const nav=async(name)=>{await p.click(`nav a:has-text("${name}") >> nth=0`);await p.waitForTimeout(1500);log('nav '+name,p.url());};
await p.goto(B+'/');await p.waitForTimeout(700);
log('nav links',await p.$$eval('nav a',a=>a.map(x=>x.textContent.trim()+'>'+x.getAttribute('href'))));
const floorChk=async(tag)=>{const t=await p.evaluate(()=>{const r=document.querySelector('[data-floor]');return [r.getBoundingClientRect().top+scrollY,r.offsetHeight]});
 const res=[];for(let i=0;i<4;i++){await p.evaluate(([t,h,i])=>scrollTo(0,t+(i+.5)*(h-innerHeight)/4),[t[0],t[1],i]);await p.waitForTimeout(1000);res.push(await p.evaluate(()=>document.querySelector('[data-floor-index]').textContent));}
 // listener count check: one wheel step key
 await p.evaluate(([t])=>scrollTo(0,t+5),[t[0]]);await p.waitForTimeout(600);await p.focus('[data-floor-stage]');await p.keyboard.press('ArrowDown');await p.waitForTimeout(1000);res.push('key:'+await p.evaluate(()=>document.querySelector('[data-floor-index]').textContent));
 log('floor '+tag,res);};
await floorChk('first');
await nav('Projects');
await p.focus('[data-track]');await p.keyboard.press('ArrowRight');await p.waitForTimeout(900);log('proj',await p.evaluate(()=>document.querySelector('[data-pos]').textContent));
await nav('Failures');
await p.click('[data-tile] >> nth=1');await p.waitForTimeout(2500);log('fail',await p.evaluate(()=>[...document.querySelectorAll('[data-slip]')].filter(s=>!s.hidden).map(s=>s.dataset.slip)));
await nav('About');await p.evaluate(()=>document.querySelector('[data-rig]').scrollIntoView({block:'end'}));await p.waitForTimeout(600);log('rig',await p.evaluate(()=>document.querySelector('[data-rig-count]').textContent));
await p.goBack();await p.waitForTimeout(1500);log('back',p.url());
await p.focus('[data-tile]').catch(()=>{});await p.click('[data-tile] >> nth=2');await p.waitForTimeout(2500);log('fail after back',await p.evaluate(()=>[...document.querySelectorAll('[data-slip]')].filter(s=>!s.hidden).map(s=>s.dataset.slip)));
await p.goBack();await p.waitForTimeout(1500);log('back2',p.url());
await p.goBack();await p.waitForTimeout(1500);log('back3',p.url());
await floorChk('after back to home');
await p.goForward();await p.waitForTimeout(1500);log('fwd',p.url());
await p.focus('[data-track]');await p.keyboard.press('ArrowRight');await p.waitForTimeout(900);log('proj after fwd',await p.evaluate(()=>[document.querySelector('[data-pos]').textContent,location.hash]));
// duplicate-listener check on selector: Enter once -> single navigation
await p.keyboard.press('Enter');await p.waitForTimeout(1800);log('enter',p.url());
// home hero links
await p.goto(B+'/');await p.waitForTimeout(500);
log('errs',errs);
await br.close();})();
