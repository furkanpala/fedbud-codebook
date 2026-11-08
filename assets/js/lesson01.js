import { $, bindRange, fmt } from "./common.js";

/* The slider runs on a log scale from 0.1 to 100 billion parameters. */
const sizeFromSlider = (v) => Math.pow(10, -1 + (3 * v) / 100);

function human(n) {
  if (n >= 1e12) return fmt(n / 1e12, 1) + " trillion";
  if (n >= 1e9) return fmt(n / 1e9, 1) + " billion";
  return fmt(n / 1e6, 0) + " million";
}

function setMeter(fill, limit, gb, cardGb, maxGb) {
  fill.style.width = Math.min(100, (100 * gb) / maxGb) + "%";
  fill.classList.toggle("over", gb > cardGb);
  limit.style.left = Math.min(100, (100 * cardGb) / maxGb) + "%";
}

function setStatus(el, ok) {
  el.textContent = ok ? "fits" : "does not fit";
  el.className = "status " + (ok ? "good" : "bad");
}

function update() {
  const b = sizeFromSlider(Number($("#size").value));
  const card = Number($("#gpu").value);
  const useGb = b * 2;
  const trainGb = b * 16;
  const maxGb = Math.max(card * 1.5, 32);
  $("#use-gb").textContent = fmt(useGb, 1) + " GB";
  $("#train-gb").textContent = fmt(trainGb, 1) + " GB";
  setMeter($("#use-fill"), $("#use-limit"), useGb, card, maxGb);
  setMeter($("#train-fill"), $("#train-limit"), trainGb, card, maxGb);
  setStatus($("#use-status"), useGb <= card);
  setStatus($("#train-status"), trainGb <= card);
  $("#flops").textContent = human(2 * b * 1e9);
  $("#flops-train").textContent = human(6 * b * 1e9);
}

bindRange($("#size"), $("#size-out"), (v) => fmt(sizeFromSlider(v), sizeFromSlider(v) < 1 ? 2 : 1) + " billion", update);
$("#gpu").addEventListener("change", update);
update();
