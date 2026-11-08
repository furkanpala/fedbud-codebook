/* FedBUD codebook: shared behavior for every page.
   - "Show the result" buttons reveal an answer block.
   - Number and choice questions check the student's answer.
   - Python cells run in the browser through Pyodide, loaded only when a student presses Run.
   - Small SVG charts (line and bar) for the lessons.
   No build step and no server: everything runs in the student's browser. */

const PYODIDE_VERSION = "0.26.4";
const PYODIDE_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

/* ---------- small helpers ---------- */
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export function fmt(x, digits = 2) {
  return Number(x).toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/* Seeded random numbers, so a lesson gives the same toy data on every visit. */
export function rng(seed = 1) {
  let s = seed >>> 0;
  return function next() {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function gauss(rand) {
  const u = Math.max(rand(), 1e-12);
  const v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/* Bind a range input to its <output> and call onChange with the number. */
export function bindRange(input, output, format, onChange) {
  const update = () => {
    const v = Number(input.value);
    if (output) output.value = format ? format(v) : String(v);
    input.setAttribute("aria-valuetext", output ? output.value : String(v));
    if (onChange) onChange(v);
  };
  input.addEventListener("input", update);
  update();
  return update;
}

/* ---------- questions ---------- */
function setupReveal(btn) {
  const target = document.getElementById(btn.dataset.reveal);
  if (!target) return;
  btn.setAttribute("aria-controls", target.id);
  btn.setAttribute("aria-expanded", "false");
  const showText = btn.textContent;
  btn.addEventListener("click", () => {
    const open = target.hidden;
    target.hidden = !open;
    btn.setAttribute("aria-expanded", String(open));
    btn.textContent = open ? "Hide the result" : showText;
    if (open) target.focus({ preventScroll: true });
  });
}

function setupNumberQuestion(q) {
  const input = $("input", q);
  const btn = $("[data-check]", q);
  const fb = $(".feedback", q);
  const answer = Number(q.dataset.answer);
  const tol = Number(q.dataset.tol || 0);
  if (!input || !btn || !fb) return;
  const check = () => {
    const raw = input.value.trim().replace(",", ".");
    if (raw === "") { fb.textContent = "Type a number first."; fb.className = "feedback bad"; return; }
    const v = Number(raw);
    const ok = Number.isFinite(v) && Math.abs(v - answer) <= tol + 1e-9;
    fb.textContent = ok ? "Correct." : "Not yet. Try again, or show the result.";
    fb.className = "feedback " + (ok ? "good" : "bad");
  };
  btn.addEventListener("click", check);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") check(); });
}

function setupChoiceQuestion(q) {
  const btn = $("[data-check]", q);
  const fb = $(".feedback", q);
  if (!btn || !fb) return;
  btn.addEventListener("click", () => {
    const picked = $("input[type=radio]:checked", q);
    if (!picked) { fb.textContent = "Pick one answer first."; fb.className = "feedback bad"; return; }
    const ok = picked.value === q.dataset.answer;
    fb.textContent = ok ? "Correct." : "Not yet. Try again, or show the result.";
    fb.className = "feedback " + (ok ? "good" : "bad");
  });
}

/* ---------- Python cells ---------- */
let pyodidePromise = null;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error("Could not load " + src));
    document.head.appendChild(s);
  });
}

export function getPyodide(statusEl) {
  if (!pyodidePromise) {
    pyodidePromise = (async () => {
      if (statusEl) statusEl.textContent = "Loading Python in your browser. The first run takes a few seconds.";
      await loadScript(PYODIDE_URL + "pyodide.js");
      const py = await window.loadPyodide({ indexURL: PYODIDE_URL });
      await py.loadPackage("numpy");
      return py;
    })();
    pyodidePromise.catch(() => { pyodidePromise = null; });
  }
  return pyodidePromise;
}

function setupCodeCell(cell) {
  const ta = $("textarea", cell);
  const run = $("[data-run]", cell);
  const reset = $("[data-reset]", cell);
  const out = $("pre.out", cell);
  if (!ta || !run || !out) return;
  const original = ta.value;
  ta.addEventListener("keydown", (e) => {
    if (e.key === "Tab" && !e.shiftKey && !e.ctrlKey) {
      // a Tab inside the editor indents; Shift+Tab or Escape then Tab leaves it
      e.preventDefault();
      const { selectionStart: a, selectionEnd: b } = ta;
      ta.value = ta.value.slice(0, a) + "    " + ta.value.slice(b);
      ta.selectionStart = ta.selectionEnd = a + 4;
    } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      run.click();
    } else if (e.key === "Escape") {
      run.focus();
    }
  });
  run.addEventListener("click", async () => {
    run.disabled = true;
    out.classList.remove("error");
    out.textContent = "Running...";
    try {
      const py = await getPyodide(out);
      let text = "";
      py.setStdout({ batched: (s) => { text += s + "\n"; } });
      py.setStderr({ batched: (s) => { text += s + "\n"; } });
      const result = await py.runPythonAsync(ta.value);
      if (result !== undefined && result !== null && text === "") text = String(result);
      out.textContent = text.trim() === "" ? "(no output; use print to show a value)" : text.trimEnd();
    } catch (err) {
      out.classList.add("error");
      out.textContent = String(err.message || err).split("\n").slice(-6).join("\n");
    } finally {
      run.disabled = false;
    }
  });
  if (reset) reset.addEventListener("click", () => { ta.value = original; out.textContent = ""; out.classList.remove("error"); });
}

/* ---------- SVG charts ---------- */
const NS = "http://www.w3.org/2000/svg";
function el(name, attrs = {}, parent) {
  const e = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (parent) parent.appendChild(e);
  return e;
}

/* Line chart. series: [{name, color, points: [[x, y], ...], dash}] */
export function lineChart(svg, series, { xLabel = "", yLabel = "", yMin = null, yMax = null, xMax = null, width = 640, height = 300 } = {}) {
  svg.innerHTML = "";
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  const m = { l: 56, r: 16, t: 16, b: 44 };
  const W = width - m.l - m.r, H = height - m.t - m.b;
  const all = series.flatMap((s) => s.points);
  const xs = all.map((p) => p[0]), ys = all.map((p) => p[1]);
  const x0 = Math.min(0, ...xs), x1 = xMax ?? Math.max(1, ...xs);
  let y0 = yMin ?? Math.min(...ys), y1 = yMax ?? Math.max(...ys);
  if (!Number.isFinite(y0) || !Number.isFinite(y1)) { y0 = 0; y1 = 1; }
  if (y1 - y0 < 1e-9) { y1 = y0 + 1; }
  const X = (x) => m.l + ((x - x0) / (x1 - x0 || 1)) * W;
  const Y = (y) => m.t + H - ((y - y0) / (y1 - y0)) * H;
  const g = el("g", {}, svg);
  for (let i = 0; i <= 4; i++) {
    const yv = y0 + ((y1 - y0) * i) / 4;
    el("line", { x1: m.l, x2: m.l + W, y1: Y(yv), y2: Y(yv), stroke: "#e5e7f2" }, g);
    el("text", { x: m.l - 8, y: Y(yv) + 4, "text-anchor": "end" }, g).textContent = fmt(yv, Math.abs(y1 - y0) < 5 ? 2 : 0);
  }
  el("line", { x1: m.l, x2: m.l + W, y1: m.t + H, y2: m.t + H, stroke: "#9ca3af" }, g);
  el("text", { x: m.l + W / 2, y: height - 8, "text-anchor": "middle" }, g).textContent = xLabel;
  const yl = el("text", { x: 14, y: m.t + H / 2, "text-anchor": "middle", transform: `rotate(-90 14 ${m.t + H / 2})` }, g);
  yl.textContent = yLabel;
  for (const s of series) {
    if (!s.points.length) continue;
    const d = s.points.map((p, i) => `${i ? "L" : "M"}${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join("");
    el("path", { d, fill: "none", stroke: s.color, "stroke-width": s.width || 2.5, "stroke-dasharray": s.dash || "none" }, g);
    const last = s.points[s.points.length - 1];
    el("circle", { cx: X(last[0]), cy: Y(last[1]), r: 4, fill: s.color }, g);
  }
  return { X, Y };
}

/* Bar chart. bars: [{label, value, color, note}] */
export function barChart(svg, bars, { yLabel = "", yMin = 0, yMax = null, width = 640, height = 300, digits = 2, limit = null, limitLabel = "" } = {}) {
  svg.innerHTML = "";
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  const m = { l: 56, r: 16, t: 20, b: 56 };
  const W = width - m.l - m.r, H = height - m.t - m.b;
  const top = yMax ?? Math.max(...bars.map((b) => b.value), limit ?? 0) * 1.1;
  const Y = (y) => m.t + H - ((y - yMin) / (top - yMin || 1)) * H;
  const g = el("g", {}, svg);
  for (let i = 0; i <= 4; i++) {
    const yv = yMin + ((top - yMin) * i) / 4;
    el("line", { x1: m.l, x2: m.l + W, y1: Y(yv), y2: Y(yv), stroke: "#e5e7f2" }, g);
    el("text", { x: m.l - 8, y: Y(yv) + 4, "text-anchor": "end" }, g).textContent = fmt(yv, digits);
  }
  const yl = el("text", { x: 14, y: m.t + H / 2, "text-anchor": "middle", transform: `rotate(-90 14 ${m.t + H / 2})` }, g);
  yl.textContent = yLabel;
  const bw = W / bars.length;
  bars.forEach((b, i) => {
    const x = m.l + i * bw + bw * 0.15;
    const y = Y(Math.max(b.value, yMin));
    const r = el("rect", { x, y, width: bw * 0.7, height: Math.max(0, m.t + H - y), fill: b.color || "var(--color-primary)", rx: 4 }, g);
    const t = el("title", {}, r);
    t.textContent = `${b.label}: ${fmt(b.value, digits)}${b.note ? " (" + b.note + ")" : ""}`;
    el("text", { x: x + bw * 0.35, y: y - 6, "text-anchor": "middle", style: "fill:#1e1b4b;font-weight:700" }, g).textContent = fmt(b.value, digits);
    const lbl = el("text", { x: x + bw * 0.35, y: m.t + H + 18, "text-anchor": "middle" }, g);
    lbl.textContent = b.label;
  });
  if (limit !== null) {
    el("line", { x1: m.l, x2: m.l + W, y1: Y(limit), y2: Y(limit), stroke: "var(--color-accent)", "stroke-width": 3, "stroke-dasharray": "6 4" }, g);
    el("text", { x: m.l + W, y: Y(limit) - 6, "text-anchor": "end", style: "fill:#c2410c;font-weight:700" }, g).textContent = limitLabel;
  }
}

/* ---------- start ---------- */
export function init() {
  $$("[data-reveal]").forEach(setupReveal);
  $$(".question[data-kind=number]").forEach(setupNumberQuestion);
  $$(".question[data-kind=choice]").forEach(setupChoiceQuestion);
  $$(".codecell").forEach(setupCodeCell);
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
else init();
