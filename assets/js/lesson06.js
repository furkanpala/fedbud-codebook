import { $, bindRange, fmt, rng, barChart } from "./common.js";
import { H, F, trainToy, makeData, trainedText } from "./toy-transformer.js";

/* Lesson 6: the paper's importance scores on the toy layer, for two clients with different data. */

let model = null, client = null, scores = null;
const data = {};

function headChart(svg, sc, drop) {
  const NS = "http://www.w3.org/2000/svg";
  const W = 640, Hh = 280, m = { l: 20, r: 20, t: 24, b: 40 };
  svg.innerHTML = "";
  svg.setAttribute("viewBox", `0 0 ${W} ${Hh}`);
  const maxS = Math.max(...sc, 1e-9), maxD = Math.max(...drop.map((d) => Math.max(d, 0)), 1e-9);
  const bw = (W - m.l - m.r) / sc.length;
  const base = Hh - m.b, top = m.t, span = base - top;
  const mk = (name, attrs) => { const e = document.createElementNS(NS, name); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); svg.appendChild(e); return e; };
  mk("line", { x1: m.l, x2: W - m.r, y1: base, y2: base, stroke: "#9ca3af" });
  sc.forEach((s, i) => {
    const x0 = m.l + i * bw + bw * 0.12, w = bw * 0.36;
    const hs = (span * s) / maxS, hd = (span * Math.max(drop[i], 0)) / maxD;
    const r1 = mk("rect", { x: x0, y: base - hs, width: w, height: hs, fill: "#4338ca", rx: 3, tabindex: 0 });
    const t1 = document.createElementNS(NS, "title"); t1.textContent = `Head ${i + 1}: score ${fmt(s, 2)}`; r1.appendChild(t1);
    const r2 = mk("rect", { x: x0 + w + 4, y: base - hd, width: w, height: hd, fill: "#c2410c", rx: 3, tabindex: 0 });
    const t2 = document.createElementNS(NS, "title"); t2.textContent = `Head ${i + 1}: removing it costs ${fmt(100 * drop[i], 1)} accuracy points`; r2.appendChild(t2);
    const a = mk("text", { x: x0 + w / 2, y: base - hs - 6, "text-anchor": "middle", style: "fill:#1e1b4b;font-weight:700" }); a.textContent = fmt(s, 2);
    const b = mk("text", { x: x0 + w * 1.5 + 4, y: base - hd - 6, "text-anchor": "middle", style: "fill:#c2410c;font-weight:700" }); b.textContent = fmt(100 * drop[i], 1);
    const lb = mk("text", { x: x0 + w + 2, y: base + 22, "text-anchor": "middle" }); lb.textContent = `Head ${i + 1}`;
  });
}

function score(which) {
  client = which;
  const d = data[which];
  scores = model.importance(d.score);
  const ones = new Array(H).fill(1), onesN = new Array(F).fill(1);
  const full = model.accuracy(ones, onesN, d.test);
  const drop = [...Array(H)].map((_, i) => { const hm = ones.slice(); hm[i] = 0; return full - model.accuracy(hm, onesN, d.test); });
  headChart($("#head-chart"), scores.heads, drop);
  barChart($("#neuron-chart"), scores.neurons.map((v, j) => ({ label: String(j + 1), value: v, color: "#0f766e" })), { yLabel: "score", digits: 2, height: 240 });
  $("#which").textContent = `Scores for client ${which}, from 32 of its examples. The full layer answers ${fmt(100 * full, 1)}% of client ${which}'s test questions correctly.`;
  let same = 0, pairs = 0;
  for (let i = 0; i < H; i++) for (let j = i + 1; j < H; j++) {
    pairs += 1;
    if (Math.sign(scores.heads[i] - scores.heads[j]) === Math.sign(drop[i] - drop[j])) same += 1;
  }
  $("#agree").textContent = `The scores put ${same} of the ${pairs} pairs of heads in the same order as the accuracy drops do.`;
  updateK();
}

function updateK() {
  if (!scores) { $("#acc-low").textContent = "-"; $("#acc-rand").textContent = "-"; return; }
  const k = Number($("#k").value);
  const d = data[client];
  const ones = new Array(H).fill(1);
  const order = scores.neurons.map((v, j) => [v, j]).sort((a, b) => a[0] - b[0]).map((p) => p[1]);
  const low = new Array(F).fill(1); order.slice(0, k).forEach((j) => { low[j] = 0; });
  $("#acc-low").textContent = fmt(100 * model.accuracy(ones, low, d.test), 1) + "%";
  const r = rng(77 + k);
  let sum = 0;
  for (let t = 0; t < 20; t++) {
    const idx = [...Array(F).keys()];
    for (let i = F - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
    const m = new Array(F).fill(1); idx.slice(0, k).forEach((j) => { m[j] = 0; });
    sum += model.accuracy(ones, m, d.test);
  }
  $("#acc-rand").textContent = fmt((100 * sum) / 20, 1) + "%";
}

async function start() {
  if (!window.tf) { $("#train-status").textContent = "The training library did not load. Check your internet connection and reload the page."; return; }
  $("#train-status").textContent = "Training the toy model in your browser...";
  model = await trainToy({ seed: 3, onProgress: (f) => { $("#train-fill").style.width = 100 * f + "%"; }, onNote: (t) => { $("#train-status").textContent = t; } });
  data.A = { score: makeData(32, 11), test: makeData(1000, 12) };
  data.B = { score: makeData(32, 13, [3, 4, 5]), test: makeData(1000, 14, [3, 4, 5]) };
  $("#train-status").textContent = trainedText(model);
  $("#lab").hidden = false;
  score("A");
  // the live figure (fig06.js) streams the scoring examples through this model
  window.__toy6 = { model, data };
  window.dispatchEvent(new Event("toy6-ready"));
}

bindRange($("#k"), $("#k-out"), (v) => v + (v === 1 ? " neuron" : " neurons"), updateK);
$("#score-a").addEventListener("click", () => score("A"));
$("#score-b").addEventListener("click", () => score("B"));
start();
