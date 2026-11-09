/* Lesson 10 live figure: from training alone to training together, dataset by dataset. Each panel has its own scale:
   the gray point is a client training alone, the blue point FedBUD, both as the mean over seeds 42, 1 and 2 with
   whiskers of one standard deviation (the paper's results table). An arrow grows from one to the other. */
import { mountAnimation, svgEl, lerp, ease, clamp01 } from "./anim.js";
import { fmt } from "./common.js";

const D = [   // name, metric, lower is better, alone mean, sd, FedBUD mean, sd, significant
  ["CoNLL", "F1", false, 0.8233, 0.0099, 0.8398, 0.0038, false],
  ["SQuAD", "F1", false, 0.6336, 0.0066, 0.7269, 0.0034, true],
  ["AG News", "accuracy", false, 0.9315, 0.0101, 0.9448, 0.0028, false],
  ["XSum", "ROUGE-L", false, 0.2241, 0.0034, 0.2311, 0.0007, false],
  ["SAMSum", "ROUGE-L", false, 0.3660, 0.0046, 0.3808, 0.0017, true],
  ["Multi-task", "loss, lower is better", true, 1.1217, 0.0012, 0.9697, 0.0034, true],
];
const fig = document.getElementById("fig10");
const svg = fig.querySelector("svg");
svg.setAttribute("viewBox", "0 0 640 340");
const PW = 200, PH = 140;
const panels = D.map((d, i) => {
  const x0 = 12 + (i % 3) * 210, y0 = 8 + Math.floor(i / 3) * 168;
  const g = svgEl("g", { transform: `translate(${x0},${y0})` }, svg);
  svgEl("rect", { width: PW, height: PH + 18, rx: 8, style: "fill:var(--color-code-bg)" }, g);
  svgEl("text", { x: 10, y: 20, style: "font-weight:700" }, g).textContent = d[0];
  svgEl("text", { x: 10, y: 38, style: "fill:var(--color-muted);font-size:13px" }, g).textContent = d[1];
  const lo = Math.min(d[3] - d[4], d[5] - d[6]), hi = Math.max(d[3] + d[4], d[5] + d[6]), pad = (hi - lo) * 0.25;
  const Y = (v) => 50 + (PH - 60) * (1 - (v - (lo - pad)) / (hi - lo + 2 * pad));
  const XA = 60, XF = 140;
  const wa = svgEl("line", { x1: XA, x2: XA, y1: Y(d[3] - d[4]), y2: Y(d[3] + d[4]), style: "stroke:var(--color-muted);stroke-width:2" }, g);
  const pa = svgEl("circle", { cx: XA, cy: Y(d[3]), r: 5, style: "fill:var(--color-muted)" }, g);
  const arrow = svgEl("line", { x1: XA + 8, y1: Y(d[3]), style: "stroke:var(--color-primary);stroke-width:2" }, g);
  const wf = svgEl("line", { x1: XF, x2: XF, style: "stroke:var(--color-primary);stroke-width:2" }, g);
  const pf = svgEl("circle", { cx: XF, r: 5, style: "fill:var(--color-primary)" }, g);
  svgEl("text", { x: XA, y: PH + 12, "text-anchor": "middle", style: "font-size:13px" }, g).textContent = "alone";
  svgEl("text", { x: XF, y: PH + 12, "text-anchor": "middle", style: "font-size:13px" }, g).textContent = "FedBUD";
  const val = svgEl("text", { x: PW - 8, y: 20, "text-anchor": "end", style: "font-weight:700;font-size:13px" }, g);
  const sig = svgEl("text", { x: PW - 8, y: 38, "text-anchor": "end", style: "font-size:13px;fill:var(--color-good);font-weight:700" }, g);
  return { d, Y, XA, XF, wa, pa, arrow, wf, pf, val, sig, g };
});
function draw(pos) {
  panels.forEach((p, i) => {
    const a = ease(clamp01(pos - i));          // panel i grows between states i and i + 1
    const d = p.d, v = lerp(d[3], d[5], a);
    p.g.setAttribute("opacity", pos >= i ? 1 : 0.35);
    p.arrow.setAttribute("x2", lerp(p.XA + 8, p.XF - 8, a));
    p.arrow.setAttribute("y2", p.Y(v));
    p.pf.setAttribute("cy", p.Y(v)); p.pf.setAttribute("opacity", a);
    p.wf.setAttribute("y1", p.Y(v - d[6])); p.wf.setAttribute("y2", p.Y(v + d[6])); p.wf.setAttribute("opacity", a);
    p.val.textContent = a > 0.99 ? `${fmt(d[3], 4)} → ${fmt(d[5], 4)}` : "";
    p.sig.textContent = a > 0.99 && d[7] ? "significant" : "";
  });
}
function summary(i) {
  if (i === 0) return "Six experiments. Gray: a client training alone. Blue: FedBUD. Each panel has its own scale.";
  const d = D[i - 1], better = d[2] ? d[5] < d[3] : d[5] > d[3];
  return `${d[0]}, ${d[1]}: training alone ${fmt(d[3], 4)}, FedBUD ${fmt(d[5], 4)}, ${better ? "better" : "worse"}${d[7] ? ", and the gain is significant" : ""}.`;
}
mountAnimation(fig, { n: D.length + 1, draw, summary, duration: 1200 });
