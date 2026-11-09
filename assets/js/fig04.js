/* Lesson 4 live figure: the toy layer comes apart. The paper's block actions apply one by one (attention: keep all or
   half or drop; feed-forward: keep all, half or a quarter, or drop), the parts with the lowest toy scores go first,
   and the cost per token falls. Costs from the toy layer: a head costs 256 multiplications per token, a neuron 32. */
import { mountAnimation, svgEl, lerp, ease } from "./anim.js";
import { H, F, HEAD_COST, NEURON_COST, FULL_COST } from "./toy-transformer.js";
import { fmt } from "./common.js";

// toy scores, only to order the parts inside each block (Lesson 6 computes real ones)
const HEAD_RANK = [2, 0, 3, 1];                                   // heads in order of falling score
const NEUR_RANK = [5, 12, 1, 9, 14, 3, 7, 10, 0, 15, 6, 11, 2, 13, 8, 4];
const STATES = [                                                   // heads kept, neurons kept, label
  { h: 4, f: 16, say: "The full layer: 4 attention heads and 16 feed-forward neurons." },
  { h: 2, f: 16, say: "The attention block keeps half of its heads, the two with the highest scores." },
  { h: 2, f: 8, say: "The feed-forward block keeps half of its neurons." },
  { h: 2, f: 4, say: "The feed-forward block keeps a quarter of its neurons." },
  { h: 2, f: 0, say: "The feed-forward block is dropped. Its input passes on unchanged. The attention block stays, because a sub-network needs at least one attention block." },
];
const costOf = (s) => (s.h * HEAD_COST + s.f * NEURON_COST) / FULL_COST;

const fig = document.getElementById("fig4");
const svg = fig.querySelector("svg");
svg.setAttribute("viewBox", "0 0 640 300");
svgEl("text", { x: 20, y: 28, style: "font-weight:700" }, svg).textContent = "Attention block";
svgEl("text", { x: 20, y: 138, style: "font-weight:700" }, svg).textContent = "Feed-forward block";
const heads = [...Array(H)].map((_, i) => {
  const g = svgEl("g", {}, svg);
  svgEl("rect", { x: 20 + i * 150, y: 40, width: 130, height: 54, rx: 8, style: "fill:var(--client-1)" }, g);
  svgEl("text", { x: 85 + i * 150, y: 73, "text-anchor": "middle", style: "fill:#fff;font-weight:700" }, g).textContent = `head ${i + 1}`;
  return g;
});
const bypass = svgEl("path", { d: "M20,212 C220,230 420,230 620,212", style: "fill:none;stroke:var(--color-accent);stroke-width:3;stroke-dasharray:6 5" }, svg);
const bypassLab = svgEl("text", { x: 320, y: 238, "text-anchor": "middle", style: "fill:var(--color-accent);font-weight:700" }, svg);
const neurons = [...Array(F)].map((_, j) => svgEl("rect", { x: 20 + j * 37.5, y: 150, width: 31, height: 54, rx: 5, style: "fill:var(--client-3)" }, svg));
svgEl("rect", { x: 20, y: 250, width: 600, height: 16, rx: 6, style: "fill:var(--color-code-bg)" }, svg);
const meter = svgEl("rect", { x: 20, y: 250, width: 600, height: 16, rx: 6, style: "fill:var(--color-primary)" }, svg);
const meterLab = svgEl("text", { x: 20, y: 290, style: "font-weight:700" }, svg);

function draw(pos) {
  const i = Math.min(Math.floor(pos), STATES.length - 2), t = pos >= STATES.length - 1 ? 1 : ease(pos - i);
  const a = STATES[i], b = STATES[i + 1];
  HEAD_RANK.forEach((h, r) => {
    const keepA = r < a.h ? 1 : 0, keepB = r < b.h ? 1 : 0;
    heads[h].setAttribute("opacity", 0.12 + 0.88 * lerp(keepA, keepB, t));
  });
  NEUR_RANK.forEach((j, r) => {
    const keepA = r < a.f ? 1 : 0, keepB = r < b.f ? 1 : 0;
    neurons[j].setAttribute("opacity", 0.12 + 0.88 * lerp(keepA, keepB, t));
  });
  const dropped = lerp(a.f === 0 ? 1 : 0, b.f === 0 ? 1 : 0, t);
  bypass.setAttribute("opacity", dropped);
  bypassLab.textContent = dropped > 0.5 ? "skipped: the input passes on" : "";
  const c = lerp(costOf(a), costOf(b), t);
  meter.setAttribute("width", 600 * c);
  meterLab.textContent = `cost per token: ${fmt(100 * c, 0)}% of the full layer`;
}
const summary = (i) => `${STATES[i].say} Cost ${fmt(100 * costOf(STATES[i]), 0)}%.`;
mountAnimation(fig, { n: STATES.length, draw, summary, duration: 1300 });
