import { DEFAULT_PREFIXES, isBlocked } from "./match.js";

let prefixes = DEFAULT_PREFIXES;

const ready = chrome.storage.sync
  .get({ prefixes: DEFAULT_PREFIXES })
  .then((data) => {
    prefixes = data.prefixes;
  });

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && changes.prefixes) {
    prefixes = changes.prefixes.newValue ?? DEFAULT_PREFIXES;
  }
});

async function check(tabId, url) {
  await ready;
  if (!isBlocked(url, prefixes)) return;
  const target =
    chrome.runtime.getURL("blocked.html") + "?url=" + encodeURIComponent(url);
  chrome.tabs.update(tabId, { url: target }).catch(() => {});
}

chrome.webNavigation.onBeforeNavigate.addListener((d) => {
  if (d.frameId === 0 && d.documentLifecycle !== "prerender") {
    check(d.tabId, d.url);
  }
});

// Catches in-page navigation (pushState) and redirects, which never
// reach onBeforeNavigate with the final URL.
chrome.tabs.onUpdated.addListener((tabId, info) => {
  if (info.url) check(tabId, info.url);
});
