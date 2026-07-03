/* ================================================================
   FOR KHUSHI — shared behavior across all pages
================================================================= */

/* ---------- starfield generation ---------- */
(function(){
  // decorative only, CSS handles the dot pattern; nothing to do here,
  // kept as a hook in case a denser JS-generated field is wanted later.
})();

/* ---------- nav: scroll shrink + mobile toggle + active link ---------- */
(function(){
  const nav = document.getElementById('site-nav');
  const toggle = document.getElementById('nav-toggle');
  const links = document.getElementById('nav-links');

  window.addEventListener('scroll', ()=>{
    if(window.scrollY > 40) nav.classList.add('scrolled');
    else nav.classList.remove('scrolled');
  });

  if(toggle && links){
    toggle.addEventListener('click', ()=> links.classList.toggle('open'));
    links.querySelectorAll('a').forEach(a=> a.addEventListener('click', ()=> links.classList.remove('open')));
  }

  const here = document.body.dataset.page;
  document.querySelectorAll('.nav-links a, .chapter-nav a').forEach(a=>{
    if(a.dataset.page === here) a.classList.add('active');
  });
})();

/* ---------- golden thread scroll progress ---------- */
(function(){
  const fill = document.getElementById('thread-fill');
  const star = document.getElementById('thread-star');
  if(!fill || !star) return;
  function update(){
    const h = document.documentElement;
    const scrolled = h.scrollTop;
    const max = h.scrollHeight - h.clientHeight;
    const pct = max > 0 ? (scrolled / max) * 100 : 0;
    fill.style.height = pct + '%';
    star.style.top = pct + '%';
  }
  document.addEventListener('scroll', update);
  window.addEventListener('resize', update);
  update();
})();

/* ---------- scroll reveal ---------- */
(function(){
  const els = document.querySelectorAll('[data-r]');
  if(!els.length) return;
  const io = new IntersectionObserver((entries)=>{
    entries.forEach(e=>{ if(e.isIntersecting) e.target.classList.add('in'); });
  }, { threshold:0.15 });
  els.forEach(el=> io.observe(el));
})();

/* ---------- loader typing sequence (home page only) ---------- */
function typeLines(lines, el, onDone){
  let li = 0;
  function typeLine(){
    if(li >= lines.length){ onDone && onDone(); return; }
    const line = lines[li];
    let ci = 0;
    el.innerHTML = '<span class="typed"></span><span class="cursor">&nbsp;</span>';
    const typedSpan = el.querySelector('.typed');
    const iv = setInterval(()=>{
      typedSpan.textContent = line.slice(0, ++ci);
      if(ci >= line.length){
        clearInterval(iv);
        setTimeout(()=>{ li++; typeLine(); }, 700);
      }
    }, 42);
  }
  typeLine();
}

/* ---------- counters (used on our-story.html) ---------- */
(function(){
  const countersSection = document.getElementById('counters');
  if(!countersSection) return;
  let started = false;
  function animate(){
    if(started) return;
    started = true;
    countersSection.querySelectorAll('.count-num').forEach(c=>{
      const target = parseInt(c.dataset.count, 10);
      const dur = 2200;
      const start = performance.now();
      function step(t){
        const p = Math.min((t - start) / dur, 1);
        const eased = 1 - Math.pow(1-p, 3);
        c.textContent = Math.floor(eased * target).toLocaleString();
        if(p < 1) requestAnimationFrame(step);
        else c.textContent = target.toLocaleString();
      }
      requestAnimationFrame(step);
    });
  }
  new IntersectionObserver((entries)=>{
    entries.forEach(e=>{ if(e.isIntersecting) animate(); });
  }, { threshold:0.4 }).observe(countersSection);
})();

/* ---------- background music toggle (shared <audio id="bg-music">) ---------- */
(function(){
  const audio = document.getElementById('bg-music');
  const toggleBtn = document.getElementById('music-toggle');
  if(!audio || !toggleBtn) return;

  const hasSrc = audio.querySelector('source') && audio.querySelector('source').getAttribute('src');
  if(hasSrc) toggleBtn.classList.add('ready');

  let playing = false;
  toggleBtn.addEventListener('click', ()=>{
    if(!hasSrc) return; // no track added yet — see assets/audio/README.txt
    if(playing){ audio.pause(); toggleBtn.classList.add('muted'); }
    else { audio.play().catch(()=>{}); toggleBtn.classList.remove('muted'); }
    playing = !playing;
  });

  // try a gentle autoplay on first user interaction (browsers block silent autoplay)
  function tryStart(){
    if(hasSrc && !playing){
      audio.volume = 0.5;
      audio.play().then(()=>{ playing = true; toggleBtn.classList.remove('muted'); }).catch(()=>{});
    }
    window.removeEventListener('click', tryStart);
  }
  window.addEventListener('click', tryStart, { once:true });
})();

/* ---------- confetti / balloons (used on proposal + letter pages) ---------- */
function launchConfetti(container, count = 120){
  const colors = ['#c9a769','#e7cf9f','#d99a95','#f3ead9'];
  for(let i=0;i<count;i++){
    const el = document.createElement('div');
    el.className = 'confetti';
    el.style.left = Math.random()*100 + '%';
    el.style.setProperty('--color', colors[Math.floor(Math.random()*colors.length)]);
    el.style.setProperty('--speed', (2 + Math.random()*3) + 's');
    container.appendChild(el);
    setTimeout(()=> el.remove(), 6000);
  }
}
function launchBalloons(container, count = 16){
  const colors = ['#c9a769','#e7cf9f','#d99a95','#f3ead9'];
  for(let i=0;i<count;i++){
    setTimeout(()=>{
      const el = document.createElement('div');
      el.className = 'balloon';
      el.style.left = (10 + Math.random()*80) + '%';
      el.style.setProperty('--color', colors[Math.floor(Math.random()*colors.length)]);
      el.style.setProperty('--speed', (4 + Math.random()*4) + 's');
      el.style.setProperty('--rotation', (Math.random()*20-10) + 'deg');
      container.appendChild(el);
      setTimeout(()=> el.remove(), 9000);
    }, i * 150);
  }
}
