import { $, fmt } from "./common.js";

/* Lesson 10: the paper's numbers (its main results table) and the final quiz.
   base: the best published decomposition method in each column, single runs at seed 42, against FedBUD at seed 42.
   alone: FedBUD without co-training against FedBUD, mean over seeds 42, 1 and 2; a dagger marks a significant gain. */

const DATA = [
  { name: "CoNLL", metric: "F1", lower: false, base: ["Adapt-Pruner", 0.8413], fed42: 0.8436, alone: 0.8233, fedMean: 0.8398, sig: false },
  { name: "SQuAD", metric: "F1", lower: false, base: ["Adapt-Pruner", 0.6266], fed42: 0.7248, alone: 0.6336, fedMean: 0.7269, sig: true },
  { name: "AG News", metric: "accuracy", lower: false, base: ["LLM-Pruner", 0.9389], fed42: 0.9444, alone: 0.9315, fedMean: 0.9448, sig: false },
  { name: "XSum", metric: "ROUGE-L", lower: false, base: ["Adapt-Pruner", 0.2213], fed42: 0.2313, alone: 0.2241, fedMean: 0.2311, sig: false },
  { name: "SAMSum", metric: "ROUGE-L", lower: false, base: ["Adapt-Pruner", 0.3599], fed42: 0.3809, alone: 0.3660, fedMean: 0.3808, sig: true },
  { name: "Multi-task", metric: "loss, lower is better", lower: true, base: ["Adapt-Pruner", 1.1504], fed42: 0.9706, alone: 1.1217, fedMean: 0.9697, sig: true },
];

let mode = "base";

function render() {
  const NS = "http://www.w3.org/2000/svg";
  const svg = $("#chart");
  const W = 640, Hh = 300, m = { l: 60, r: 12, t: 24, b: 50 };
  svg.setAttribute("viewBox", `0 0 ${W} ${Hh}`);
  svg.innerHTML = "";
  const mk = (name, attrs) => { const e = document.createElementNS(NS, name); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); svg.appendChild(e); return e; };
  const rows = DATA.map((d) => {
    const other = mode === "base" ? d.base[1] : d.alone;
    const ours = mode === "base" ? d.fed42 : d.fedMean;
    const diff = d.lower ? other - ours : ours - other;
    return { d, other, ours, diff };
  });
  const top = 0.2, bottom = 0;
  const Y = (v) => m.t + ((top - v) / (top - bottom)) * (Hh - m.t - m.b);
  for (const v of [0, 0.05, 0.1, 0.15, 0.2]) {
    mk("line", { x1: m.l, x2: W - m.r, y1: Y(v), y2: Y(v), stroke: v === 0 ? "#6b7280" : "#e5e7f2" });
    mk("text", { x: m.l - 8, y: Y(v) + 4, "text-anchor": "end" }).textContent = fmt(v, 2);
  }
  const bw = (W - m.l - m.r) / rows.length;
  rows.forEach(({ d, diff }, i) => {
    const x = m.l + i * bw + bw * 0.2;
    const r = mk("rect", { x, y: Y(Math.max(diff, 0)), width: bw * 0.6, height: Math.abs(Y(diff) - Y(0)), fill: "#4338ca", rx: 3, tabindex: 0 });
    const t = document.createElementNS(NS, "title");
    t.textContent = `${d.name}: FedBUD ${diff >= 0 ? "higher" : "lower"} by ${fmt(Math.abs(diff), 4)}${mode === "alone" && d.sig ? ", significant" : ""}`;
    r.appendChild(t);
    mk("text", { x: x + bw * 0.3, y: Y(Math.max(diff, 0)) - 6, "text-anchor": "middle", style: "fill:#1e1b4b;font-weight:700" }).textContent = "+" + fmt(diff, 3) + (mode === "alone" && d.sig ? " †" : "");
    mk("text", { x: x + bw * 0.3, y: Hh - m.b + 20, "text-anchor": "middle" }).textContent = d.name;
  });
  $("#chart-cap").textContent = mode === "base"
    ? "FedBUD minus the best published method that cuts the model to the same budget. Both are single runs, so there is no statistical test."
    : "FedBUD minus FedBUD without training together, both as the mean of three runs. A dagger marks a significant gain on that dataset.";
  $("#th-other").textContent = mode === "base" ? "Best published method" : "Training alone, mean of 3 runs";
  $("#rows").innerHTML = rows.map(({ d, other, ours }) => `<tr><th scope="row">${d.name}, ${d.metric}</th><td>${mode === "base" ? d.base[0] + " " : ""}${fmt(other, 4)}</td><td>${fmt(ours, 4)}${mode === "alone" && d.sig ? " †" : ""}</td></tr>`).join("");
}

function setMode(m2) {
  mode = m2;
  $("#cmp-base").setAttribute("aria-pressed", String(m2 === "base"));
  $("#cmp-alone").setAttribute("aria-pressed", String(m2 === "alone"));
  $("#cmp-base").className = m2 === "base" ? "btn" : "btn secondary";
  $("#cmp-alone").className = m2 === "alone" ? "btn" : "btn secondary";
  render();
}

$("#cmp-base").addEventListener("click", () => setMode("base"));
$("#cmp-alone").addEventListener("click", () => setMode("alone"));
setMode("base");

/* ---------- final quiz ---------- */
const KEY = { f1: "a", f2: "b", f3: "c", f4: "a", f5: "b", f6: "c" };
$("#quiz").addEventListener("submit", (e) => {
  e.preventDefault();
  let right = 0, answered = 0;
  const wrong = [];
  Object.entries(KEY).forEach(([name, val], q) => {
    const picked = document.querySelector(`input[name=${name}]:checked`);
    const fs = document.querySelector(`input[name=${name}]`).closest("fieldset");
    const legend = fs.querySelector("legend");
    fs.style.borderLeftColor = "";
    legend.textContent = `Question ${q + 1}`;
    if (!picked) return;
    answered += 1;
    const ok = picked.value === val;
    if (ok) right += 1; else wrong.push(q + 1);
    fs.style.borderLeftColor = ok ? "var(--color-good)" : "var(--color-bad)";
    legend.textContent = `Question ${q + 1}, ${ok ? "correct" : "check again"}`;
  });
  const names = (list) => (list.length === 1 ? `Question ${list[0]} needs` : `Questions ${list.slice(0, -1).join(", ")} and ${list[list.length - 1]} need`);
  const res = $("#quiz-result");
  res.textContent = answered < 6
    ? `You answered ${answered} of 6 questions, ${right} of them correctly. Answer the rest and check again.`
    : `You answered ${right} of 6 questions correctly.${right === 6 ? " Well done." : ` ${names(wrong)} another look.`}`;
  res.className = "feedback " + (right === 6 ? "good" : "bad");
});
