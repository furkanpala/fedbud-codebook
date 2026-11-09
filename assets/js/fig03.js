/* Lesson 3 live figure: one shared model for three budgets. The shared model starts at the largest budget, every
   client it outgrows cannot run it, and it ends at the smallest budget, which leaves the larger budgets partly unused.
   Budgets are the lesson's defaults: 0.9, 0.6 and 0.3 of the full cost per token. */
import { mountAnimation, svgEl, lerp, ease } from "./anim.js";
import { fmt } from "./common.js";

const CL = [{ name: "University hospital", b: 0.9 }, { name: "Small company", b: 0.6 }, { name: "Rural clinic", b: 0.3 }];
const COSTS = [0.9, 0.9, 0.6, 0.3, 0.3];           // the shared model's cost at each state
const fig = document.getElementById("fig3");
const svg = fig.querySelector("svg");
svg.setAttribute("viewBox", "0 0 640 300");
const defs = svgEl("defs", {}, svg);
const pat = svgEl("pattern", { id: "hatch3", width: 8, height: 8, patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)" }, defs);
svgEl("rect", { width: 8, height: 8, style: "fill:var(--color-accent-soft)" }, pat);
svgEl("line", { x1: 0, y1: 0, x2: 0, y2: 8, style: "stroke:var(--color-accent);stroke-width:3" }, pat);
const BASE = 250, H = 200, Y = (v) => BASE - v * H;
svgEl("line", { x1: 30, x2: 620, y1: BASE, y2: BASE, style: "stroke:var(--color-muted)" }, svg);
const cols = CL.map((c, i) => {
  const x = 70 + i * 190, w = 110;
  svgEl("rect", { x, y: Y(c.b), width: w, height: c.b * H, rx: 6, style: "fill:var(--color-code-bg);stroke:var(--color-border);stroke-width:2" }, svg);
  const unused = svgEl("rect", { x, y: Y(c.b), width: w, height: 0, style: "fill:url(#hatch3)" }, svg);
  const run = svgEl("rect", { x, y: BASE, width: w, height: 0, rx: 4 }, svg);
  svgEl("text", { x: x + w / 2, y: BASE + 20, "text-anchor": "middle", style: "font-weight:700" }, svg).textContent = c.name;
  svgEl("text", { x: x + w / 2, y: Y(c.b) - 8, "text-anchor": "middle", style: "fill:var(--color-muted)" }, svg).textContent = `budget ${fmt(c.b, 1)}`;
  const st = svgEl("text", { x: x + w / 2, y: BASE + 40, "text-anchor": "middle" }, svg);
  const pct = svgEl("text", { x: x + w / 2, y: Y(c.b) + 20, "text-anchor": "middle", style: "font-weight:700;fill:var(--color-accent)" }, svg);
  return { c, unused, run, st, pct, x, w };
});
const line = svgEl("line", { x1: 40, x2: 610, style: "stroke:var(--color-primary);stroke-width:3;stroke-dasharray:8 5" }, svg);
const lineLab = svgEl("text", { x: 612, "text-anchor": "end", style: "font-weight:700;fill:var(--color-primary)" }, svg);

function draw(pos) {
  const i = Math.min(Math.floor(pos), COSTS.length - 2), t = pos >= COSTS.length - 1 ? 1 : ease(pos - i);
  const cost = lerp(COSTS[i], COSTS[i + 1], t);
  const showUnused = pos >= COSTS.length - 1 ? 1 : (i === COSTS.length - 2 ? t : 0);
  line.setAttribute("y1", Y(cost)); line.setAttribute("y2", Y(cost));
  const show = pos < 1 ? ease(pos) : 1;
  line.setAttribute("opacity", show); lineLab.setAttribute("opacity", show);
  lineLab.setAttribute("y", Y(cost) - 8);
  lineLab.textContent = `shared model, cost ${fmt(cost, 2)}`;
  for (const k of cols) {
    const fits = cost <= k.c.b + 1e-9;
    const h = fits ? cost * H : 0;
    k.run.setAttribute("y", BASE - h); k.run.setAttribute("height", h);
    k.run.setAttribute("style", "fill:var(--color-primary);opacity:0.8");
    k.st.textContent = fits ? "runs it" : "cannot run it";
    k.st.setAttribute("style", `font-weight:700;fill:${fits ? "var(--color-good)" : "var(--color-bad)"}`);
    const unusedH = fits ? (k.c.b - cost) * H * showUnused : 0;
    k.unused.setAttribute("height", unusedH);
    const share = 1 - cost / k.c.b;
    k.pct.textContent = showUnused > 0.5 && fits && share > 0.01 ? `${fmt(100 * share, 0)}% unused` : "";
  }
}
const SUM = [
  "Three clients with budgets 0.9, 0.6 and 0.3 of the full cost per token.",
  "The shared model costs 0.9. Only the university hospital can run it.",
  "The shared model shrinks to 0.6. The rural clinic still cannot run it.",
  "The shared model shrinks to 0.3, the smallest budget. Every client can run it now.",
  "But the hospital leaves 67% of its budget unused and the company 50%.",
];
mountAnimation(fig, { n: COSTS.length, draw, summary: (i) => SUM[i], duration: 1400 });
