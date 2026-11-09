/* Lesson 6 live figure: importance scores add up example by example. The trained toy model of the lesson scores the
   four heads on the first k of the client's 32 scoring examples, for k = 1 .. 32 (the paper's score, normalized so
   the heads add up to one). Switch between client A and client B. */
import { mountAnimation, svgEl, lerp } from "./anim.js";
import { fmt } from "./common.js";

const fig = document.getElementById("fig6");
const svg = fig.querySelector("svg");
svg.setAttribute("viewBox", "0 0 640 280");
const wait = svgEl("text", { x: 320, y: 140, "text-anchor": "middle", style: "fill:var(--color-muted)" }, svg);
wait.textContent = "The toy model trains in the lesson below. The figure starts when it is ready.";
const K = 32, HEADS = 4, BASE = 220, TOPH = 170;

function series(model, data) {
  // one forward pass: per-example head scores, then the running mean over the first k examples, normalized per k
  const per = model.headScoresByExample(data);            // [head][example]
  const out = [], sum = new Array(HEADS).fill(0);
  for (let k = 1; k <= K; k++) {
    for (let h = 0; h < HEADS; h++) sum[h] += per[h][k - 1];
    const tot = sum.reduce((a, b) => a + b, 0);
    out.push(sum.map((v) => v / tot));
  }
  return out;
}

function start({ model, data }) {
  wait.remove();
  const S = { A: series(model, data.A.score), B: series(model, data.B.score) };
  let client = "A";
  const bars = [...Array(HEADS)].map((_, i) => {
    const x = 60 + i * 140;
    const r = svgEl("rect", { x, y: BASE, width: 90, height: 0, rx: 6, style: "fill:var(--client-1)" }, svg);
    const v = svgEl("text", { x: x + 45, y: BASE - 6, "text-anchor": "middle", style: "font-weight:700" }, svg);
    svgEl("text", { x: x + 45, y: BASE + 22, "text-anchor": "middle" }, svg).textContent = `head ${i + 1}`;
    return { r, v };
  });
  svgEl("line", { x1: 40, x2: 620, y1: BASE, y2: BASE, style: "stroke:var(--color-muted)" }, svg);
  const lab = svgEl("text", { x: 40, y: 24, style: "font-weight:700" }, svg);
  const tokens = svgEl("text", { x: 40, y: 268, style: "fill:var(--color-muted)" }, svg);
  function draw(pos) {
    const s = S[client];
    if (pos < 1) {                       // state 0: no example yet
      bars.forEach((b) => { b.r.setAttribute("height", 0); b.r.setAttribute("y", BASE); b.v.textContent = ""; });
      lab.textContent = `Client ${client}: no example scored yet`;
      tokens.textContent = "";
      return;
    }
    const k = Math.min(Math.floor(pos), K), t = pos - k;
    const a = s[k - 1], b = s[Math.min(k, K - 1)];
    bars.forEach((bar, i) => {
      const v = k >= K ? a[i] : lerp(a[i], b[i], t);
      const h = v * TOPH / 0.6;
      bar.r.setAttribute("y", BASE - h); bar.r.setAttribute("height", h);
      bar.v.setAttribute("y", BASE - h - 6);
      bar.v.textContent = fmt(v, 2);
    });
    lab.textContent = `Client ${client}: scores after ${k} of ${K} examples`;
    tokens.textContent = "examples read: " + "■".repeat(k) + "□".repeat(K - k);
  }
  function summary(i) {
    if (i === 0) return `Client ${client}. No example scored yet.`;
    const v = S[client][i - 1], top = v.indexOf(Math.max(...v));
    return `Client ${client}, after ${i} of ${K} examples: head ${top + 1} has the highest score, ${fmt(v[top], 2)}.`;
  }
  const api = mountAnimation(fig, { n: K + 1, draw, summary, duration: 260 });
  const row = document.createElement("div");
  row.className = "btn-row anim-choice";
  row.innerHTML = '<button class="btn secondary" type="button" aria-pressed="true" data-client="A">Client A</button><button class="btn secondary" type="button" aria-pressed="false" data-client="B">Client B</button>';
  fig.insertBefore(row, fig.querySelector(".anim-controls"));
  row.addEventListener("click", (e) => {
    const b = e.target.closest("[data-client]");
    if (!b) return;
    client = b.dataset.client;
    row.querySelectorAll("[data-client]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    api.restart();
  });
}

if (window.__toy6) start(window.__toy6);
else window.addEventListener("toy6-ready", () => start(window.__toy6), { once: true });
