import { $, bindRange, fmt, rng } from "./common.js";
import { H, F, HEAD_COST, NEURON_COST, FULL_COST, trainToy, makeData, trainedText } from "./toy-transformer.js";

/* Lesson 7: the allocator on the toy layer. Parts 0..3 are heads, parts 4..19 are neurons.
   A configuration is a keep mask over the 20 parts. Every way to choose keeps at least one head. */

const P = H + F;
const partCost = [...Array(P)].map((_, i) => (i < H ? HEAD_COST : NEURON_COST));
const partName = (i) => (i < H ? `head ${i + 1}` : `neuron ${i - H + 1}`);

let model = null, score = null, val = null;
let keep = new Array(P).fill(1);

const masks = (k) => [k.slice(0, H), k.slice(H)];
const cost = (k) => k.reduce((s, v, i) => s + v * partCost[i], 0) / FULL_COST;
const headsLeft = (k) => k.slice(0, H).reduce((a, b) => a + b, 0);
const acc = (k, data) => model.accuracy(...masks(k), data);

/* Remove parts in the order given by `rank` (lowest first) until the configuration fits the budget. */
function repair(k, budget, rank) {
  const out = k.slice();
  const order = [...Array(P).keys()].sort((a, b) => rank[a] - rank[b]);
  for (const i of order) {
    if (cost(out) <= budget + 1e-9) break;
    if (!out[i]) continue;
    if (i < H && headsLeft(out) === 1) continue;
    out[i] = 0;
  }
  return out;
}

const ratioRank = () => score.map((s, i) => s / partCost[i]);

function ruleMlpFirst(budget) {
  // neurons first, lowest score first; heads only when no neuron is left
  const rank = score.map((s, i) => (i < H ? 10 + s : s));
  return repair(new Array(P).fill(1), budget, rank);
}

function ruleWidthOnly(budget) {
  // remove the same share of heads and of neurons, lowest scores first inside each block
  const byScore = (lo, hi) => [...Array(hi - lo).keys()].map((j) => lo + j).sort((a, b) => score[a] - score[b]);
  const hs = byScore(0, H), ns = byScore(H, P);
  for (let share = 0; share <= 1.0001; share += 1 / 16) {
    const k = new Array(P).fill(1);
    hs.slice(0, Math.min(H - 1, Math.round(share * H))).forEach((i) => { k[i] = 0; });
    ns.slice(0, Math.round(share * F)).forEach((i) => { k[i] = 0; });
    if (cost(k) <= budget + 1e-9) return k;
  }
  return repair(new Array(P).fill(1), budget, ratioRank());
}

function randomAverage(budget, seed) {
  const r = rng(seed);
  let s = 0;
  for (let t = 0; t < 20; t++) {
    const rank = [...Array(P)].map(() => r());
    s += acc(repair(new Array(P).fill(1), budget, rank), model.test);
  }
  return s / 20;
}

/* A small learned policy: one keep probability per part, 40 rounds of 8 sampled configurations,
   budget repair where the policy is most willing to give up, reward = validation accuracy. */
async function learnedPolicy(budget, seed, onIter = null) {
  const r = rng(seed);
  const logit = new Array(P).fill(Math.log(0.7 / 0.3));
  const sig = (z) => 1 / (1 + Math.exp(-z));
  let best = null, bestVal = -1;
  for (let it = 0; it < 40; it++) {
    const samples = [];
    for (let j = 0; j < 8; j++) {
      const p = logit.map(sig);
      const k = p.map((pi) => (r() < pi ? 1 : 0));
      if (headsLeft(k) === 0) k[p.slice(0, H).indexOf(Math.max(...p.slice(0, H)))] = 1;
      const raw = cost(k);
      const kr = repair(k, budget, p);
      const v = acc(kr, val);
      samples.push({ k: kr, v, raw, fixed: cost(kr) });
      if (v > bestVal) { bestVal = v; best = kr; }
    }
    const mean = samples.reduce((a, s) => a + s.v, 0) / 8;
    const sd = Math.sqrt(samples.reduce((a, s) => a + (s.v - mean) ** 2, 0) / 8) + 1e-6;
    for (const s of samples) {
      const adv = (s.v - mean) / sd;
      for (let i = 0; i < P; i++) logit[i] += (0.3 / 8) * adv * (s.k[i] - sig(logit[i]));
    }
    if (onIter) onIter({ it, p: logit.map(sig), samples: samples.map((s) => ({ raw: s.raw, fixed: s.fixed, v: s.v })), bestVal });
    if (it % 10 === 9) await new Promise((res) => setTimeout(res, 0));
  }
  // the most probable configuration, repaired, is checked against the best one found
  const top = repair(logit.map((z) => (sig(z) > 0.5 ? 1 : 0)), budget, logit.map(sig));
  if (headsLeft(top) > 0 && acc(top, val) >= bestVal) best = top;
  return best;
}

/* ---------- part 1: the student is the allocator ---------- */
function drawParts(shown = keep) {
  const box = $("#parts");
  box.innerHTML = "";
  shown.forEach((v, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "toggle";
    b.style.display = "flex"; b.style.flexDirection = "column"; b.style.lineHeight = "1.1"; b.style.padding = "4px 0";
    b.setAttribute("aria-pressed", String(v === 1));
    b.setAttribute("aria-label", `${partName(i)}, score ${fmt(score[i], 2)}, ${v ? "kept" : "removed"}`);
    b.innerHTML = `<span>${i < H ? "H" + (i + 1) : "N" + (i - H + 1)}</span><span style="font-size:0.75rem;font-weight:400">${fmt(score[i], 2)}</span>`;
    b.addEventListener("click", () => {
      if (keep[i] && i < H && headsLeft(keep) === 1) { $("#step-note").textContent = "FedBUD keeps at least one head, so this head stays."; return; }
      keep[i] = keep[i] ? 0 : 1;
      updatePart1();
      $("#parts").children[i].focus();
    });
    box.appendChild(b);
  });
}

function updatePart1(note) {
  const budget = Number($("#budget").value);
  const c = cost(keep);
  const ok = c <= budget + 1e-9;
  $("#cost-txt").textContent = fmt(c, 2);
  $("#cost-fill").style.width = 100 * c + "%";
  $("#cost-fill").classList.toggle("over", !ok);
  $("#budget-lim").style.left = 100 * budget + "%";
  $("#acc").textContent = fmt(100 * acc(keep, model.test), 1) + "%" + (ok ? "" : " (too costly)");
  $("#acc-rule").textContent = fmt(100 * acc(ruleMlpFirst(budget), model.test), 1) + "%";
  $("#step-note").textContent = note || (ok ? "Your sub-network fits the budget." : "Your sub-network is still too costly. Remove more parts.");
  drawParts();
}

function showRule() {
  const budget = Number($("#budget").value);
  const k = ruleMlpFirst(budget);
  const removed = k.map((v, i) => (v ? null : partName(i))).filter(Boolean);
  $("#step-note").textContent = `At a budget of ${fmt(budget, 2)}, the feed-forward-first rule removes ${removed.length} parts: ${removed.join(", ")}.`;
}

/* ---------- part 2: the comparison ---------- */
async function compare() {
  const btn = $("#compare");
  btn.disabled = true;
  const budgets = [0.4, 0.6, 0.8];
  const rows = [
    ["Feed-forward-first rule", (b) => ruleMlpFirst(b)],
    ["Same-share rule", (b) => ruleWidthOnly(b)],
    ["Random sub-networks, average of 20", null],
    ["Learned policy", "policy"],
  ];
  const results = rows.map(() => []);
  for (const [bi, b] of budgets.entries()) {
    const slow = window.tf.getBackend() !== "webgl" ? " This browser has no graphics acceleration, so the comparison takes longer." : "";
    $("#cmp-status").textContent = `Comparing at a budget of ${fmt(b, 1)}...${slow}`;
    await new Promise((res) => setTimeout(res, 0));
    for (const [ri, [, fn]] of rows.entries()) {
      let a;
      if (fn === null) a = randomAverage(b, 100 + bi);
      else if (fn === "policy") a = acc(await learnedPolicy(b, 200 + bi), model.test);
      else a = acc(fn(b), model.test);
      results[ri].push(a);
    }
  }
  const tbody = $("#cmp-table tbody");
  tbody.innerHTML = "";
  rows.forEach(([name], ri) => {
    const tr = document.createElement("tr");
    const best = budgets.map((_, bi) => Math.max(...results.map((r) => r[bi])));
    tr.innerHTML = `<th scope="row">${name}</th>` + results[ri].map((a, bi) => {
      const isBest = Math.abs(a - best[bi]) < 1e-9;
      return `<td>${isBest ? "<strong>" : ""}${fmt(100 * a, 1)}%${isBest ? "</strong>" : ""}</td>`;
    }).join("");
    tbody.appendChild(tr);
  });
  $("#cmp-table").hidden = false;
  $("#cmp-status").textContent = "Done. Bold marks the best way at each budget, on 1,000 test questions.";
  btn.disabled = false;
}

async function start() {
  if (!window.tf) { $("#train-status").textContent = "The training library did not load. Check your internet connection and reload the page."; return; }
  $("#train-status").textContent = "Training the toy model in your browser...";
  model = await trainToy({ seed: 3, onProgress: (f) => { $("#train-fill").style.width = 100 * f + "%"; }, onNote: (t) => { $("#train-status").textContent = t; } });
  const s = model.importance(makeData(32, 11));
  score = [...s.heads, ...s.neurons];
  val = makeData(300, 21);
  $("#train-status").textContent = trainedText(model);
  $("#lab").hidden = false;
  $("#compare").disabled = false;
  updatePart1("Press a part to remove it, and press it again to bring it back.");
  // the live figure (fig07.js) replays the learned policy's search on this model
  window.__toy7 = { learnedPolicy, cost, partName, H, P, acc: (k) => acc(k, model.test) };
  window.dispatchEvent(new Event("toy7-ready"));
}

bindRange($("#budget"), $("#budget-out"), (v) => fmt(v, 2), () => { if (model) updatePart1(); });
$("#show-rule").addEventListener("click", showRule);
$("#restart").addEventListener("click", () => { keep = new Array(P).fill(1); updatePart1("Back to the full layer."); });
$("#compare").addEventListener("click", compare);
start();
