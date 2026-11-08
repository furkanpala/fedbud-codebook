import { $, bindRange, fmt } from "./common.js";

const CLIENTS = [
  { id: "b1", name: "University hospital" },
  { id: "b2", name: "Small company" },
  { id: "b3", name: "Rural clinic" },
];

const rows = $("#rows");
rows.innerHTML = CLIENTS.map((c) => `
  <div class="meter">
    <div class="meter-label"><span>${c.name}</span><span id="${c.id}-st"></span></div>
    <div class="meter-track" aria-hidden="true"><div class="meter-fill" id="${c.id}-fill"></div><div class="meter-limit" id="${c.id}-lim"></div></div>
  </div>`).join("");

function update() {
  const shared = Number($("#shared").value);
  let able = 0, unusedSum = 0;
  for (const c of CLIENTS) {
    const b = Number($("#" + c.id).value);
    const fits = shared <= b + 1e-9;
    const fill = $("#" + c.id + "-fill");
    fill.style.width = Math.min(100, 100 * shared) + "%";
    fill.classList.toggle("over", !fits);
    $("#" + c.id + "-lim").style.left = 100 * b + "%";
    const st = $("#" + c.id + "-st");
    if (fits) {
      able += 1;
      const unused = (b - shared) / b;
      unusedSum += unused;
      st.innerHTML = `<span class="status good">runs it</span> ${fmt(100 * unused, 0)}% of its budget unused`;
    } else {
      st.innerHTML = `<span class="status bad">too costly</span> needs ${fmt(shared, 2)}, has ${fmt(b, 2)}`;
    }
  }
  $("#able").textContent = `${able} of 3`;
  $("#unused").textContent = able ? fmt((100 * unusedSum) / able, 0) + "%" : "none";
}

for (const c of CLIENTS) bindRange($("#" + c.id), $("#" + c.id + "-out"), (v) => fmt(v, 2), update);
bindRange($("#shared"), $("#shared-out"), (v) => fmt(v, 2), update);

$("#fit").addEventListener("click", () => {
  const smallest = Math.min(...CLIENTS.map((c) => Number($("#" + c.id).value)));
  $("#shared").value = String(smallest);
  $("#shared").dispatchEvent(new Event("input"));
  $("#fit-note").textContent = `The shared model now costs ${fmt(smallest, 2)}, the smallest budget. Every client can run it, but the larger clients leave budget unused.`;
});
update();
