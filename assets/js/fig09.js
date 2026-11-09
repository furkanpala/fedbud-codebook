/* Lesson 9 live figure: the shared GNN at work. Messages pass along the graph's edges in two hops (the GNN has two
   layers), then each layer gets a scale and a shift, and the gate opens from zero. The bars follow one layer's output
   with the lesson's own numbers: output + gate x (scale x output + shift). */
import { mountAnimation, svgEl, lerp, ease, clamp01 } from "./anim.js";
import { fmt } from "./common.js";

const SHORT = ["E", "A1", "F1", "A2", "F2", "A3", "F3", "O"];
const OUT = [0.5, -1.0, 2.0, 0.0], SCALE = [0.2, -0.5, 0.1, 0.0], SHIFT = [0.1, 0.3, -0.2, 0.4];
const GATES = [0, 0.25, 0.5, 0.75, 1];
const fig = document.getElementById("fig9");
const svg = fig.querySelector("svg");
svg.setAttribute("viewBox", "0 0 640 320");
const X = (i) => 40 + i * 80, Y = 70;
const edges = [];
for (let i = 0; i < SHORT.length; i++) for (const d of [1, 2]) if (i + d < SHORT.length) edges.push([i, i + d]);
edges.forEach(([a, b]) => {
  const d = b - a === 1 ? `M${X(a) + 20},${Y} L${X(b) - 20},${Y}` : `M${X(a)},${Y - 20} Q${(X(a) + X(b)) / 2},${Y - 64} ${X(b)},${Y - 20}`;
  svgEl("path", { d, style: "fill:none;stroke:var(--color-border);stroke-width:2" }, svg);
});
const nodes = SHORT.map((s, i) => {
  const c = svgEl("circle", { cx: X(i), cy: Y, r: 20, style: "fill:var(--color-card);stroke:var(--color-primary);stroke-width:3" }, svg);
  svgEl("text", { x: X(i), y: Y + 5, "text-anchor": "middle", style: "font-weight:700" }, svg).textContent = s;
  return c;
});
const msgs = edges.map(() => svgEl("circle", { r: 5, style: "fill:var(--color-accent)" }, svg));
const film = svgEl("text", { x: 320, y: 128, "text-anchor": "middle", style: "font-weight:700;fill:var(--color-primary)" }, svg);
// one layer's output as four bars, with the gate
const BX = 100, BY = 250, BW = 90;
svgEl("line", { x1: 60, x2: 600, y1: BY, y2: BY, style: "stroke:var(--color-muted)" }, svg);
const bars = OUT.map((_, j) => {
  const ghost = svgEl("rect", { x: BX + j * 120, width: BW, rx: 4, style: "fill:none;stroke:var(--color-muted);stroke-dasharray:4 3" }, svg);
  const r = svgEl("rect", { x: BX + j * 120, width: BW, rx: 4, style: "fill:var(--client-3)" }, svg);
  const v = svgEl("text", { x: BX + j * 120 + BW / 2, "text-anchor": "middle", style: "font-weight:700" }, svg);
  return { ghost, r, v };
});
const gateLab = svgEl("text", { x: 60, y: 312, style: "font-weight:700" }, svg);
const S = 34;   // pixels per unit
const setBar = (rect, val) => { rect.setAttribute("y", val >= 0 ? BY - val * S : BY); rect.setAttribute("height", Math.abs(val) * S); };

// states: 0 graph; 1 hop 1; 2 hop 2; 3 scale and shift; 4..8 gate 0, 0.25, 0.5, 0.75, 1
const NSTATES = 4 + GATES.length;
function draw(pos) {
  const hop = pos < 2 ? pos : 2;
  edges.forEach(([a, b], e) => {
    const phase = hop - Math.floor(hop);
    const moving = pos < 2 && phase > 0;
    msgs[e].setAttribute("opacity", moving ? 1 : 0);
    if (moving) {
      const tt = ease(phase);
      msgs[e].setAttribute("cx", lerp(X(a), X(b), tt));
      msgs[e].setAttribute("cy", b - a === 1 ? Y : Y - 20 - 44 * Math.sin(Math.PI * tt));
    }
  });
  const mix = clamp01(pos / 2);
  nodes.forEach((c) => c.setAttribute("style", `fill:color-mix(in srgb, var(--color-primary) ${Math.round(55 * mix)}%, var(--color-card));stroke:var(--color-primary);stroke-width:3`));
  const showFilm = clamp01(pos - 2);
  film.setAttribute("opacity", showFilm);
  film.textContent = "each layer: a scale and a shift from the GNN";
  const gi = pos <= 3 ? 0 : Math.min(pos - 3, GATES.length - 1);
  const g = lerp(GATES[Math.floor(gi)], GATES[Math.min(Math.floor(gi) + 1, GATES.length - 1)], ease(gi - Math.floor(gi)));
  OUT.forEach((o, j) => {
    const val = o + g * (SCALE[j] * o + SHIFT[j]);
    setBar(bars[j].ghost, o);
    setBar(bars[j].r, val);
    const low = Math.max(val < 0 ? -val : 0, o < 0 ? -o : 0), high = Math.max(val, o, 0);
    bars[j].v.setAttribute("y", val >= 0 ? BY - high * S - 6 : BY + low * S + 16);
    bars[j].v.textContent = fmt(val, 2);
  });
  gateLab.textContent = `gate ${fmt(g, 2)}. Dashed: the layer's output without the GNN.`;
}
function summary(i) {
  if (i === 0) return "The graph of a client's sub-network.";
  if (i <= 2) return `Message passing, hop ${i} of 2: every node collects numbers from its neighbors.`;
  if (i === 3) return "The client's private part turns the GNN's numbers into a scale and a shift for each layer.";
  const g = GATES[i - 4];
  const v = OUT.map((o, j) => fmt(o + g * (SCALE[j] * o + SHIFT[j]), 2)).join(", ");
  return g === 0 ? "Gate 0: the layer's output stays as it is, so training starts from aligned averaging alone." : `Gate ${fmt(g, 2)}: the layer's output becomes ${v}.`;
}
mountAnimation(fig, { n: NSTATES, draw, summary, duration: (i) => (i < 3 ? 1400 : 1100) });
