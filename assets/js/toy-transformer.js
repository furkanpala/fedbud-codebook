import { rng, fmt } from "./common.js";

/* A tiny transformer layer trained in the browser with TensorFlow.js, shared by Lessons 4, 6 and 7.
   Task: read 8 tokens from a vocabulary of 6 and say whether the first token appears again later.
   The answer is read from the first position, so the model needs attention to compare tokens. */

export const V = 6, L = 8, D = 16, H = 4, DH = 4, F = 16;
export const HEAD_COST = 4 * D * DH;   // 256 multiplications per token
export const NEURON_COST = 2 * D;      // 32 multiplications per token
export const FULL_COST = H * HEAD_COST + F * NEURON_COST;

const tf = () => window.tf;

/* queries: the tokens that may open a sequence; a client whose texts open with other tokens has other data. */
export function makeData(n, seed, queries = null) {
  const r = rng(seed);
  const x = new Int32Array(n * L), y = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    const q = queries ? queries[Math.floor(r() * queries.length)] : Math.floor(r() * V);
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
  const T = tf();
  return { n, x: T.tensor2d(x, [n, L], "int32"), y: T.oneHot(T.tensor1d(y, "int32"), 2).toFloat() };
}

function newParams(seed) {
  const T = tf();
  const v = (shape, std, s) => T.variable(T.randomNormal(shape, 0, std, "float32", seed * 101 + s));
  return {
    emb: v([V, D], 0.5, 1), pos: v([L, D], 0.1, 2),
    wq: [...Array(H)].map((_, i) => v([D, DH], 0.3, 10 + i)),
    wk: [...Array(H)].map((_, i) => v([D, DH], 0.3, 20 + i)),
    wv: [...Array(H)].map((_, i) => v([D, DH], 0.3, 30 + i)),
    wo: [...Array(H)].map((_, i) => v([DH, D], 0.3, 40 + i)),
    w1: v([D, F], 0.3, 50), b1: T.variable(T.zeros([F])),
    w2: v([F, D], 0.3, 51), b2: T.variable(T.zeros([D])),
    wc: v([D, 2], 0.3, 52), bc: T.variable(T.zeros([2])),
  };
}

/* Forward pass with masks: hm[i] = 0 drops head i, nm[j] = 0 drops neuron j.
   With keep = true it also returns the head outputs and the neuron activations, for importance scores. */
function forward(p, x, hm, nm, keep = false) {
  const T = tf();
  const B = x.shape[0];
  let h = T.gather(p.emb, x).add(p.pos);
  const flat = h.reshape([B * L, D]);
  let att = T.zeros([B, L, D]);
  const headOut = [];
  for (let i = 0; i < H; i++) {
    if (hm[i] === 0 && !keep) { headOut.push(null); continue; }
    const q = flat.matMul(p.wq[i]).reshape([B, L, DH]);
    const k = flat.matMul(p.wk[i]).reshape([B, L, DH]);
    const v = flat.matMul(p.wv[i]).reshape([B, L, DH]);
    const a = T.softmax(T.matMul(q, k, false, true).div(Math.sqrt(DH)));
    const oh = T.matMul(a, v).reshape([B * L, DH]);
    headOut.push(oh);
    att = att.add(oh.matMul(p.wo[i]).reshape([B, L, D]).mul(hm[i]));
  }
  h = h.add(att);
  const hid = T.relu(h.reshape([B * L, D]).matMul(p.w1).add(p.b1)).mul(T.tensor1d(nm));
  h = h.add(hid.matMul(p.w2).add(p.b2).reshape([B, L, D]));
  const logits = h.slice([0, 0, 0], [B, 1, D]).reshape([B, D]).matMul(p.wc).add(p.bc);
  return keep ? { logits, headOut, hid } : logits;
}

export async function trainToy({ seed = 3, steps = 300, onProgress = null, onNote = null } = {}) {
  const T = tf();
  try { if (!(await T.setBackend("webgl"))) await T.setBackend("cpu"); } catch { await T.setBackend("cpu"); }
  await T.ready();
  if (T.getBackend() !== "webgl" && onNote) onNote("This browser has no graphics acceleration, so training takes longer, up to half a minute.");
  const p = newParams(seed);
  const train = makeData(4000, seed);
  const test = makeData(1000, seed + 999);
  const opt = T.train.adam(0.01);
  const batch = 128;
  const ones = { h: new Array(H).fill(1), n: new Array(F).fill(1) };
  const t0 = performance.now();
  for (let s = 0; s < steps; s++) {
    const start = (s * batch) % (4000 - batch);
    T.tidy(() => {
      const xb = train.x.slice([start, 0], [batch, L]);
      const yb = train.y.slice([start, 0], [batch, 2]);
      opt.minimize(() => T.losses.softmaxCrossEntropy(yb, forward(p, xb, ones.h, ones.n)));
    });
    if (s % 20 === 19) {
      if (onProgress) onProgress((s + 1) / steps);
      await T.nextFrame();
    }
  }
  train.x.dispose(); train.y.dispose(); opt.dispose();
  const seconds = (performance.now() - t0) / 1000;

  const model = {
    seconds,
    test,
    accuracy(hm, nm, data = test) {
      return T.tidy(() => forward(p, data.x, hm, nm).argMax(1).equal(data.y.argMax(1)).toFloat().mean().dataSync()[0]);
    },
    /* The paper's importance scores (its Equation 3), on n examples of the client's data:
       head i: mean size of its output over tokens, times the size of the output-projection weights that read it;
       neuron j: mean size of its activation, times the size of its down-projection weights.
       Each score is divided by its layer total. */
    importance(data) {
      return T.tidy(() => {
        const out = forward(p, data.x, ones.h, ones.n, true);
        const heads = out.headOut.map((oh, i) => oh.abs().sum(1).mean().mul(p.wo[i].square().sum().sqrt()).dataSync()[0]);
        const neurons = Array.from(out.hid.abs().mean(0).mul(p.w2.square().sum(1).sqrt()).dataSync());
        const hs = heads.reduce((a, b) => a + b, 0), ns = neurons.reduce((a, b) => a + b, 0);
        return { heads: heads.map((v) => v / hs), neurons: neurons.map((v) => v / ns) };
      });
    },
    dispose() {
      Object.values(p).flat().forEach((t) => t.dispose());
      test.x.dispose(); test.y.dispose();
    },
  };
  model.fullAccuracy = model.accuracy(ones.h, ones.n);
  return model;
}

export function costOf(hm, nm) {
  const kept = hm.reduce((a, b) => a + b, 0) * HEAD_COST + nm.reduce((a, b) => a + b, 0) * NEURON_COST;
  return kept / FULL_COST;
}

export function trainedText(model) {
  return `Trained in ${fmt(model.seconds, 1)} seconds. The full layer answers ${fmt(100 * model.fullAccuracy, 1)}% of 1,000 new questions correctly.`;
}
