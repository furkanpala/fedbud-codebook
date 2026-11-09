/* Lesson 5 live figure: the model graph draws itself in compute order (2L + 2 = 8 nodes for L = 3), with an edge to
   the next node and to the node after it. Then every block gets an action, and the dropped block is skipped. */
import { mountAnimation, svgEl, lerp, ease, clamp01 } from "./anim.js";

const NODES = ["embedding", "attention 1", "feed-forward 1", "attention 2", "feed-forward 2", "attention 3", "feed-forward 3", "output head"];
const SHORT = ["E", "A1", "F1", "A2", "F2", "A3", "F3", "O"];
const ACT = [null, "keep", "half", "half", "quarter", "drop", "keep", null];     // one example configuration
const N = NODES.length;
const fig = document.getElementById("fig5");
const svg = fig.querySelector("svg");
svg.setAttribute("viewBox", "0 0 640 200");
const X = (i) => 40 + i * 80, Y = 100;
const edges = [];
for (let i = 0; i < N; i++) for (const d of [1, 2]) if (i + d < N) {
  const x1 = X(i), x2 = X(i + d);
  const path = d === 1 ? `M${x1 + 24},${Y} L${x2 - 24},${Y}` : `M${x1},${Y - 26} Q${(x1 + x2) / 2},${Y - 86} ${x2},${Y - 26}`;
  const e = svgEl("path", { d: path, style: "fill:none;stroke:var(--color-muted);stroke-width:2" }, svg);
  const len = e.getTotalLength ? e.getTotalLength() : 200;
  e.setAttribute("stroke-dasharray", `${len}`);
  edges.push({ e, from: i, to: i + d, len, skip: d === 2 });
}
const nodes = NODES.map((name, i) => {
  const g = svgEl("g", {}, svg);
  const c = svgEl("circle", { cx: X(i), cy: Y, r: 24, style: "fill:var(--color-card);stroke:var(--color-primary);stroke-width:3" }, g);
  svgEl("text", { x: X(i), y: Y + 5, "text-anchor": "middle", style: "font-weight:700" }, g).textContent = SHORT[i];
  const act = svgEl("text", { x: X(i), y: Y + 50, "text-anchor": "middle", style: "fill:var(--color-accent);font-weight:700" }, g);
  return { g, c, act };
});
svgEl("text", { x: 20, y: 190, style: "fill:var(--color-muted)" }, svg).textContent = "E embedding, A attention block, F feed-forward block, O output head";

// states: 0 empty; 1..8 node k appears with the edges that end at it; 9 actions; 10 the dropped block is skipped
const NS = N + 3;
function draw(pos) {
  nodes.forEach((n, i) => {
    const a = clamp01(pos - i);                 // node i grows in between states i and i + 1
    n.g.setAttribute("opacity", ease(a));
    const actA = clamp01(pos - N);              // actions appear between states 8 and 9
    n.act.textContent = ACT[i] ? ACT[i] : "";
    n.act.setAttribute("opacity", ease(actA));
    const dropA = ACT[i] === "drop" ? ease(clamp01(pos - N - 1)) : 0;
    n.c.setAttribute("style", `fill:var(--color-card);stroke:${dropA > 0.5 ? "var(--color-muted)" : "var(--color-primary)"};stroke-width:3;stroke-dasharray:${dropA > 0.5 ? "5 4" : "none"}`);
    n.g.setAttribute("opacity", ease(a) * (1 - 0.55 * dropA));
  });
  edges.forEach((ed) => {
    const a = ease(clamp01(pos - ed.to));
    ed.e.setAttribute("stroke-dashoffset", `${ed.len * (1 - a)}`);
    const dropA = ease(clamp01(pos - N - 1));
    const bypass = ed.skip && ed.from === 4 && ed.to === 6;      // F2 -> F3 skips the dropped A3
    const touchesDrop = ed.from === 5 || ed.to === 5;
    let style = "fill:none;stroke:var(--color-muted);stroke-width:2";
    if (bypass && dropA > 0.5) style = "fill:none;stroke:var(--color-accent);stroke-width:4";
    else if (touchesDrop && dropA > 0.5) style = "fill:none;stroke:var(--color-border);stroke-width:2";
    ed.e.setAttribute("style", style);
  });
}
function summary(i) {
  if (i === 0) return "An empty graph. Nodes will appear in the order in which the model computes.";
  if (i <= N) return `Node ${i} of ${N}: ${NODES[i - 1]}${i > 1 ? ", joined to the node before it" + (i > 2 ? " and to the node two places back" : "") : ""}.`;
  if (i === N + 1) return "Every block gets an action: keep, half, quarter or drop. The embedding and the output head are always kept.";
  return "Attention block 3 is dropped. The model skips it, and the edge from feed-forward 2 to feed-forward 3 carries the input past it.";
}
mountAnimation(fig, { n: NS, draw, summary, duration: (i) => (i < N ? 600 : 1400) });
