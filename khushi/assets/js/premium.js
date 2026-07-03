/* ================================================================
   PREMIUM LAYER — behavior
   Requires GSAP + ScrollTrigger (loaded via CDN in each page's <head>)
   Loaded after main.js. Everything here is additive/defensive —
   if GSAP fails to load for any reason, the base site still works.
================================================================= */

const hasGSAP = typeof gsap !== 'undefined';
if(hasGSAP) gsap.registerPlugin(ScrollTrigger);

/* ---------- page transition veil ---------- */
(function(){
  const veil = document.createElement('div');
  veil.id = 'page-veil';
  document.body.prepend(veil);
  requestAnimationFrame(()=>{
    veil.classList.add('entering');
    setTimeout(()=> veil.classList.remove('entering'), 750);
  });

  document.querySelectorAll('a[href$=".html"]').forEach(link=>{
    link.addEventListener('click', function(e){
      const href = this.getAttribute('href');
      if(!href || href.startsWith('#') || this.target === '_blank') return;
      e.preventDefault();
      veil.classList.add('leaving');
      setTimeout(()=>{ window.location.href = href; }, 560);
    });
  });
})();

/* ---------- cursor glow + magnetic hover state ---------- */
(function(){
  if(window.matchMedia('(hover:none)').matches) return;
  const glow = document.createElement('div'); glow.id = 'cursor-glow';
  const dot = document.createElement('div'); dot.id = 'cursor-dot';
  document.body.append(glow, dot);

  let mx=0,my=0, gx=0,gy=0;
  window.addEventListener('mousemove', (e)=>{
    mx = e.clientX; my = e.clientY;
    dot.style.left = mx + 'px'; dot.style.top = my + 'px';
  });
  (function loop(){
    gx += (mx-gx)*0.08; gy += (my-gy)*0.08;
    glow.style.left = gx + 'px'; glow.style.top = gy + 'px';
    requestAnimationFrame(loop);
  })();

  document.querySelectorAll('a, button, .chapter-card, .gal-item').forEach(el=>{
    el.addEventListener('mouseenter', ()=> dot.classList.add('hovering'));
    el.addEventListener('mouseleave', ()=> dot.classList.remove('hovering'));
  });
})();

/* ---------- ambient floating particles (soft gold motes, hearts on romantic pages) ---------- */
(function(){
  const canvas = document.createElement('canvas');
  canvas.id = 'particle-canvas';
  document.body.prepend(canvas);
  const ctx = canvas.getContext('2d');
  let w,h,particles;
  const useHearts = ['letter','moment'].includes(document.body.dataset.page);

  function size(){
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
  }
  function makeParticles(){
    const count = w < 720 ? 22 : 46;
    particles = Array.from({length:count}, ()=>({
      x: Math.random()*w, y: Math.random()*h,
      r: 0.6 + Math.random()*1.8,
      vy: 0.12 + Math.random()*0.28,
      vx: -0.15 + Math.random()*0.3,
      a: 0.15 + Math.random()*0.4,
      tw: Math.random()*Math.PI*2,
      heart: useHearts && Math.random() < 0.22
    }));
  }
  size(); makeParticles();
  window.addEventListener('resize', ()=>{ size(); makeParticles(); });

  function drawHeart(x, y, s, alpha){
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.beginPath();
    ctx.moveTo(0, 3);
    ctx.bezierCurveTo(-4, -2, -8, 1, 0, 7);
    ctx.bezierCurveTo(8, 1, 4, -2, 0, 3);
    ctx.fillStyle = `rgba(217,154,149,${alpha})`;
    ctx.fill();
    ctx.restore();
  }

  function tick(){
    ctx.clearRect(0,0,w,h);
    particles.forEach(p=>{
      p.y -= p.vy; p.x += p.vx; p.tw += 0.02;
      if(p.y < -10){ p.y = h+10; p.x = Math.random()*w; }
      const flicker = p.a * (0.6 + 0.4*Math.sin(p.tw));
      if(p.heart){
        drawHeart(p.x, p.y, p.r * 1.4, flicker);
      } else {
        ctx.beginPath();
        ctx.fillStyle = `rgba(231,207,159,${flicker})`;
        ctx.arc(p.x, p.y, p.r, 0, Math.PI*2);
        ctx.fill();
      }
    });
    requestAnimationFrame(tick);
  }
  tick();
})();

/* ---------- 3D tilt on cards ---------- */
(function(){
  document.querySelectorAll('.chapter-card, .gal-item').forEach(card=>{
    card.classList.add('tilt');
    card.addEventListener('mousemove', (e)=>{
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left)/r.width - 0.5;
      const py = (e.clientY - r.top)/r.height - 0.5;
      card.style.transform = `perspective(700px) rotateX(${py*-8}deg) rotateY(${px*8}deg) translateY(-4px)`;
    });
    card.addEventListener('mouseleave', ()=>{ card.style.transform = ''; });
  });
})();

/* ---------- magnetic buttons ---------- */
(function(){
  document.querySelectorAll('.btn, .btn-magic, .play-btn, #music-toggle').forEach(btn=>{
    btn.classList.add('magnetic');
    btn.addEventListener('mousemove', (e)=>{
      const r = btn.getBoundingClientRect();
      const mx = (e.clientX - r.left - r.width/2) * 0.28;
      const my = (e.clientY - r.top - r.height/2) * 0.28;
      btn.style.transform = `translate(${mx}px, ${my}px)`;
    });
    btn.addEventListener('mouseleave', ()=>{ btn.style.transform = ''; });
  });
})();

/* ---------- split-text line reveal (used on hero headings) ---------- */
function splitReveal(el){
  if(!el) return;
  const words = el.textContent.trim().split(/\s+/);
  el.innerHTML = words.map(w=>`<span class="split-line"><span>${w}&nbsp;</span></span>`).join('');
  if(hasGSAP){
    gsap.from(el.querySelectorAll('.split-line > span'), {
      yPercent:120, opacity:0, duration:1, stagger:0.045, ease:'power4.out', delay:0.15
    });
  } else {
    el.querySelectorAll('.split-line > span').forEach(s=> s.style.opacity = 1);
  }
}

/* ---------- GSAP scroll choreography ---------- */
if(hasGSAP){
  // hero parallax drift
  gsap.utils.toArray('#hero, .page-hero').forEach(hero=>{
    gsap.to(hero, {
      backgroundPosition: '50% 30%',
      scrollTrigger: { trigger: hero, start:'top top', end:'bottom top', scrub:true }
    });
  });

  // chapter cards stagger in
  if(document.querySelector('.chapter-grid')){
    gsap.from('.chapter-card', {
      y:60, opacity:0, duration:0.9, stagger:0.12, ease:'power3.out',
      scrollTrigger:{ trigger:'.chapter-grid', start:'top 82%' }
    });
  }

  // timeline items scale/fade with scrub
  gsap.utils.toArray('.tl-item').forEach(item=>{
    gsap.from(item, {
      opacity:0, y:50, scale:0.96, duration:0.9, ease:'power3.out',
      scrollTrigger:{ trigger:item, start:'top 85%' }
    });
  });
  if(document.querySelector('.tl-line')){
    gsap.from('.tl-line', {
      scaleY:0, transformOrigin:'top', ease:'none',
      scrollTrigger:{ trigger:'.tl', start:'top 70%', end:'bottom bottom', scrub:true }
    });
  }

  // gallery grid stagger-in
  if(document.querySelector('#gallery-grid')){
    gsap.from('.gal-item', {
      opacity:0, y:40, scale:0.94, duration:0.7, stagger:0.06, ease:'power3.out',
      scrollTrigger:{ trigger:'#gallery-grid', start:'top 85%' }
    });
  }

  // counters section float-in
  if(document.querySelector('#counters')){
    gsap.from('#counters .count-num, #counters .count-label', {
      opacity:0, y:24, duration:0.8, stagger:0.1, ease:'power2.out',
      scrollTrigger:{ trigger:'#counters', start:'top 80%' }
    });
  }

  // glow-in headings
  document.querySelectorAll('.glow-in').forEach(h=>{
    ScrollTrigger.create({
      trigger:h, start:'top 75%',
      onEnter:()=> h.classList.add('lit')
    });
  });
}

/* run the hero split-text reveal once DOM is ready */
document.addEventListener('DOMContentLoaded', ()=>{
  splitReveal(document.querySelector('.hero-name'));
  splitReveal(document.querySelector('.page-title'));
});
