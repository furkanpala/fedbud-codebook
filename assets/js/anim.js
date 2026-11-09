/* FedBUD codebook: one engine for the live figures of the lessons.
   A figure is a list of states (0 .. n-1). The figure's draw(pos) paints any position between two states, so the
   engine can tween, jump, cancel or restart at any moment and the picture is always right for the position.
   - Play / Pause, Step, Restart and a speed choice, all native controls, so the keyboard works without extra code.
   - The figure plays once when it first scrolls into view and stops on its final state. Play replays it.
   - It pauses when the tab is hidden or the figure leaves the screen. It does not loop.
   - With prefers-reduced-motion: reduce, the figure opens on its final state, does not play by itself, and moves
     from state to state without tweening.
   - Each state change writes one sentence to a polite live region. */

const reduceQuery = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };

export const SVGNS = "http://www.w3.org/2000/svg";
export function svgEl(name, attrs = {}, parent) {
  const e = document.createElementNS(SVGNS, name);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (parent) parent.appendChild(e);
  return e;
}
export const lerp = (a, b, t) => a + (b - a) * t;
export const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
export const clamp01 = (t) => Math.max(0, Math.min(1, t));

/* mountAnimation(figure, spec)
   spec.n          number of states
   spec.draw(pos)  paint the figure at position pos in [0, n-1]
   spec.summary(i) one sentence for state i
   spec.duration   ms from one state to the next at 1x (a number or a function of the state index)
   Returns { refresh(), restart(), pause(), get pos() } for figures whose data change. */
export function mountAnimation(fig, spec) {
  const n = spec.n;
  const durationOf = (i) => (typeof spec.duration === "function" ? spec.duration(i) : spec.duration || 1100);
  let pos = 0, playing = false, speed = 1, raf = 0, last = 0, autoplayed = false, lastAnnounced = -1, pausedByView = false;

  // on a narrow screen the drawing keeps a readable size and scrolls sideways inside its own box
  const svgNode = fig.querySelector("svg");
  if (svgNode && !svgNode.parentNode.classList.contains("anim-canvas")) {
    const wrap = document.createElement("div");
    wrap.className = "anim-canvas";
    svgNode.parentNode.insertBefore(wrap, svgNode);
    wrap.appendChild(svgNode);
    const vb = svgNode.viewBox && svgNode.viewBox.baseVal;
    if (vb && vb.width) svgNode.style.minWidth = Math.round(vb.width * (spec.minScale || 0.875)) + "px";
    // a visible cue when the drawing is wider than the screen: a word above it and a fading right edge
    const hint = document.createElement("p");
    hint.className = "anim-scroll-hint";
    hint.textContent = "Scroll the figure sideways →";
    hint.hidden = true;
    wrap.parentNode.insertBefore(hint, wrap);
    const focusIfScrolls = () => {
      const scrolls = wrap.scrollWidth > wrap.clientWidth + 1;
      hint.hidden = !scrolls;
      wrap.classList.toggle("scrolls", scrolls);
      wrap.classList.toggle("at-end", wrap.scrollLeft + wrap.clientWidth >= wrap.scrollWidth - 2);
      if (scrolls) { wrap.tabIndex = 0; wrap.setAttribute("role", "region"); wrap.setAttribute("aria-label", "Figure, scroll sideways to see all of it"); }
      else { wrap.removeAttribute("tabindex"); wrap.removeAttribute("role"); wrap.removeAttribute("aria-label"); }
    };
    focusIfScrolls();
    window.addEventListener("resize", focusIfScrolls);
    wrap.addEventListener("scroll", focusIfScrolls, { passive: true });
  }
  const bar = document.createElement("div");
  bar.className = "anim-controls";
  bar.innerHTML =
    '<button class="btn" type="button" data-anim="play">Play</button>' +
    '<button class="btn secondary" type="button" data-anim="step">Step</button>' +
    '<button class="btn secondary" type="button" data-anim="restart">Restart</button>' +
    '<label class="anim-speed">Speed <select data-anim="speed"><option value="0.5">0.5×</option><option value="1" selected>1×</option><option value="2">2×</option></select></label>';
  const status = document.createElement("p");
  status.className = "anim-status";
  status.setAttribute("aria-live", "polite");
  const cap = fig.querySelector("figcaption");
  fig.insertBefore(bar, cap || null);
  fig.insertBefore(status, cap || null);
  const playBtn = bar.querySelector('[data-anim="play"]');

  function announce(i) {
    if (i === lastAnnounced) return;
    lastAnnounced = i;
    status.textContent = `Step ${i + 1} of ${n}. ${spec.summary(i)}`;
  }
  function paint() { spec.draw(pos); }
  function setPlaying(p) {
    playing = p;
    playBtn.textContent = p ? "Pause" : (pos >= n - 1 ? "Replay" : "Play");
    if (p) { last = performance.now(); raf = requestAnimationFrame(tick); }
    else cancelAnimationFrame(raf);
  }
  function tick(ts) {
    if (!playing) return;
    // the first frame's timestamp can be a little earlier than the press of Play, so the time step is clamped at zero
    const dt = Math.max(0, Math.min(ts - last, 100));
    last = ts;
    const i = Math.floor(pos);
    if (reduceQuery.matches) {
      // no tween: hold each state, then jump to the next one
      tick.hold = (tick.hold || 0) + dt * speed;
      if (tick.hold >= durationOf(i)) { tick.hold = 0; pos = Math.min(i + 1, n - 1); }
    } else {
      pos = Math.max(0, Math.min(pos + (dt * speed) / durationOf(i), n - 1));
    }
    paint();
    announce(Math.floor(pos + 1e-9));
    if (pos >= n - 1) { setPlaying(false); return; }
    raf = requestAnimationFrame(tick);
  }
  function play() {
    if (pos >= n - 1) { pos = 0; paint(); announce(0); }
    setPlaying(true);
  }
  function step() {
    if (playing) setPlaying(false);
    pos = pos >= n - 1 ? 0 : Math.min(Math.floor(pos + 1e-9) + 1, n - 1);
    paint();
    announce(Math.round(pos));
    playBtn.textContent = pos >= n - 1 ? "Replay" : "Play";
  }
  function restart() {
    lastAnnounced = -1;            // the figure's data may have changed (client or mode), so announce state 0 again
    const was = playing;
    setPlaying(false);
    pos = 0; paint(); announce(0);
    if (was && !reduceQuery.matches) setPlaying(true);
    else playBtn.textContent = "Play";
  }

  // once a student uses a control, the figure no longer starts by itself
  bar.addEventListener("click", (e) => { if (e.target.closest("button")) autoplayed = true; });
  fig.addEventListener("click", (e) => { if (e.target.closest("button") && !bar.contains(e.target)) autoplayed = true; });
  playBtn.addEventListener("click", () => { pausedByView = false; playing ? setPlaying(false) : play(); });
  bar.querySelector('[data-anim="step"]').addEventListener("click", () => { pausedByView = false; step(); });
  bar.querySelector('[data-anim="restart"]').addEventListener("click", () => { pausedByView = false; restart(); });
  bar.querySelector('[data-anim="speed"]').addEventListener("change", (e) => { speed = Number(e.target.value); });
  document.addEventListener("visibilitychange", () => { if (document.hidden && playing) setPlaying(false); });

  if (reduceQuery.matches) { pos = n - 1; paint(); announce(n - 1); playBtn.textContent = "Replay"; }
  else { paint(); status.textContent = `${n} steps. ${spec.summary(0)}`; }

  if ("IntersectionObserver" in window) {
    new IntersectionObserver((entries) => {
      for (const en of entries) {
        if (en.isIntersecting && !autoplayed && !reduceQuery.matches) { autoplayed = true; play(); }
        else if (en.isIntersecting && pausedByView) { pausedByView = false; setPlaying(true); }   // resume on return
        else if (!en.isIntersecting && playing) { pausedByView = true; setPlaying(false); }
      }
    }, { threshold: 0.5 }).observe(fig);
  }

  return {
    refresh: () => { paint(); lastAnnounced = -1; announce(Math.floor(pos + 1e-9)); },
    restart,
    pause: () => setPlaying(false),
    get pos() { return pos; },
  };
}
