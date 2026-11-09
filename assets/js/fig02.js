/* Lesson 2 live figure: federated rounds, step by step. The server sends the shared model, each client trains its
   copy toward its own best point, the copies go back, and the server forms the weighted mean.
   Two parameters only, so the model is a point; the shares 0.1, 0.3, 0.6 are those of the lesson's Python cell. */
import { mountAnimation, svgEl, lerp, ease } from "./anim.js";
import { fmt } from "./common.js";

const SHARES = [0.1, 0.3, 0.6];
const BEST = [[0.15, 0.25], [0.85, 0.3], [0.6, 0.85]];   // each client's own best point (toy)
const COLORS = ["var(--client-1)", "var(--client-2)", "var(--client-3)"];
const ROUNDS = 5, PHASES = ["sent the shared model to every client", "trained their copies on their own data", "sent their copies back", "averaged the copies into the next shared model"];
const STEP_FRAC = 0.6;                                  // a client's copy moves this far toward its best point

// precompute every round: shared point before, the three trained copies, shared point after
const rounds = [];
let shared = [0.2, 0.8];
for (let r = 0; r < ROUNDS; r++) {
  const copies = BEST.map((b) => [lerp(shared[0], b[0], STEP_FRAC), lerp(shared[1], b[1], STEP_FRAC)]);
  const next = [0, 1].map((d) => copies.reduce((s, c, k) => s + SHARES[k] * c[d], 0));
  rounds.push({ before: shared, copies, after: next });
  shared = next;
}

const fig = document.getElementById("fig2");
const svg = fig.querySelector("svg");
svg.setAttribute("viewBox", "0 0 640 300");
// left: the federation; right: the parameter plane
const SRV = [150, 50], CL = [[50, 240], [150, 240], [250, 240]];
CL.forEach((p, k) => svgEl("line", { x1: SRV[0], y1: SRV[1] + 18, x2: p[0], y2: p[1] - 18, style: "stroke:var(--color-border);stroke-width:2" }, svg));
svgEl("rect", { x: SRV[0] - 50, y: SRV[1] - 18, width: 100, height: 36, rx: 8, style: "fill:var(--color-code-bg);stroke:var(--color-border)" }, svg);
svgEl("text", { x: SRV[0], y: SRV[1] + 5, "text-anchor": "middle", style: "font-weight:700" }, svg).textContent = "Server";
CL.forEach((p, k) => {
  svgEl("rect", { x: p[0] - 42, y: p[1] - 18, width: 84, height: 36, rx: 8, style: `fill:var(--color-card);stroke:${COLORS[k]};stroke-width:2` }, svg);
  svgEl("text", { x: p[0], y: p[1] + 5, "text-anchor": "middle" }, svg).textContent = `Client ${k + 1}`;
  svgEl("text", { x: p[0], y: p[1] + 36, "text-anchor": "middle", style: "fill:var(--color-muted)" }, svg).textContent = `share ${SHARES[k]}`;
});
const packets = CL.map((p, k) => svgEl("circle", { r: 7, style: `fill:${COLORS[k]}` }, svg));
const PX = 330, PY = 20, PW = 290, PH = 250;
svgEl("rect", { x: PX, y: PY, width: PW, height: PH, rx: 8, style: "fill:var(--color-code-bg)" }, svg);
svgEl("text", { x: PX + PW / 2, y: PY + PH + 22, "text-anchor": "middle", style: "fill:var(--color-muted)" }, svg).textContent = "the model's two parameters";
const P = (q) => [PX + 15 + q[0] * (PW - 30), PY + PH - 15 - q[1] * (PH - 30)];
BEST.forEach((b, k) => {
  const [x, y] = P(b);
  svgEl("path", { d: `M${x - 7},${y - 7}L${x + 7},${y + 7}M${x - 7},${y + 7}L${x + 7},${y - 7}`, style: `stroke:${COLORS[k]};stroke-width:3` }, svg);
});
const track = svgEl("polyline", { style: "fill:none;stroke:var(--color-text);stroke-width:3;stroke-dasharray:5 4" }, svg);
const roundDots = rounds.map(() => svgEl("circle", { r: 4, style: "fill:var(--color-text)" }, svg));
const copyDots = BEST.map((b, k) => svgEl("circle", { r: 6, style: `fill:${COLORS[k]};opacity:0.85` }, svg));
const sharedDot = svgEl("circle", { r: 9, style: "fill:var(--color-text)" }, svg);
const label = svgEl("text", { x: PX + 10, y: PY + 20, style: "font-weight:700" }, svg);

function draw(pos) {
  // state i is the picture after i phases; phase s plays between states s and s + 1
  const N = ROUNDS * 4, s = Math.min(Math.floor(pos), N - 1), t = ease(Math.min(pos - s, 1));
  const r = Math.min(Math.floor(s / 4), ROUNDS - 1), ph = s % 4, R = rounds[r];
  const pts = [P(rounds[0].before), ...rounds.slice(0, r).map((q) => P(q.after))];
  // packets on the wires
  CL.forEach((c, k) => {
    let a = 0;
    if (ph === 0) a = t; else if (ph === 1) a = 1; else if (ph === 2) a = 1 - t; else a = 0;
    packets[k].setAttribute("cx", lerp(SRV[0], c[0], a));
    packets[k].setAttribute("cy", lerp(SRV[1] + 18, c[1] - 18, a));
    packets[k].setAttribute("opacity", ph === 3 ? 0 : 1);
  });
  // copies in the parameter plane
  BEST.forEach((b, k) => {
    let q = R.before;
    if (ph === 1) q = [lerp(R.before[0], R.copies[k][0], t), lerp(R.before[1], R.copies[k][1], t)];
    if (ph >= 2) q = R.copies[k];
    const [x, y] = P(q);
    copyDots[k].setAttribute("cx", x); copyDots[k].setAttribute("cy", y);
    copyDots[k].setAttribute("opacity", ph === 0 ? 0 : 0.85);
  });
  const cur = ph === 3 ? [lerp(R.before[0], R.after[0], t), lerp(R.before[1], R.after[1], t)] : R.before;
  const [sx, sy] = P(cur);
  sharedDot.setAttribute("cx", sx); sharedDot.setAttribute("cy", sy);
  track.setAttribute("points", [...pts, [sx, sy]].map((p) => p.join(",")).join(" "));
  roundDots.forEach((d, q) => {
    const done = q < r || (q === r && ph === 3 && t >= 1);
    const [x, y] = P(rounds[q].after);
    d.setAttribute("cx", x); d.setAttribute("cy", y); d.setAttribute("opacity", done ? 1 : 0);
  });
  label.textContent = `Round ${r + 1} of ${ROUNDS}`;
}
function summary(i) {
  if (i === 0) return "Before round 1: the server holds the first shared model, the black dot.";
  const r = Math.floor((i - 1) / 4), ph = (i - 1) % 4;
  const who = ph === 0 || ph === 3 ? "The server" : "The clients";
  let s = `Round ${r + 1} of ${ROUNDS}. ${who} ${PHASES[ph]}.`;
  if (ph === 3) s += ` The new shared model weighs client 3 most, because it holds the largest share, ${SHARES[2]}.`;
  return s;
}
mountAnimation(fig, { n: ROUNDS * 4 + 1, draw, summary, duration: (i) => (i % 4 === 1 ? 1200 : 800) });
