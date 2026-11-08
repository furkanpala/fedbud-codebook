import { $, fmt, lineChart } from "./common.js";
import { makeFederation } from "./toy-mlp.js";

/* Lesson 9: the toy federation of Lesson 8 with and without the shared graph network,
   and the paper's measured changes (appendix table "FedBUD with and without the shared GNN"). */

const PAPER = [
  ["CoNLL, F1", -0.0048, -0.0161],
  ["SQuAD, F1", 0.0095, 0.0016],
  ["AG News, accuracy", -0.0022, -0.0011],
  ["XSum, ROUGE-L", -0.0020, 0.0014],
  ["SAMSum, ROUGE-L", 0.0007, 0.0014],
  ["Multi-task, loss with sign turned", 0.0005, 0.0069],
];

function paperChart() {
  const NS = "http://www.w3.org/2000/svg";
  const svg = $("#paper-chart");
  const W = 640, Hh = 300, m = { l: 64, r: 12, t: 16, b: 70 };
  svg.setAttribute("viewBox", `0 0 ${W} ${Hh}`);
  svg.innerHTML = "";
  const mk = (name, attrs, parent = svg) => { const e = document.createElementNS(NS, name); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); parent.appendChild(e); return e; };
  const lo = -0.02, hi = 0.012;
  const Y = (v) => m.t + ((hi - v) / (hi - lo)) * (Hh - m.t - m.b);
  for (const v of [-0.02, -0.01, 0, 0.01]) {
    mk("line", { x1: m.l, x2: W - m.r, y1: Y(v), y2: Y(v), stroke: v === 0 ? "#6b7280" : "#e5e7f2" });
    mk("text", { x: m.l - 8, y: Y(v) + 4, "text-anchor": "end" }).textContent = fmt(v, 2);
  }
  const bw = (W - m.l - m.r) / PAPER.length;
  PAPER.forEach(([name, a, b], i) => {
    [a, b].forEach((v, s) => {
      const x = m.l + i * bw + bw * 0.14 + s * bw * 0.36;
      const r = mk("rect", { x, y: Math.min(Y(v), Y(0)), width: bw * 0.32, height: Math.abs(Y(v) - Y(0)), fill: s ? "#a5b4fc" : "#4338ca", rx: 3, tabindex: 0 });
      const t = document.createElementNS(NS, "title");
      t.textContent = `${name}, series ${s ? "B" : "A"}: ${v > 0 ? "+" : ""}${fmt(v, 4)}`;
      r.appendChild(t);
    });
    const lbl = mk("text", { x: m.l + i * bw + bw / 2, y: Hh - m.b + 18, "text-anchor": "middle" });
    lbl.textContent = name.split(",")[0];
  });
  $("#paper-rows").innerHTML = PAPER.map(([n, a, b]) => `<tr><th scope="row">${n}</th><td>${a > 0 ? "+" : ""}${fmt(a, 4)}</td><td>${b > 0 ? "+" : ""}${fmt(b, 4)}</td></tr>`).join("");
}

let hist = null, gates = null, finalAcc = null;

function draw() {
  if (!hist) return;
  const on = $("#gnn-switch").checked;
  lineChart($("#curve"), [
    { color: on ? "#c7cbe0" : "#4338ca", points: hist.off.map(([r, a]) => [r, 100 * a]), width: on ? 2 : 3.5 },
    { color: on ? "#c2410c" : "#f3c9b0", points: hist.on.map(([r, a]) => [r, 100 * a]), width: on ? 3.5 : 2 },
  ], { xLabel: "round", yLabel: "mean test accuracy, %", yMin: 40, yMax: 100, xMax: 30 });
  $("#acc").textContent = fmt(100 * (on ? finalAcc.on : finalAcc.off), 1) + "%";
  $("#gates").textContent = on ? gates.map((g) => fmt(g, 2)).join(", ") : "not used";
}

async function train() {
  const off = makeFederation("aligned", { seed: 7, useFilm: false });
  const on = makeFederation("aligned", { seed: 7, useFilm: true });
  hist = { off: [[0, off.meanAccuracy()]], on: [[0, on.meanAccuracy()]] };
  for (let r = 1; r <= 30; r++) {
    off.round(); on.round();
    hist.off.push([r, off.meanAccuracy()]);
    hist.on.push([r, on.meanAccuracy()]);
    if (r % 5 === 0) { $("#train-status").textContent = `Training the two federations, round ${r} of 30...`; await new Promise((res) => setTimeout(res, 0)); }
  }
  finalAcc = { off: hist.off[30][1], on: hist.on[30][1] };
  gates = on.clients.map((c) => c.film.eta);
  $("#train-status").textContent = `Done. Without the shared graph network: ${fmt(100 * finalAcc.off, 1)}%. With it: ${fmt(100 * finalAcc.on, 1)}%.`;
  draw();
}

$("#gnn-switch").addEventListener("change", draw);
paperChart();
train();
