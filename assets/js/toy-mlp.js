import { rng } from "./common.js";

/* A toy federation for Lessons 8 and 9: three clients, a network with 2 inputs, 8 hidden neurons and 2 outputs,
   written in plain JavaScript with its gradients by hand.
   Points in the square [-2, 2] x [-2, 2] belong to class 1 when x and y have the same sign.
   Client A holds points from the whole square, client B only from its left half, client C only from its lower half.
   Each client keeps some hidden neurons, as a sub-network keeps some parts of the large model.
   Lesson 9 adds the optional shared graph network: each layer output o becomes o + eta (gamma o + beta),
   where gamma and beta come from a shared network that reads the client's graph, and eta starts at zero. */

export const HID = 8;
export const KEPT = { A: [0, 1, 2, 3, 4, 5, 6, 7], B: [0, 1, 4, 5], C: [2, 3, 6, 7] };
const NAMES = ["A", "B", "C"];
const GRAPH_DIM = HID, EMB = 4;
export let FILM_LR = 0.03;
export function setFilmLr(v) { FILM_LR = v; }

function points(n, r, region) {
  const out = [];
  while (out.length < n) {
    const x = -2 + 4 * r(), y = -2 + 4 * r();
    if (region === "left" && x > 0) continue;
    if (region === "low" && y > 0) continue;
    out.push({ x, y, c: x * y > 0 ? 1 : 0 });
  }
  return out;
}

export function makeClients(seed = 5) {
  const r = rng(seed);
  return {
    data: { A: points(150, r, "all"), B: points(100, r, "left"), C: points(100, r, "low") },
    test: points(400, r, "all"),
  };
}

function initWeights(seed) {
  const r = rng(seed);
  const g = () => (r() * 2 - 1);
  return {
    W1: [...Array(HID)].map(() => [g() * 1.2, g() * 1.2]),
    b1: [...Array(HID)].map(() => g() * 0.5),
    W2: [0, 1].map(() => [...Array(HID)].map(() => g() * 0.8)),
    b2: [0, 0],
  };
}

const clone = (w) => JSON.parse(JSON.stringify(w));

function filmParams(seed) {
  const r = rng(seed);
  return {
    Phi: [...Array(EMB)].map(() => [...Array(GRAPH_DIM)].map(() => (r() * 2 - 1) * 0.5)),
    Psi: [...Array(2 * HID)].map(() => [...Array(EMB)].map(() => (r() * 2 - 1) * 0.3)),
    c: new Array(2 * HID).fill(0),
    eta: 0,
  };
}

/* The client's graph: here simply which hidden neurons it keeps. */
const graphOf = (kept) => [...Array(HID)].map((_, j) => (kept.includes(j) ? 1 : 0));

function filmCoefs(f, g) {
  const e = f.Phi.map((row) => Math.tanh(row.reduce((s, v, i) => s + v * g[i], 0)));
  const gb = f.Psi.map((row, o) => row.reduce((s, v, i) => s + v * e[i], 0) + f.c[o]);
  return { e, gamma: gb.slice(0, HID), beta: gb.slice(HID) };
}

function forward(w, mask, p, film) {
  const a = w.W1.map((row, j) => row[0] * p.x + row[1] * p.y + w.b1[j]);
  const h = a.map((v, j) => Math.tanh(v) * mask[j]);
  let hp = h;
  if (film) hp = h.map((v, j) => mask[j] * (v + film.eta * (film.gamma[j] * v + film.beta[j])));
  const z = [0, 1].map((o) => w.W2[o].reduce((s, v, j) => s + v * hp[j], 0) + w.b2[o]);
  const m = Math.max(z[0], z[1]);
  const ez = z.map((v) => Math.exp(v - m));
  const s = ez[0] + ez[1];
  return { a, h, hp, prob: [ez[0] / s, ez[1] / s] };
}

function localTrain(client, steps, lr, useFilm) {
  const { w, mask, data } = client;
  const g = graphOf(client.kept);
  for (let t = 0; t < steps; t++) {
    const gW1 = w.W1.map(() => [0, 0]), gb1 = new Array(HID).fill(0);
    const gW2 = [0, 1].map(() => new Array(HID).fill(0)), gb2 = [0, 0];
    let fc = null, gGamma = null, gBeta = null, gEta = 0;
    if (useFilm) { fc = filmCoefs(client.film, g); fc.eta = client.film.eta; gGamma = new Array(HID).fill(0); gBeta = new Array(HID).fill(0); }
    for (const p of data) {
      const f = forward(w, mask, p, fc);
      const dz = [f.prob[0] - (p.c === 0 ? 1 : 0), f.prob[1] - (p.c === 1 ? 1 : 0)];
      for (let o = 0; o < 2; o++) { gb2[o] += dz[o]; for (let j = 0; j < HID; j++) gW2[o][j] += dz[o] * f.hp[j]; }
      for (let j = 0; j < HID; j++) {
        if (!mask[j]) continue;
        const dhp = dz[0] * w.W2[0][j] + dz[1] * w.W2[1][j];
        let dh = dhp;
        if (useFilm) {
          gEta += dhp * (fc.gamma[j] * f.h[j] + fc.beta[j]);
          gGamma[j] += dhp * fc.eta * f.h[j];
          gBeta[j] += dhp * fc.eta;
          dh = dhp * (1 + fc.eta * fc.gamma[j]);
        }
        const da = dh * (1 - Math.tanh(f.a[j]) ** 2);
        gW1[j][0] += da * p.x; gW1[j][1] += da * p.y; gb1[j] += da;
      }
    }
    const n = data.length;
    for (let j = 0; j < HID; j++) {
      if (!mask[j]) continue;
      w.W1[j][0] -= (lr * gW1[j][0]) / n; w.W1[j][1] -= (lr * gW1[j][1]) / n; w.b1[j] -= (lr * gb1[j]) / n;
      for (let o = 0; o < 2; o++) w.W2[o][j] -= (lr * gW2[o][j]) / n;
    }
    for (let o = 0; o < 2; o++) w.b2[o] -= (lr * gb2[o]) / n;
    if (useFilm) {
      // the graph network, the private part and the gate learn more slowly than the weights
      const fl = lr * FILM_LR;
      const f = client.film;
      const dGB = [...gGamma, ...gBeta].map((v) => v / n);
      const dE = new Array(EMB).fill(0);
      for (let o = 0; o < 2 * HID; o++) { for (let i = 0; i < EMB; i++) { dE[i] += f.Psi[o][i] * dGB[o]; f.Psi[o][i] -= fl * dGB[o] * fc.e[i]; } f.c[o] -= fl * dGB[o]; }
      for (let i = 0; i < EMB; i++) { const de = dE[i] * (1 - fc.e[i] ** 2); for (let q = 0; q < GRAPH_DIM; q++) f.Phi[i][q] -= fl * de * g[q]; }
      f.eta -= (fl * gEta) / n;
    }
  }
}

function aggregate(clients, rule) {
  if (rule === "alone") return;
  const total = clients.reduce((s, c) => s + c.data.length, 0);
  // the output bias belongs to every client
  const b2 = [0, 1].map((o) => clients.reduce((s, c) => s + c.data.length * c.w.b2[o], 0) / total);
  clients.forEach((c) => { c.w.b2 = b2.slice(); });
  if (rule === "aligned") {
    for (let j = 0; j < HID; j++) {
      const owners = clients.filter((c) => c.mask[j]);
      if (!owners.length) continue;
      const n = owners.reduce((s, c) => s + c.data.length, 0);
      const avg = (get) => owners.reduce((s, c) => s + c.data.length * get(c), 0) / n;
      const w1 = [avg((c) => c.w.W1[j][0]), avg((c) => c.w.W1[j][1])], b1 = avg((c) => c.w.b1[j]);
      const w2 = [avg((c) => c.w.W2[0][j]), avg((c) => c.w.W2[1][j])];
      owners.forEach((c) => { c.w.W1[j] = w1.slice(); c.w.b1[j] = b1; c.w.W2[0][j] = w2[0]; c.w.W2[1][j] = w2[1]; });
    }
  } else if (rule === "position") {
    for (let r = 0; r < HID; r++) {
      const owners = clients.filter((c) => r < c.kept.length);
      if (!owners.length) continue;
      const n = owners.reduce((s, c) => s + c.data.length, 0);
      const at = (c) => c.kept[r];
      const avg = (get) => owners.reduce((s, c) => s + c.data.length * get(c), 0) / n;
      const w1 = [avg((c) => c.w.W1[at(c)][0]), avg((c) => c.w.W1[at(c)][1])], b1 = avg((c) => c.w.b1[at(c)]);
      const w2 = [avg((c) => c.w.W2[0][at(c)]), avg((c) => c.w.W2[1][at(c)])];
      owners.forEach((c) => { const j = at(c); c.w.W1[j] = w1.slice(); c.w.b1[j] = b1; c.w.W2[0][j] = w2[0]; c.w.W2[1][j] = w2[1]; });
    }
  }
}

function aggregateFilm(clients) {
  const total = clients.reduce((s, c) => s + c.data.length, 0);
  const Phi = clients[0].film.Phi.map((row, i) => row.map((_, q) => clients.reduce((s, c) => s + c.data.length * c.film.Phi[i][q], 0) / total));
  clients.forEach((c) => { c.film.Phi = Phi.map((row) => row.slice()); });
}

export function accuracy(client, test, useFilm) {
  let fc = null;
  if (useFilm) { fc = filmCoefs(client.film, graphOf(client.kept)); fc.eta = client.film.eta; }
  let ok = 0;
  for (const p of test) { const f = forward(client.w, client.mask, p, fc); ok += (f.prob[1] > 0.5 ? 1 : 0) === p.c ? 1 : 0; }
  return ok / test.length;
}

/* The "large model": the full network, pretrained on a related public task (the same pattern, shifted),
   so that every neuron already has a role before the clients inherit it, as in the paper. */
const pretrainedCache = new Map();
function pretrained(seed) {
  if (pretrainedCache.has(seed)) return clone(pretrainedCache.get(seed));
  const r = rng(seed + 3);
  const pub = [];
  for (let i = 0; i < 400; i++) { const x = -2 + 4 * r(), y = -2 + 4 * r(); pub.push({ x, y, c: (x - 0.4) * (y + 0.4) > 0 ? 1 : 0 }); }
  const full = { kept: [...Array(HID).keys()], mask: new Array(HID).fill(1), data: pub, w: initWeights(seed + 1) };
  localTrain(full, 400, 0.5, false);
  pretrainedCache.set(seed, clone(full.w));
  return clone(full.w);
}

/* A federation: rule is "aligned", "position" or "alone"; useFilm adds the shared graph network. */
export function makeFederation(rule, { seed = 5, useFilm = false } = {}) {
  const { data, test } = makeClients(seed);
  const base = pretrained(seed);
  const clients = NAMES.map((name, k) => ({
    name, kept: KEPT[name], mask: graphOf(KEPT[name]), data: data[name], w: clone(base), film: filmParams(seed + 10 + k),
  }));
  if (useFilm) { const Phi = clients[0].film.Phi; clients.forEach((c) => { c.film.Phi = Phi.map((row) => row.slice()); }); }
  return {
    clients, test, rule, useFilm,
    round(steps = 10, lr = 0.3) {
      clients.forEach((c) => localTrain(c, steps, lr, useFilm));
      aggregate(clients, rule);
      if (useFilm && rule !== "alone") aggregateFilm(clients);
    },
    meanAccuracy() { return clients.reduce((s, c) => s + accuracy(c, test, useFilm), 0) / clients.length; },
  };
}
