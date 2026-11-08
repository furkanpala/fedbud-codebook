import { $, bindRange, fmt } from "./common.js";
import { H, F, trainToy, costOf, trainedText } from "./toy-transformer.js";

/* Lesson 4: switch heads and neurons of the toy layer on and off, and watch cost and accuracy. */

let model = null;
const headMask = new Array(H).fill(1);
const neuronMask = new Array(F).fill(1);

async function train(seed) {
  $("#lab").hidden = true;
  $("#train-status").textContent = "Training the toy model in your browser...";
  if (model) model.dispose();
  model = await trainToy({ seed, onProgress: (f) => { $("#train-fill").style.width = 100 * f + "%"; }, onNote: (t) => { $("#train-status").textContent = t; } });
  $("#train-status").textContent = trainedText(model);
  $("#lab").hidden = false;
  update();
}

function update() {
  const cost = costOf(headMask, neuronMask);
  const budget = Number($("#budget").value);
  const ok = cost <= budget + 1e-9;
  $("#cost-txt").textContent = fmt(cost, 2);
  $("#cost-fill").style.width = 100 * cost + "%";
  $("#cost-fill").classList.toggle("over", !ok);
  $("#budget-lim").style.left = 100 * budget + "%";
  $("#fit").textContent = ok ? "yes" : "no, cut more parts";
  $("#fit").className = "status " + (ok ? "good" : "bad");
  if (model) {
    $("#acc-full").textContent = fmt(100 * model.fullAccuracy, 1) + "%";
    $("#acc-sub").textContent = fmt(100 * model.accuracy(headMask, neuronMask), 1) + "%";
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
$("#retrain").addEventListener("click", () => { seed += 1; train(seed); });

if (!window.tf) $("#train-status").textContent = "The training library did not load. Check your internet connection and reload the page.";
else train(seed);
