'use strict';
/* A small Slowpoke that ambles around the top bar on its own.
   Drag it anywhere; it carries on wandering from where you drop it. Tap it for a hop. */
(function () {
  const W = 72, H = 28;                       // sprite size in px
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.min(Math.max(v, a), Math.max(a, b));

  const root = document.createElement('div');
  root.id = 'slowpoke';
  root.setAttribute('role', 'img');
  root.setAttribute('aria-label', 'Slowpoke');
  root.innerHTML = '<div class="sp-flip"><img class="sp-img" src="icons/slowpoke.png" alt="" draggable="false"></div>';
  document.body.appendChild(root);
  const flip = root.querySelector('.sp-flip');
  // If the mascot image can't load (missing upload, stale cache), hide it instead of showing a broken-image box.
  root.querySelector('.sp-img').addEventListener('error', () => root.remove());

  let x = 0, y = 0, homeY = 0, dragging = false, timer = 0, facingRight = false;

  // Stand on the bottom edge of the top bar (falls back to the top of the screen).
  function rightLimit() { const l = document.querySelector('.bar .language'); return l ? Math.max(8, l.getBoundingClientRect().left - W - 6) : innerWidth - W - 4; }
  function barBottom() { const b = document.querySelector('.bar'); return b ? b.getBoundingClientRect().bottom : 56; }
  const place = () => { root.style.transform = `translate3d(${x}px,${y}px,0)`; };
  const face = right => { if (right !== facingRight) { facingRight = right; flip.style.transform = right ? 'scaleX(-1)' : ''; } };

  function wander() {
    clearTimeout(timer);
    if (dragging || reduce || document.hidden) { timer = setTimeout(wander, 3000); return; }
    const tx = clamp(x + rnd(-170, 170), 4, rightLimit());
    const ty = clamp(homeY - rnd(0, 14), 0, innerHeight - H);
    const dist = Math.hypot(tx - x, ty - y);
    if (dist < 12) { timer = setTimeout(wander, 600); return; }
    const secs = dist / rnd(20, 36);          // slowpoke is not in a hurry
    face(tx > x);
    root.classList.add('walking');
    root.style.transition = `transform ${secs}s linear`;
    x = tx; y = ty; place();
    timer = setTimeout(() => {
      root.classList.remove('walking');
      timer = setTimeout(wander, rnd(1500, 5500));   // yawn, stare into space…
    }, secs * 1000);
  }

  // ---- dragging ----
  let dx = 0, dy = 0, moved = false, lastX = 0;
  root.addEventListener('pointerdown', e => {
    clearTimeout(timer);
    const r = root.getBoundingClientRect();    // current spot, even mid-walk
    x = r.left; y = r.top;
    root.style.transition = 'none'; place();
    dragging = true; moved = false; lastX = e.clientX;
    dx = e.clientX - x; dy = e.clientY - y;
    root.classList.remove('walking'); root.classList.add('held');
    root.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  root.addEventListener('pointermove', e => {
    if (!dragging) return;
    if (Math.abs(e.clientX - lastX) > 1) { face(e.clientX > lastX); lastX = e.clientX; }
    x = clamp(e.clientX - dx, 0, innerWidth - W);
    y = clamp(e.clientY - dy, 0, innerHeight - H);
    moved = true; place();
  });
  const drop = () => {
    if (!dragging) return;
    dragging = false; root.classList.remove('held');
    if (moved) homeY = y; else { root.classList.remove('hop'); void root.offsetWidth; root.classList.add('hop'); }
    timer = setTimeout(wander, moved ? 2500 : 1200);
  };
  root.addEventListener('pointerup', drop);
  root.addEventListener('pointercancel', drop);

  addEventListener('resize', () => {
    x = clamp(x, 0, innerWidth - W); y = clamp(y, 0, innerHeight - H);
    root.style.transition = 'none'; place();
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && !dragging) { clearTimeout(timer); timer = setTimeout(wander, 800); } });

  // start at a random spot along the top bar
  homeY = Math.max(0, barBottom() - H + 8);
  x = rnd(8, Math.max(9, rightLimit())); y = homeY;
  root.style.transition = 'none'; place();
  timer = setTimeout(wander, 1200);
})();
