import { $, bindRange, fmt } from "./common.js";

/* Lesson 5: the model as a graph. Nodes in computation order, edges at distance one and two.
   Each block node cycles through its actions; the cost meter checks the budget. */

const LAYERS = 6;
const ATTN_ACTIONS = [["keep", 1], ["half", 0.5], ["drop", 0]];
const FFN_ACTIONS = [["keep", 1], ["half", 0.5], ["quarter", 0.25], ["drop", 0]];
const COST = { attn: 1, ffn: 2 };

const nodes = [{ kind: "embed", label: "Embedding" }];
for (let l = 1; l <= LAYERS; l++) {
  nodes.push({ kind: "attn", label: `Attention ${l}`, layer: l, a: 0 });
  nodes.push({ kind: "ffn", label: `Feed-forward ${l}`, layer: l, a: 0 });
}
nodes.push({ kind: "head", label: "Output head" });

const actions = (n) => (n.kind === "attn" ? ATTN_ACTIONS : FFN_ACTIONS);
const frac = (n) => (n.kind === "attn" || n.kind === "ffn" ? actions(n)[n.a][1] : 1);
const actName = (n) => (n.kind === "attn" || n.kind === "ffn" ? actions(n)[n.a][0] : "never cut");

function cost() {
  let kept = 0, full = 0;
  for (const n of nodes) {
    if (n.kind !== "attn" && n.kind !== "ffn") continue;
    kept += COST[n.kind] * frac(n);
    full += COST[n.kind];
  }
  return kept / full;
}

const NS = "http://www.w3.org/2000/svg";
const svg = $("#graph");
const W = 360, ROW = 46, TOP = 26;
const HGT = TOP * 2 + ROW * (nodes.length - 1);
svg.setAttribute("viewBox", `0 0 ${W} ${HGT}`);
const X = 150, R = 15;
const y = (i) => TOP + i * ROW;

function el(name, attrs, parent) {
  const e = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  parent.appendChild(e);
  return e;
}

const color = (n) => (n.kind === "attn" ? "#4338ca" : n.kind === "ffn" ? "#0f766e" : "#9ca3af");
let selected = null;

function draw() {
  svg.innerHTML = "";
  const gE = el("g", {}, svg);
  for (let i = 0; i < nodes.length; i++) {
    for (const j of [i + 1, i + 2]) {
      if (j >= nodes.length) continue;
      const skip = frac(nodes[i]) === 0 || frac(nodes[j]) === 0;
      if (j === i + 1) {
        el("line", { x1: X, y1: y(i) + R, x2: X, y2: y(j) - R, stroke: skip ? "#c7cbe0" : "#6b7280", "stroke-width": 2, "stroke-dasharray": skip ? "5 4" : "none" }, gE);
      } else {
        const side = i % 2 === 0 ? -1 : 1;
        const bx = X + side * 70;
        el("path", { d: `M${X + side * R},${y(i)} Q${bx},${(y(i) + y(j)) / 2} ${X + side * R},${y(j)}`, fill: "none", stroke: skip ? "#c7cbe0" : "#9ca3af", "stroke-width": 1.5, "stroke-dasharray": skip ? "5 4" : "none" }, gE);
      }
    }
  }
  nodes.forEach((n, i) => {
    const g = el("g", { class: "node" }, svg);
    const f = frac(n);
    const dropped = f === 0;
    const circle = el("circle", {
      cx: X, cy: y(i), r: R,
      fill: dropped ? "#ffffff" : color(n),
      "fill-opacity": dropped ? 1 : 0.25 + 0.75 * f,
      stroke: color(n), "stroke-width": selected === i ? 4 : 2, "stroke-dasharray": dropped ? "4 3" : "none",
    }, g);
    const t = el("text", { x: X + 26, y: y(i) + 5, style: "font-size:14px;fill:#1e1b4b" }, g);
    t.textContent = `${n.label}: ${actName(n)}`;
    if (n.kind === "attn" || n.kind === "ffn") {
      g.setAttribute("tabindex", "0");
      g.setAttribute("role", "button");
      g.setAttribute("aria-label", `${n.label}, action ${actName(n)}. Press to change.`);
      g.style.cursor = "pointer";
      const act = () => { cycle(i); };
      g.addEventListener("click", act);
      g.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); act(); } });
      // a larger invisible target for touch
      el("rect", { x: X - 24, y: y(i) - 21, width: 210, height: 42, fill: "transparent" }, g);
    }
    void circle;
  });
}

function cycle(i) {
  const n = nodes[i];
  const next = (n.a + 1) % actions(n).length;
  const attnLeft = nodes.filter((m) => m.kind === "attn" && m !== n && frac(m) > 0).length;
  if (n.kind === "attn" && actions(n)[next][1] === 0 && attnLeft === 0) {
    $("#picked").textContent = "This is the last attention block, so FedBUD keeps at least part of it. Without attention, no token could use the other tokens.";
    n.a = 0;
  } else {
    n.a = next;
    show(i);
  }
  selected = i;
  draw();
  update();
  const g = svg.querySelectorAll("g.node")[i];
  if (g) g.focus();
}

function show(i) {
  const n = nodes[i];
  const budget = Number($("#budget").value);
  $("#picked").textContent = `${n.label}. Node features: type ${n.kind === "attn" ? "attention" : "feed-forward"}, depth ${n.layer} of ${LAYERS}, size kept ${fmt(frac(n), 2)}, budget ${fmt(budget, 2)}, client 1. Lesson 6 adds how much the block matters.`;
}

function update() {
  const c = cost();
  const budget = Number($("#budget").value);
  const ok = c <= budget + 1e-9;
  $("#cost-txt").textContent = fmt(c, 2);
  $("#cost-fill").style.width = 100 * c + "%";
  $("#cost-fill").classList.toggle("over", !ok);
  $("#budget-lim").style.left = 100 * budget + "%";
  $("#fit").textContent = ok ? "yes" : "no, cut more";
  $("#fit").className = "status " + (ok ? "good" : "bad");
}

bindRange($("#budget"), $("#budget-out"), (v) => fmt(v, 2), update);
$("#reset").addEventListener("click", () => { nodes.forEach((n) => { if ("a" in n) n.a = 0; }); selected = null; draw(); update(); });
draw();
update();
