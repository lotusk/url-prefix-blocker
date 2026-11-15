import { DEFAULT_PREFIXES, normalizePrefix } from "./match.js";

const list = document.getElementById("list");
const status = document.getElementById("status");

const data = await chrome.storage.sync.get({ prefixes: DEFAULT_PREFIXES });
list.value = data.prefixes.join("\n");

document.getElementById("save").addEventListener("click", async () => {
  const prefixes = [
    ...new Set(list.value.split("\n").map(normalizePrefix).filter(Boolean)),
  ];
  await chrome.storage.sync.set({ prefixes });
  list.value = prefixes.join("\n");
  status.textContent = "Saved";
  setTimeout(() => (status.textContent = ""), 1500);
});
