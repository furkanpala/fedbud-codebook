/* Lesson 1 live figure: memory fills up as the model grows, on three graphics cards.
   Rule of the lesson: running needs 2 bytes per parameter, fine-tuning about 16. */
import { mountAnimation, svgEl, lerp, ease } from "./anim.js";
import { fmt } from "./common.js";

const SIZES = [0.5, 1, 3, 7];                      // billions of parameters; 0.5 is Qwen2.5-0.5B
const CARDS = [{ name: "Laptop", gb: 8 }, { name: "Workstation", gb: 16 }, { name: "Data-center card", gb: 80 }];
const fig = document.getElementById("fig1");
const svg = fig.querySelector("svg");
svg.setAttribute("viewBox", "0 0 640 300");
const TOP = 40, H = 180, BW = 46;
const parts = CARDS.map((c, i) => {
  const x0 = 40 + i * 205;
  svgEl("text", { x: x0 + 60, y: 22, "text-anchor": "middle", style: "font-weight:700" }, svg).textContent = `${c.name}, ${c.gb} GB`;
  const bars = ["run", "fine-tune"].map((label, j) => {
    const x = x0 + 8 + j * (BW + 20);
    svgEl("rect", { x, y: TOP, width: BW, height: H, rx: 6, style: "fill:var(--color-code-bg);stroke:var(--color-border)" }, svg);
    const fill = svgEl("rect", { x, y: TOP + H, width: BW, height: 0, rx: 6 }, svg);
    const over = svgEl("text", { x: x + BW / 2, y: TOP + 16, "text-anchor": "middle", style: "font-weight:700;fill:var(--color-bad)" }, svg);
    svgEl("text", { x: x + BW / 2, y: TOP + H + 20, "text-anchor": "middle" }, svg).textContent = label;
    const val = svgEl("text", { x: x + BW / 2, y: TOP + H + 40, "text-anchor": "middle", style: "fill:var(--color-muted)" }, svg);
    return { fill, over, val };
  });
  return { c, bars };
});
const sizeLabel = svgEl("text", { x: 320, y: 292, "text-anchor": "middle", style: "font-weight:700" }, svg);

function sizeAt(pos) {
  const i = Math.min(Math.floor(pos), SIZES.length - 2), t = ease(pos - i);
  return Math.exp(lerp(Math.log(SIZES[i]), Math.log(SIZES[i + 1]), t));  // grow on a log scale
}
function draw(pos) {
  const b = pos >= SIZES.length - 1 ? SIZES[SIZES.length - 1] : sizeAt(pos);
  for (const { c, bars } of parts) {
    [2 * b, 16 * b].forEach((need, j) => {
      const r = need / c.gb, h = Math.min(r, 1) * H, fits = r <= 1;
      const { fill, over, val } = bars[j];
      fill.setAttribute("y", TOP + H - h);
      fill.setAttribute("height", h);
      fill.setAttribute("style", `fill:${fits ? (j ? "var(--color-primary)" : "var(--client-3)") : "var(--color-bad)"}`);
      over.textContent = fits ? "" : "does not fit";
      val.textContent = `${fmt(need, need < 10 ? 1 : 0)} GB`;
    });
  }
  sizeLabel.textContent = `Model of ${fmt(b, b < 1 ? 1 : 1)} billion parameters`;
}
function summary(i) {
  const b = SIZES[i];
  const fit = CARDS.filter((c) => 16 * b <= c.gb).map((c) => c.name.toLowerCase());
  return `A model of ${fmt(b, 1)} billion parameters needs ${fmt(2 * b, 1)} GB to run and ${fmt(16 * b, 0)} GB to fine-tune. Fine-tuning fits on ${fit.length ? "the " + fit.join(" and the ") : "none of the three cards"}.`;
}
mountAnimation(fig, { n: SIZES.length, draw, summary, duration: 1600 });
