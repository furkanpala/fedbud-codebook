import { $, bindRange, fmt, rng } from "./common.js";

/* A tiny transformer layer trained in the browser with TensorFlow.js.
   Task: read 8 tokens from a vocabulary of 6 and say whether the first token appears again later.
   The answer is read from the first position, so the model needs attention to compare tokens. */

const tf = window.tf;
const V = 6, L = 8, D = 16, H = 4, DH = 4, F = 16;
const HEAD_COST = 4 * D * DH;   // 256
const NEURON_COST = 2 * D;      // 32
const FULL_COST = H * HEAD_COST + F * NEURON_COST;

function makeData(n, seed) {
  const r = rng(seed);
  const x = new Int32Array(n * L), y = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    const q = Math.floor(r() * V);
    const label = r() < 0.5 ? 1 : 0;
    x[i * L] = q;
    for (let j = 1; j < L; j++) {
      let t;
      do { t = Math.floor(r() * V); } while (t === q);
      x[i * L + j] = t;
    }
    if (label) x[i * L + 1 + Math.floor(r() * (L - 1))] = q;
    y[i] = label;
  }
  return { x: tf.tensor2d(x, [n, L], "int32"), y: tf.oneHot(tf.tensor1d(y, "int32"), 2).toFloat(), labels: y };
}

let params = null;
const headMask = new Array(H).fill(1);
const neuronMask = new Array(F).fill(1);

function newParams(seed) {
  const v = (shape, std, s) => tf.variable(tf.randomNormal(shape, 0, std, "float32", seed * 101 + s));
  return {
    emb: v([V, D], 0.5, 1), pos: v([L, D], 0.1, 2),
    wq: [...Array(H)].map((_, i) => v([D, DH], 0.3, 10 + i)),
    wk: [...Array(H)].map((_, i) => v([D, DH], 0.3, 20 + i)),
    wv: [...Array(H)].map((_, i) => v([D, DH], 0.3, 30 + i)),
    wo: [...Array(H)].map((_, i) => v([DH, D], 0.3, 40 + i)),
    w1: v([D, F], 0.3, 50), b1: tf.variable(tf.zeros([F])),
    w2: v([F, D], 0.3, 51), b2: tf.variable(tf.zeros([D])),
    wc: v([D, 2], 0.3, 52), bc: tf.variable(tf.zeros([2])),
  };
}

function forward(x, hm, nm) {
  const p = params;
  const B = x.shape[0];
  let h = tf.gather(p.emb, x).add(p.pos);               // [B, L, D]
  const flat = h.reshape([B * L, D]);
  let att = tf.zeros([B, L, D]);
  for (let i = 0; i < H; i++) {
    if (hm[i] === 0) continue;
    const q = flat.matMul(p.wq[i]).reshape([B, L, DH]);
    const k = flat.matMul(p.wk[i]).reshape([B, L, DH]);
    const v = flat.matMul(p.wv[i]).reshape([B, L, DH]);
    const a = tf.softmax(tf.matMul(q, k, false, true).div(Math.sqrt(DH)));
    const o = tf.matMul(a, v).reshape([B * L, DH]).matMul(p.wo[i]).reshape([B, L, D]);
    att = att.add(o.mul(hm[i]));
  }
  h = h.add(att);
  const hid = tf.relu(h.reshape([B * L, D]).matMul(p.w1).add(p.b1)).mul(tf.tensor1d(nm));
  h = h.add(hid.matMul(p.w2).add(p.b2).reshape([B, L, D]));
  const first = h.slice([0, 0, 0], [B, 1, D]).reshape([B, D]);
  return first.matMul(p.wc).add(p.bc);
}

let test = null, accFull = 0;

function accuracy(hm, nm) {
  return tf.tidy(() => {
    const pred = forward(test.x, hm, nm).argMax(1);
    const truth = test.y.argMax(1);
    return pred.equal(truth).toFloat().mean().dataSync()[0];
  });
}

async function trainModel(seed) {
  $("#lab").hidden = true;
  const status = $("#train-status"), fill = $("#train-fill");
  status.textContent = "Training the toy model in your browser...";
  try { if (!(await tf.setBackend("webgl"))) await tf.setBackend("cpu"); } catch { await tf.setBackend("cpu"); }
  await tf.ready();
  if (params) Object.values(params).flat().forEach((t) => t.dispose());
  if (test) { test.x.dispose(); test.y.dispose(); }
  params = newParams(seed);
  const train = makeData(4000, seed);
  test = makeData(1000, seed + 999);
  const opt = tf.train.adam(0.01);
  const steps = 300, batch = 128;
  const ones = { h: new Array(H).fill(1), n: new Array(F).fill(1) };
  const t0 = performance.now();
  for (let s = 0; s < steps; s++) {
    const start = (s * batch) % (4000 - batch);
    tf.tidy(() => {
      const xb = train.x.slice([start, 0], [batch, L]);
      const yb = train.y.slice([start, 0], [batch, 2]);
      opt.minimize(() => tf.losses.softmaxCrossEntropy(yb, forward(xb, ones.h, ones.n)));
    });
    if (s % 20 === 19) {
      fill.style.width = (100 * (s + 1)) / steps + "%";
      await tf.nextFrame();
    }
  }
  train.x.dispose(); train.y.dispose(); opt.dispose();
  accFull = accuracy(ones.h, ones.n);
  const secs = (performance.now() - t0) / 1000;
  status.textContent = `Trained in ${fmt(secs, 1)} seconds. The full layer answers ${fmt(100 * accFull, 1)}% of 1,000 new questions correctly.`;
  $("#lab").hidden = false;
  update();
}

function costOf() {
  const kept = headMask.reduce((a, b) => a + b, 0) * HEAD_COST + neuronMask.reduce((a, b) => a + b, 0) * NEURON_COST;
  return kept / FULL_COST;
}

function update() {
  const cost = costOf();
  const budget = Number($("#budget").value);
  $("#cost-txt").textContent = fmt(cost, 2);
  $("#cost-fill").style.width = 100 * cost + "%";
  $("#cost-fill").classList.toggle("over", cost > budget + 1e-9);
  $("#budget-lim").style.left = 100 * budget + "%";
  const fit = $("#fit");
  fit.textContent = cost <= budget + 1e-9 ? "yes" : "no, cut more parts";
  fit.className = "status " + (cost <= budget + 1e-9 ? "good" : "bad");
  if (params) {
    $("#acc-full").textContent = fmt(100 * accFull, 1) + "%";
    $("#acc-sub").textContent = fmt(100 * accuracy(headMask, neuronMask), 1) + "%";
  }
}

function makeToggles(container, mask, prefix, label) {
  container.innerHTML = "";
  mask.forEach((_, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "toggle";
    b.textContent = prefix + (i + 1);
    b.setAttribute("aria-pressed", "true");
    b.setAttribute("aria-label", `${label} ${i + 1}`);
    b.addEventListener("click", () => {
      mask[i] = mask[i] ? 0 : 1;
      b.setAttribute("aria-pressed", String(mask[i] === 1));
      update();
    });
    container.appendChild(b);
  });
}

makeToggles($("#heads"), headMask, "H", "Head");
makeToggles($("#neurons"), neuronMask, "N", "Neuron");
bindRange($("#budget"), $("#budget-out"), (v) => fmt(v, 2), update);
$("#all-on").addEventListener("click", () => {
  headMask.fill(1); neuronMask.fill(1);
  document.querySelectorAll(".toggle").forEach((b) => b.setAttribute("aria-pressed", "true"));
  update();
});
let seed = 3;
$("#retrain").addEventListener("click", () => { seed += 1; trainModel(seed); });

if (!tf) {
  $("#train-status").textContent = "The training library did not load. Check your internet connection and reload the page.";
} else {
  trainModel(seed);
}
