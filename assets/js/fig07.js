/* Lesson 7 live figure: the allocator learns. It replays the lesson's own learned policy at a budget of 0.6 on the
   trained toy layer: per part, the probability to keep it, over the 40 iterations; per iteration, the 8 sampled
   configurations' costs before the budget repair (hollow) and after it (filled), and the best validation accuracy. */
import { mountAnimation, svgEl, lerp } from "./anim.js";
import { fmt } from "./common.js";

const BUDGET = 0.6, ITERS = 40;
const fig = document.getElementById("fig7");
const svg = fig.querySelector("svg");
svg.setAttribute("viewBox", "0 0 640 300");
const wait = svgEl("text", { x: 320, y: 150, "text-anchor": "middle", style: "fill:var(--color-muted)" }, svg);
wait.textContent = "The toy layer trains in the lesson below. The figure starts when it is ready.";

async function start(toy) {
  wait.textContent = "Recording the search...";
  const rec = [];
  await toy.learnedPolicy(BUDGET, 200, (r) => rec.push(r));
  wait.remove();
  const P = toy.P, H = toy.H;
  // keep probabilities, one bar per part
  svgEl("text", { x: 20, y: 22, style: "font-weight:700" }, svg).textContent = "Probability to keep each part";
  const bw = 600 / P;
  const bars = [...Array(P)].map((_, i) => {
    const x = 20 + i * bw;
    svgEl("rect", { x: x + 2, y: 40, width: bw - 4, height: 110, rx: 3, style: "fill:var(--color-code-bg)" }, svg);
    const r = svgEl("rect", { x: x + 2, y: 150, width: bw - 4, height: 0, rx: 3, style: `fill:${i < H ? "var(--client-1)" : "var(--client-3)"}` }, svg);
    svgEl("text", { x: x + bw / 2, y: 168, "text-anchor": "middle", style: "font-size:12px" }, svg).textContent = i < H ? `H${i + 1}` : `${i - H + 1}`;
    return r;
  });
  svgEl("text", { x: 20, y: 186, style: "fill:var(--color-muted);font-size:13px" }, svg).textContent = "H = head, numbers = feed-forward neurons";
  // cost axis with the budget line
  const AX = 20, AW = 600, AY = 240, CX = (c) => AX + c * AW;
  svgEl("line", { x1: AX, x2: AX + AW, y1: AY, y2: AY, style: "stroke:var(--color-muted)" }, svg);
  svgEl("line", { x1: CX(BUDGET), x2: CX(BUDGET), y1: AY - 48, y2: AY + 8, style: "stroke:var(--color-accent);stroke-width:3" }, svg);
  svgEl("text", { x: CX(BUDGET) + 6, y: AY - 36, style: "fill:var(--color-accent);font-weight:700" }, svg).textContent = "budget 0.6";
  svgEl("text", { x: AX, y: AY + 26, style: "fill:var(--color-muted)" }, svg).textContent = "cost 0";
  svgEl("text", { x: AX + AW, y: AY + 26, "text-anchor": "end", style: "fill:var(--color-muted)" }, svg).textContent = "full cost";
  const raw = [...Array(8)].map((_, j) => svgEl("circle", { r: 6, cy: AY - 8 - (j % 4) * 4, style: "fill:none;stroke:var(--color-text);stroke-width:2" }, svg));
  const fixed = [...Array(8)].map((_, j) => svgEl("circle", { r: 6, cy: AY - 8 - (j % 4) * 4, style: "fill:var(--color-primary)" }, svg));
  const best = svgEl("text", { x: AX + AW, y: 22, "text-anchor": "end", style: "font-weight:700" }, svg);
  const it0 = rec[0].p.map(() => 0.7);       // the policy starts at 0.7 for every part

  function draw(pos) {
    const k = Math.min(Math.floor(pos), ITERS), t = pos - k;
    const pa = k === 0 ? it0 : rec[k - 1].p, pb = k >= ITERS ? pa : rec[k].p;
    bars.forEach((r, i) => {
      const v = k >= ITERS ? pa[i] : lerp(pa[i], pb[i], t);
      r.setAttribute("y", 150 - 110 * v); r.setAttribute("height", 110 * v);
    });
    // between states k and k + 1, iteration k + 1 samples 8 configurations and the repair pulls them under the budget
    const moving = k < ITERS && t > 0;
    const cur = moving ? rec[k] : rec[Math.max(0, k - 1)];
    const f = moving ? Math.min(1, t * 1.6) : 1;
    const show = moving || k > 0 ? 1 : 0;
    raw.forEach((c, j) => { c.setAttribute("cx", CX(cur.samples[j].raw)); c.setAttribute("opacity", show); });
    fixed.forEach((c, j) => {
      const sm = cur.samples[j];
      c.setAttribute("cx", CX(lerp(sm.raw, sm.fixed, f)));
      c.setAttribute("opacity", show);
    });
    best.textContent = k === 0 && !moving ? "iteration 0" : `iteration ${moving ? k + 1 : k} of ${ITERS}, best validation accuracy ${fmt(100 * cur.bestVal, 1)}%`;
  }
  function summary(i) {
    if (i === 0) return "Before the search: every part has a keep probability of 0.7.";
    const r = rec[i - 1], over = r.samples.filter((s) => s.raw > BUDGET + 1e-9).length;
    return `Iteration ${i} of ${ITERS}: ${over} of 8 sampled configurations cost more than the budget, and the repair step made them fit. Best validation accuracy so far ${fmt(100 * r.bestVal, 1)}%.`;
  }
  mountAnimation(fig, { n: ITERS + 1, draw, summary, duration: 450 });
}

if (window.__toy7) start(window.__toy7);
else window.addEventListener("toy7-ready", () => start(window.__toy7), { once: true });
