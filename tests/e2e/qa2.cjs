const { chromium } = require('playwright');
const B='http://localhost:4321';
const log=(k,v)=>console.log(k+': '+JSON.stringify(v));
(async()=>{
const br=await chromium.launch();
async function mk(opts={}){const ctx=await br.newContext({viewport:{width:1440,height:900},...opts});const p=await ctx.newPage();p.errs=[];p.on('pageerror',e=>p.errs.push('PE '+e.message));p.on('console',m=>{if(m.type()==='error')p.errs.push('CE '+m.text())});return p;}
let p=await mk();
// floor last-stop arrow
await p.goto(B+'/');await p.waitForTimeout(500);
await p.evaluate(()=>{const r=document.querySelector('[data-floor]');scrollTo(0,r.getBoundingClientRect().top+scrollY+r.offsetHeight-innerHeight-100)});await p.waitForTimeout(800);
await p.focus('[data-floor-stage]',{});const y0=await p.evaluate(()=>scrollY);await p.keyboard.press('ArrowDown');await p.waitForTimeout(600);log('last-stop arrowdown',[y0,await p.evaluate(()=>scrollY)]);
// selector
await p.goto(B+'/projects');await p.waitForTimeout(900);
const S=()=>p.evaluate(()=>({pos:document.querySelector('[data-pos]').textContent,hash:location.hash,lock:document.querySelector('[data-lock]').getAttribute('href'),total:document.querySelector('[data-pos]').parentElement.textContent,sel:[...document.querySelectorAll('[data-card]')].findIndex(c=>c.getAttribute('aria-selected')==='true'),prevDis:document.querySelector('[data-prev]').disabled,nextDis:document.querySelector('[data-next]').disabled}));
log('init',await S());
await p.focus('[data-track]');
for(const k of ['ArrowRight','ArrowRight','ArrowLeft','End','Home']){await p.keyboard.press(k);await p.waitForTimeout(900);log(k,await S());}
await p.click('[data-next]');await p.waitForTimeout(900);log('next',await S());
await p.click('[data-prev]');await p.waitForTimeout(900);log('prev',await S());
// click side card
const box=await p.evaluate(()=>{const c=document.querySelectorAll('[data-card]')[1].getBoundingClientRect();return [c.x+c.width/2,c.y+c.height/3]});
await p.mouse.click(...box);await p.waitForTimeout(1000);log('click side',await S());
await p.screenshot({path:'/tmp/claude-0/qa/proj.png'});
// wheel
await p.mouse.move(720,350);const sl0=await p.evaluate(()=>document.querySelector('[data-track]').scrollLeft);await p.mouse.wheel(0,300);await p.waitForTimeout(500);log('wheel',[sl0,await p.evaluate(()=>document.querySelector('[data-track]').scrollLeft)]);
// wheel at end -> page scrolls
await p.keyboard.press('End');await p.focus('[data-track]');await p.keyboard.press('End');await p.waitForTimeout(1200);
const sy=await p.evaluate(()=>scrollY);await p.mouse.move(720,350);await p.mouse.wheel(0,400);await p.waitForTimeout(500);log('wheel at end',[sy,await p.evaluate(()=>scrollY),await S()]);
await p.evaluate(()=>scrollTo(0,0));
await p.keyboard.press('Home');await p.waitForTimeout(1000);
await p.mouse.wheel(0,-400);await p.waitForTimeout(300);
// Enter lock
await p.focus('[data-track]');await p.keyboard.press('ArrowRight');await p.waitForTimeout(900);const s1=await S();
await p.keyboard.press('Enter');await p.waitForTimeout(1800);log('enter',[s1.hash,p.url()]);
await p.screenshot({path:'/tmp/claude-0/qa/build.png'});
const back=await p.$$eval('a',as=>as.filter(a=>/back to the selector/i.test(a.textContent)).map(a=>a.getAttribute('href')));log('back links',back);
await p.click('text=/back to the selector/i >> nth=0');await p.waitForTimeout(1500);
log('after back',[p.url(),await S(),await p.evaluate(()=>{const t=document.querySelector('[data-track]');const c=document.querySelectorAll('[data-card]')[+document.querySelector('[data-pos]').textContent-1].getBoundingClientRect();return Math.round(c.x+c.width/2-innerWidth/2)})]);
await p.goBack();await p.waitForTimeout(1200);log('browser back',[p.url()]);
await p.goForward();await p.waitForTimeout(1500);log('browser fwd',[p.url(),await S()]);
// space & button
await p.focus('[data-track]');await p.keyboard.press('ArrowRight');await p.waitForTimeout(800);await p.keyboard.press('Space');await p.waitForTimeout(1800);log('space',p.url());
await p.goto(B+'/projects#'+(await p.evaluate(()=>1,0)||''));
await p.goto(B+'/projects');await p.waitForTimeout(800);await p.click('[data-lock]');await p.waitForTimeout(1800);log('button',p.url());
// direct hash
await p.goto(B+'/projects#nonexistent');await p.waitForTimeout(800);log('bad hash',await S());
log('errs',p.errs);
// mobile
let m=await mk({viewport:{width:390,height:844},hasTouch:true,isMobile:true});await m.goto(B+'/projects');await m.waitForTimeout(900);
const MS=()=>m.evaluate(()=>({pos:document.querySelector('[data-pos]').textContent,sl:document.querySelector('[data-track]').scrollLeft,sw:document.querySelector('[data-track]').scrollWidth}));
log('m init',await MS());
await m.evaluate(()=>document.querySelector('[data-track]').scrollBy({left:330,behavior:'instant'}));await m.waitForTimeout(700);log('m scrolled',await MS());
await m.screenshot({path:'/tmp/claude-0/qa/proj-m.png'});
const t=await m.evaluate(()=>{const c=document.querySelector('[data-card][aria-selected=true] .card-img').getBoundingClientRect();return [c.x+c.width/2,c.y+c.height/2]});
await m.touchscreen.tap(...t);await m.waitForTimeout(1800);log('m tap',m.url());log('m errs',m.errs);
// reduced
let r=await mk({reducedMotion:'reduce'});await r.goto(B+'/projects');await r.waitForTimeout(800);
log('rm',await r.evaluate(()=>({disp:getComputedStyle(document.querySelector('[data-track]')).display,cols:getComputedStyle(document.querySelector('[data-track]')).gridTemplateColumns,links:[...document.querySelectorAll('[data-card] a')].length,sw:document.documentElement.scrollWidth,hash:location.hash})));
await r.screenshot({path:'/tmp/claude-0/qa/proj-rm.png',fullPage:true});
await r.click('[data-card] [data-name-link] >> nth=2');await r.waitForTimeout(1200);log('rm click',r.url());log('rm errs',r.errs);
await br.close();})();
