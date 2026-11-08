import { $, fmt, lineChart } from "./common.js";
import { KEPT, HID, makeFederation } from "./toy-mlp.js";

/* Lesson 8: which rows are averaged together, and three federations trained side by side. */

const NAMES = ["A", "B", "C"];
const CLIENT_COLORS = { A: "#4338ca", B: "#c2410c", C: "#0f766e" };
let view = "pos";
let picked = null;

function drawRows() {
  const NS = "http://www.w3.org/2000/svg";
  const svg = $("#rows");
  const W = 360, rowH = 34, top = 34;
  svg.setAttribute("viewBox", `0 0 ${W} ${top + HID * rowH + 10}`);
  svg.innerHTML = "";
  const mk = (name, attrs, parent = svg) => { const e = document.createElementNS(NS, name); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); parent.appendChild(e); return e; };
  const colX = (k) => 110 + k * 82;
  NAMES.forEach((n, k) => { const t = mk("text", { x: colX(k) + 28, y: 20, "text-anchor": "middle", style: "font-size:14px;font-weight:700;fill:#1e1b4b" }); t.textContent = `Client ${n}`; });
  for (let r = 0; r < HID; r++) {
    const y = top + r * rowH;
    const g = mk("g", { tabindex: 0, role: "button" });
    g.style.cursor = "pointer";
    const label = view === "pos" ? `row ${r + 1}` : `neuron ${r + 1}`;
    const cells = NAMES.map((n) => (view === "pos" ? KEPT[n][r] : (KEPT[n].includes(r) ? r : undefined)));
    const present = cells.map((c) => c !== undefined);
    const ids = cells.filter((c) => c !== undefined);
    const mixed = view === "pos" && new Set(ids).size > 1;
    g.setAttribute("aria-label", `${label}: ${NAMES.map((n, k) => present[k] ? `client ${n} neuron ${cells[k] + 1}` : `client ${n} none`).join(", ")}${mixed ? ", different neurons mixed" : ""}`);
    if (picked === r) mk("rect", { x: 4, y: y - 2, width: W - 8, height: rowH - 2, fill: mixed ? "#fee2e2" : "#dcfce7", rx: 6 }, g);
    const t = mk("text", { x: 12, y: y + 20, style: "font-size:13px;fill:#4b5563" }, g); t.textContent = label;
    NAMES.forEach((n, k) => {
      if (!present[k]) return;
      mk("rect", { x: colX(k), y: y + 2, width: 56, height: rowH - 8, rx: 5, fill: "#ffffff", stroke: CLIENT_COLORS[n], "stroke-width": 2 }, g);
      const tt = mk("text", { x: colX(k) + 28, y: y + 21, "text-anchor": "middle", style: `font-size:14px;font-weight:700;fill:${CLIENT_COLORS[n]}` }, g);
      tt.textContent = String(cells[k] + 1);
    });
    const choose = () => { picked = r; drawRows(); describe(r, cells, present, mixed); svg.querySelectorAll("g[role=button]")[r].focus(); };
    g.addEventListener("click", choose);
    g.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); choose(); } });
  }
  $("#rows-caption").textContent = view === "pos"
    ? "Position by position: each line is a row position. The number in a box is the neuron the client stores in that row, so a line with different numbers mixes different neurons."
    : "Aligned: each line is one neuron. A box means the client keeps that neuron, and the server averages only the boxes on one line.";
}

function describe(r, cells, present, mixed) {
  const who = NAMES.filter((_, k) => present[k]);
  if (view === "pos") {
    $("#row-note").textContent = mixed
      ? `Row ${r + 1} averages ${who.map((n) => `neuron ${cells[NAMES.indexOf(n)] + 1} of client ${n}`).join(" with ")}. These are different neurons, so the average mixes them.`
      : `Row ${r + 1} averages neuron ${cells[NAMES.indexOf(who[0])] + 1} of ${who.length === 1 ? "client " + who[0] + " only" : "clients " + who.join(" and ")}.`;
  } else {
    $("#row-note").textContent = who.length > 1
      ? `Neuron ${r + 1} is averaged over clients ${who.join(" and ")}, the clients that keep it.`
      : `Only client ${who[0]} keeps neuron ${r + 1}, so it keeps its own values.`;
  }
}

function setView(v) {
  view = v; picked = null;
  $("#view-pos").setAttribute("aria-pressed", String(v === "pos"));
  $("#view-aln").setAttribute("aria-pressed", String(v === "aln"));
  $("#view-pos").className = v === "pos" ? "btn" : "btn secondary";
  $("#view-aln").className = v === "aln" ? "btn" : "btn secondary";
  $("#row-note").textContent = "Select a row.";
  drawRows();
}

/* ---------- training ---------- */
let feds, hist, seed = 7;
function reset() {
  feds = { aligned: makeFederation("aligned", { seed }), position: makeFederation("position", { seed }), alone: makeFederation("alone", { seed }) };
  hist = { aligned: [[0, feds.aligned.meanAccuracy()]], position: [[0, feds.position.meanAccuracy()]], alone: [[0, feds.alone.meanAccuracy()]] };
  draw();
  $("#final").textContent = "";
}

function draw() {
  lineChart($("#curve"), [
    { color: "#4338ca", points: hist.aligned.map(([r, a]) => [r, 100 * a]), width: 3 },
    { color: "#c2410c", points: hist.position.map(([r, a]) => [r, 100 * a]), width: 3 },
    { color: "#6b7280", points: hist.alone.map(([r, a]) => [r, 100 * a]), dash: "6 4" },
  ], { xLabel: "round", yLabel: "mean test accuracy, %", yMin: 40, yMax: 100, xMax: 30 });
}

async function run() {
  $("#run").disabled = true;
  for (let r = hist.aligned.length; r <= 30; r++) {
    for (const k of Object.keys(feds)) { feds[k].round(); hist[k].push([r, feds[k].meanAccuracy()]); }
    draw();
    await new Promise((res) => setTimeout(res, 30));
  }
  const at = (k, r) => fmt(100 * hist[k][r][1], 1) + "%";
  $("#final").textContent = `After 1 round: aligned ${at("aligned", 1)}, position by position ${at("position", 1)}, alone ${at("alone", 1)}. After 30 rounds: aligned ${at("aligned", 30)}, position by position ${at("position", 30)}, alone ${at("alone", 30)}.`;
  $("#run").disabled = false;
}

$("#view-pos").addEventListener("click", () => setView("pos"));
$("#view-aln").addEventListener("click", () => setView("aln"));
$("#run").addEventListener("click", run);
$("#reset").addEventListener("click", reset);
$("#new-data").addEventListener("click", () => { seed += 1; reset(); });
setView("pos");
reset();
