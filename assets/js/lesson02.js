import { $, bindRange, fmt, rng, gauss, lineChart } from "./common.js";

/* Toy federation: three clients, two kinds of points, one shared linear model (logistic regression).
   Each client holds mostly one kind, so a model trained alone on one client is poor on all points. */

const CLIENT_COLORS = ["#4338ca", "#c2410c", "#0f766e"];
const rand = rng(7);

function makeClient(id, n0, n1, shift) {
  const pts = [];
  for (let i = 0; i < n0; i++) pts.push({ x: -1 + 0.75 * gauss(rand), y: -0.4 + shift + 0.75 * gauss(rand), c: 0, id });
  for (let i = 0; i < n1; i++) pts.push({ x: 1 + 0.75 * gauss(rand), y: 0.8 + shift + 0.75 * gauss(rand), c: 1, id });
  return pts;
}

const clients = [makeClient(0, 76, 4, 0), makeClient(1, 4, 76, 0), makeClient(2, 34, 6, 0.6)];
const allPoints = clients.flat();

const sigmoid = (z) => 1 / (1 + Math.exp(-z));
const startModel = () => ({ w1: 0.15, w2: -0.6, b: 0.4 });

function train(model, pts, steps, lr = 0.5) {
  let { w1, w2, b } = model;
  for (let s = 0; s < steps; s++) {
    let g1 = 0, g2 = 0, gb = 0;
    for (const p of pts) {
      const err = sigmoid(w1 * p.x + w2 * p.y + b) - p.c;
      g1 += err * p.x; g2 += err * p.y; gb += err;
    }
    w1 -= (lr * g1) / pts.length; w2 -= (lr * g2) / pts.length; b -= (lr * gb) / pts.length;
  }
  return { w1, w2, b };
}

function accuracy(model, pts) {
  let ok = 0;
  for (const p of pts) ok += ((model.w1 * p.x + model.w2 * p.y + model.b > 0) ? 1 : 0) === p.c ? 1 : 0;
  return ok / pts.length;
}

function federatedRound(shared, steps) {
  const copies = clients.map((pts) => train(shared, pts, steps));
  const total = clients.reduce((s, pts) => s + pts.length, 0);
  const avg = { w1: 0, w2: 0, b: 0 };
  copies.forEach((m, k) => {
    const share = clients[k].length / total;
    avg.w1 += share * m.w1; avg.w2 += share * m.w2; avg.b += share * m.b;
  });
  return avg;
}

/* ---------- drawing ---------- */
const canvas = $("#plane");
const ctx = canvas.getContext("2d");
const view = { x0: -3.2, x1: 3.2, y0: -2.6, y1: 3.2 };
const px = (x) => ((x - view.x0) / (view.x1 - view.x0)) * canvas.width;
const py = (y) => canvas.height - ((y - view.y0) / (view.y1 - view.y0)) * canvas.height;

function draw(model) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (const p of allPoints) {
    ctx.strokeStyle = CLIENT_COLORS[p.id];
    ctx.fillStyle = CLIENT_COLORS[p.id];
    ctx.lineWidth = 2;
    if (p.c === 0) {
      ctx.beginPath(); ctx.arc(px(p.x), py(p.y), 4.5, 0, 2 * Math.PI); ctx.fill();
    } else {
      ctx.strokeRect(px(p.x) - 4, py(p.y) - 4, 8, 8);
    }
  }
  // the boundary w1 x + w2 y + b = 0
  ctx.strokeStyle = "#111827";
  ctx.lineWidth = 3;
  ctx.beginPath();
  if (Math.abs(model.w2) > 1e-6) {
    const yAt = (x) => -(model.w1 * x + model.b) / model.w2;
    ctx.moveTo(px(view.x0), py(yAt(view.x0)));
    ctx.lineTo(px(view.x1), py(yAt(view.x1)));
  } else {
    const x = -model.b / (model.w1 || 1e-6);
    ctx.moveTo(px(x), 0); ctx.lineTo(px(x), canvas.height);
  }
  ctx.stroke();
}

/* ---------- state ---------- */
let shared, round, history, aloneModels, aloneHistory, timer = null;

function reset() {
  if (timer) { clearInterval(timer); timer = null; }
  shared = startModel();
  round = 0;
  history = [[0, accuracy(shared, allPoints)]];
  aloneModels = clients.map(() => startModel());
  aloneHistory = clients.map(() => [[0, accuracy(startModel(), allPoints)]]);
  render();
}

function step() {
  const steps = Number($("#steps").value);
  shared = federatedRound(shared, steps);
  aloneModels = aloneModels.map((m, k) => train(m, clients[k], steps));
  round += 1;
  history.push([round, accuracy(shared, allPoints)]);
  aloneModels.forEach((m, k) => aloneHistory[k].push([round, accuracy(m, allPoints)]));
  render();
}

function render() {
  draw(shared);
  $("#round").textContent = String(round);
  $("#acc").textContent = fmt(100 * history[history.length - 1][1], 1) + "%";
  const series = [
    { name: "shared", color: "#111827", points: history.map(([r, a]) => [r, 100 * a]), width: 3 },
    ...aloneHistory.map((h, k) => ({ name: "client " + (k + 1) + " alone", color: CLIENT_COLORS[k], points: h.map(([r, a]) => [r, 100 * a]), dash: "6 4" })),
  ];
  lineChart($("#curve"), series, { xLabel: "round", yLabel: "accuracy on all points, %", yMin: 0, yMax: 100, xMax: Math.max(20, round) });
}

function play() {
  if (timer) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) { for (let i = 0; i < 20; i++) step(); return; }
  let left = 20;
  $("#play").disabled = true;
  timer = setInterval(() => {
    step();
    left -= 1;
    if (left <= 0) { clearInterval(timer); timer = null; $("#play").disabled = false; }
  }, 160);
}

bindRange($("#steps"), $("#steps-out"), (v) => v + (v === 1 ? " step" : " steps"));
$("#one").addEventListener("click", step);
$("#play").addEventListener("click", play);
$("#reset").addEventListener("click", () => { $("#play").disabled = false; reset(); });
reset();
