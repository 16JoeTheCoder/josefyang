const { chromium } = require('playwright');
const B='http://localhost:4321';
const log=(k,v)=>console.log(k+': '+JSON.stringify(v));
(async()=>{
const br=await chromium.launch();
async function mk(opts={}){const ctx=await br.newContext({viewport:{width:1440,height:900},...opts});const p=await ctx.newPage();p.errs=[];p.on('pageerror',e=>p.errs.push('PE '+e.message));p.on('console',m=>{if(m.type()==='error')p.errs.push('CE '+m.text())});return p;}
const H=p=>p.evaluate(()=>({vis:[...document.querySelectorAll('[data-slip]')].filter(s=>!s.hidden).map(s=>s.dataset.slip),wait:document.querySelector('[data-wait]').hidden,pressed:[...document.querySelectorAll('[data-tile]')].map(t=>t.getAttribute('aria-pressed')).join(','),tiles:document.querySelectorAll('[data-tile]').length,op:[...document.querySelectorAll('[data-tile]')].map(t=>getComputedStyle(t).opacity).join(',')}));
let p=await mk();await p.goto(B+'/failures');await p.waitForTimeout(900);
log('init',await H(p));await p.screenshot({path:'/tmp/claude-0/qa/fail.png'});
await p.click('[data-tile]:nth-of-type(2)');await p.waitForTimeout(2500);log('click tile2',await H(p));
await p.click('[data-feed]');await p.waitForTimeout(2500);log('feed btn',await H(p));
// click rapidly twice
// drag
const tiles=await p.$$('[data-tile]');
async function drag(i,to){const b=await tiles[i].boundingBox();const m=await (await p.$('[data-mouth]')).boundingBox();await p.mouse.move(b.x+b.width/2,b.y+b.height/2);await p.mouse.down();const tx=to==='mouth'?m.x+m.width/2:50,ty=to==='mouth'?m.y+20:850;await p.mouse.move((b.x+tx)/2,(b.y+ty)/2,{steps:5});await p.mouse.move(tx,ty,{steps:8});await p.mouse.up();await p.waitForTimeout(2500);}
await drag(2,'mouth');log('drag to mouth tile3',await H(p));
await drag(3,'nowhere');const t3=await p.evaluate(()=>{const t=document.querySelectorAll('[data-tile]')[3];return [gsap_x(t)]; function gsap_x(t){return t.style.transform}});log('drag elsewhere',[await H(p),t3]);
// keyboard
await p.reload();await p.waitForTimeout(800);
await p.focus('[data-tile]');await p.keyboard.press('Tab');log('focus2 pressed',(await H(p)).pressed);
await p.keyboard.press('Enter');await p.waitForTimeout(2000);log('enter tile',await H(p));
await p.reload();await p.waitForTimeout(800);
const order=[];await p.focus('[data-tile]');for(let i=0;i<7;i++){await p.keyboard.press('Tab');order.push(await p.evaluate(()=>document.activeElement.textContent.trim().slice(0,20)));}log('tab order',order);
await p.focus('[data-feed]');await p.keyboard.press('Enter');await p.waitForTimeout(2000);log('kbd feed',await H(p));
// busy double
await p.click('[data-tile]:nth-of-type(1)');await p.click('[data-tile]:nth-of-type(3)',{force:true}).catch(e=>log('dbl click err',e.message.slice(0,80)));await p.waitForTimeout(2500);log('double',await H(p));
log('errs',p.errs);
// mobile
let m=await mk({viewport:{width:390,height:844},hasTouch:true,isMobile:true});await m.goto(B+'/failures');await m.waitForTimeout(900);
await m.screenshot({path:'/tmp/claude-0/qa/fail-m.png',fullPage:true});
log('m overflow',await m.evaluate(()=>[document.scrollingElement.scrollWidth,innerWidth]));
await m.tap('[data-tile]');await m.waitForTimeout(2500);log('m tap',await H(m));
await m.screenshot({path:'/tmp/claude-0/qa/fail-m2.png'});
log('m tiles overlap',await m.evaluate(()=>{const r=[...document.querySelectorAll('[data-tile]')].map(t=>t.getBoundingClientRect());let o=0;for(let i=0;i<r.length;i++)for(let j=i+1;j<r.length;j++){const a=r[i],b=r[j];if(a.left<b.right&&b.left<a.right&&a.top<b.bottom&&b.top<a.bottom)o++}return {o,n:r.length,out:r.filter(x=>x.right>innerWidth||x.left<0).length}}));
log('m errs',m.errs);
// reduced
let r=await mk({reducedMotion:'reduce'});await r.goto(B+'/failures');await r.waitForTimeout(800);
log('rm',await r.evaluate(()=>({stage:getComputedStyle(document.querySelector('[data-stage]')).display,tile:getComputedStyle(document.querySelector('[data-tile]')).display,list:getComputedStyle(document.querySelector('.hop-list')).display,details:document.querySelectorAll('details').length,wait:getComputedStyle(document.querySelector('[data-wait]')).display})));
await r.screenshot({path:'/tmp/claude-0/qa/fail-rm.png',fullPage:true});
await r.click('.li-slip summary');log('rm open',await r.evaluate(()=>document.querySelector('.li-slip').open));log('rm errs',r.errs);
// about
p=await mk();await p.goto(B+'/about');await p.waitForTimeout(800);
const R=()=>p.evaluate(()=>({p:document.querySelector('[data-rig]').style.getPropertyValue('--p'),c:document.querySelector('[data-rig-count]').textContent,pending:document.querySelectorAll('[data-ms].is-pending').length,sy:scrollY}));
log('about top',await R());
const seq=[];const rigTop=await p.evaluate(()=>{const r=document.querySelector('[data-rig]').getBoundingClientRect();return [r.top+scrollY,r.height]});log('rigbox',rigTop);
for(let y=rigTop[0]-900;y<rigTop[0]+rigTop[1];y+=150){await p.evaluate(y=>scrollTo(0,y),y);await p.waitForTimeout(200);const s=await R();seq.push(s.p+'/'+s.c+'/'+s.pending);}
log('seq',seq);await p.screenshot({path:'/tmp/claude-0/qa/rig.png'});
await p.evaluate(()=>scrollTo(0,0));await p.waitForTimeout(300);log('scroll back up',await R());
// load scrolled
await p.evaluate(()=>scrollTo(0,document.body.scrollHeight));await p.waitForTimeout(300);log('bottom',await R());
log('about errs',p.errs);
r=await mk({reducedMotion:'reduce'});await r.goto(B+'/about');await r.waitForTimeout(800);
log('rm about',await r.evaluate(()=>({p:getComputedStyle(document.querySelector('[data-rig]')).getPropertyValue('--p'),c:document.querySelector('[data-rig-count]').textContent,pending:document.querySelectorAll('.is-pending').length})));
// mobile about
m=await mk({viewport:{width:390,height:844}});await m.goto(B+'/about');await m.waitForTimeout(800);await m.evaluate(()=>document.querySelector('[data-rig]').scrollIntoView());await m.waitForTimeout(500);log('m about',await m.evaluate(()=>[document.querySelector('[data-rig]').style.getPropertyValue('--p'),document.querySelector('[data-rig-count]').textContent]));await m.screenshot({path:'/tmp/claude-0/qa/rig-m.png'});
// devlog
p=await mk();await p.goto(B+'/devlog');await p.waitForTimeout(800);
const D=()=>p.evaluate(()=>({pressed:[...document.querySelectorAll('[data-filter]')].map(c=>c.dataset.filter+':'+c.getAttribute('aria-pressed')),entries:[...document.querySelectorAll('[data-entry]')].filter(e=>!e.hidden&&e.offsetParent).length,total:document.querySelectorAll('[data-entry]').length,months:[...document.querySelectorAll('[data-month]')].filter(m=>!m.hidden).length,allm:document.querySelectorAll('[data-month]').length}));
log('devlog init',await D());
const fs=await p.$$eval('[data-filter]',c=>c.map(x=>x.dataset.filter));
for(const f of fs){await p.click(`[data-filter="${f}"]`);log('filter '+f,await D());}
await p.click('[data-filter="all"]');log('all',await D());
await p.focus('[data-filter="chronos"]');await p.keyboard.press('Enter');log('kbd',(await D()).pressed.join(' '));
log('devlog errs',p.errs);
await br.close();})();
