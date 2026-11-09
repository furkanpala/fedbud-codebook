/* Lesson 8 live figure: what the server averages. Three clients keep different neurons of the toy layer
   (A keeps all 8, B keeps 1, 2, 5, 6 and C keeps 3, 4, 7, 8, as in the lesson's toy federation) and store them in
   their rows from the top. Position by position, row k of every client meets row k of the others; aligned, every row
   first moves to the slot of its own neuron, and each slot averages only the clients that keep that neuron. */
import { mountAnimation, svgEl, lerp, ease } from "./anim.js";
import { HID, KEPT } from "./toy-mlp.js";

const CLIENTS = ["A", "B", "C"];
const COL = ["var(--client-1)", "var(--client-2)", "var(--client-3)"];
const fig = document.getElementById("fig8");
const svg = fig.querySelector("svg");
svg.setAttribute("viewBox", "0 0 640 320");
const RH = 30, TOP = 46, CX = [40, 150, 260], SX = 440;
CLIENTS.forEach((c, k) => {
  svgEl("text", { x: CX[k] + 35, y: 30, "text-anchor": "middle", style: "font-weight:700" }, svg).textContent = `Client ${c}`;
  for (let r = 0; r < HID; r++) svgEl("rect", { x: CX[k], y: TOP + r * RH, width: 70, height: RH - 4, rx: 4, style: "fill:none;stroke:var(--color-border)" }, svg);
});
svgEl("text", { x: SX + 70, y: 30, "text-anchor": "middle", style: "font-weight:700" }, svg).textContent = "Server";
[...Array(HID)].forEach((_, r) => svgEl("rect", { x: SX, y: TOP + r * RH, width: 140, height: RH - 4, rx: 4, style: "fill:var(--color-code-bg);stroke:var(--color-border)" }, svg));
// one movable chip per (client, kept neuron)
const chips = [];
CLIENTS.forEach((c, k) => {
  KEPT[c].forEach((neuron, row) => {
    const g = svgEl("g", {}, svg);
    const r = svgEl("rect", { width: 70, height: RH - 4, rx: 4, style: `fill:${COL[k]}` }, g);
    const label = svgEl("text", { x: 35, y: 18, "text-anchor": "middle", style: "fill:#fff;font-weight:700" }, g);
    label.textContent = `n${neuron + 1}`;
    chips.push({ g, k, neuron, row, r, label });
  });
});
// the slot labels sit on top of the chips
const slots = [...Array(HID)].map((_, r) => svgEl("text", { x: SX + 70, y: TOP + r * RH + 18, "text-anchor": "middle", style: "font-weight:700" }, svg));
let mode = "pos";
const target = (ch) => (mode === "pos" ? ch.row : ch.neuron);     // the server slot this chip goes to
const off = (ch) => {                                              // side-by-side place inside a slot
  const same = chips.filter((o) => target(o) === target(ch));
  return same.indexOf(ch) * (140 / same.length);
};
function slotText(s) {
  const inSlot = chips.filter((c) => target(c) === s);
  if (!inSlot.length) return "";
  const ns = [...new Set(inSlot.map((c) => c.neuron + 1))];
  return ns.length === 1 ? `n${ns[0]}: mean of ${inSlot.map((c) => CLIENTS[c.k]).join(", ")}` : `mixes n${ns.join(" + n")}`;
}
function draw(pos) {
  const t1 = ease(Math.min(Math.max(pos, 0), 1));        // rows move to the server
  const t2 = ease(Math.min(Math.max(pos - 1, 0), 1));    // rows merge in each slot
  chips.forEach((ch) => {
    const x0 = CX[ch.k], y0 = TOP + ch.row * RH;
    const s = target(ch), y1 = TOP + s * RH;
    const w = 140 / chips.filter((o) => target(o) === s).length;
    const x1 = SX + off(ch);
    ch.g.setAttribute("transform", `translate(${lerp(x0, x1, t1)},${lerp(y0, y1, t1)}) scale(${lerp(1, w / 70, t1)},1)`);
    ch.r.setAttribute("opacity", 1 - 0.8 * t2);
    ch.label.setAttribute("opacity", 1 - t2);
  });
  slots.forEach((txt, s) => {
    txt.textContent = t2 > 0.5 ? slotText(s) : "";
    const bad = /mixes/.test(txt.textContent);
    txt.setAttribute("style", `font-weight:700;font-size:13px;fill:${bad ? "var(--color-bad)" : "var(--color-text)"}`);
  });
}
function summary(i) {
  if (i === 0) return "Each client stores the neurons it keeps in its rows from the top.";
  if (i === 1) return mode === "pos" ? "Position by position: row k of every client goes to slot k." : "Aligned: every row goes to the slot of its own neuron.";
  const mixed = [...Array(HID).keys()].filter((s) => /mixes/.test(slotText(s))).length;
  return mode === "pos" ? `${mixed} of ${HID} slots mix different neurons, so those averages mean nothing.` : "No slot mixes neurons. Each slot averages only the clients that keep that neuron.";
}
const api = mountAnimation(fig, { n: 3, draw, summary, duration: 1600 });
const row = document.createElement("div");
row.className = "btn-row anim-choice";
row.innerHTML = '<button class="btn secondary" type="button" aria-pressed="true" data-mode="pos">Position by position</button><button class="btn secondary" type="button" aria-pressed="false" data-mode="aln">Aligned</button>';
fig.insertBefore(row, fig.querySelector(".anim-controls"));
row.addEventListener("click", (e) => {
  const b = e.target.closest("[data-mode]");
  if (!b) return;
  mode = b.dataset.mode;
  row.querySelectorAll("[data-mode]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
  api.restart();
});
