// Loads the extension into a throwaway headless Chrome and checks blocking on the live YouTube site.
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { launchChrome, sleep } from "../scripts/lib/chrome.mjs";

const extDir = resolve(fileURLToPath(import.meta.url), "../../extension");
const chrome = await launchChrome();
const { open, close, urlOf, evalIn, waitUrl } = chrome;

const results = [];
function report(name, ok, detail) {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}  ->  ${detail}`);
}

async function finish(code) {
  await chrome.quit();
  process.exit(code);
}

console.log(chrome.version);

let extId;
try {
  extId = await chrome.loadExtension(extDir);
} catch (e) {
  console.log("FAIL  could not load extension", e.message);
  await finish(1);
}
await sleep(1500);

const blockedPage = `chrome-extension://${extId}/blocked.html`;
const isBlockedPage = (u) => u.startsWith(blockedPage);

{
  const p = await open("https://www.youtube.com/shorts/");
  const u = await waitUrl(p, isBlockedPage);
  const shown = isBlockedPage(u)
    ? await evalIn(p, "document.getElementById('url').textContent")
    : "";
  report("direct youtube.com/shorts/", isBlockedPage(u) && shown.includes("youtube.com/shorts"), u);
  await close(p);
}

{
  const p = await open("https://m.youtube.com/shorts/abc123");
  const u = await waitUrl(p, isBlockedPage);
  report("direct m.youtube.com/shorts/abc123", isBlockedPage(u), u);
  await close(p);
}

{
  const p = await open("https://www.youtube.com/watch?v=jNQXAC9IVRw");
  await sleep(5000);
  const u = await urlOf(p);
  report("watch page not blocked", u.startsWith("https://www.youtube.com/watch"), u);
  await close(p);
}

{
  const p = await open("https://www.youtube.com/");
  await sleep(6000);
  let u = await urlOf(p);
  report("home page not blocked", /^https:\/\/www\.youtube\.com\/?(\?.*)?$/.test(u), u);

  const clicked = await evalIn(
    p,
    `(() => {
      const a = document.querySelector('a[title="Shorts"], a[href^="/shorts"]');
      if (!a) return null;
      a.click();
      return a.getAttribute('href') || a.title;
    })()`
  );
  if (clicked !== null) {
    u = await waitUrl(p, isBlockedPage, 8000);
    report(`click Shorts link in page (${clicked})`, isBlockedPage(u), u);
  } else {
    console.log("SKIP  no Shorts link on the home page");
  }
  await close(p);
}

{
  const p = await open("https://www.youtube.com/");
  await sleep(5000);
  await evalIn(p, "history.pushState({}, '', '/shorts/pushstate-test'); 1");
  const u = await waitUrl(p, isBlockedPage, 8000);
  report("pushState to /shorts/...", isBlockedPage(u), u);
  await close(p);
}

{
  const p = await open(`chrome-extension://${extId}/popup.html`);
  await sleep(1000);
  const before = await evalIn(p, "document.getElementById('list').value");
  await evalIn(
    p,
    `document.getElementById('list').value = 'youtube.com/shorts\\nhttps://www.Example.com/\\n\\nyoutube.com/shorts';
     document.getElementById('save').click(); 1`
  );
  await sleep(800);
  const stored = await evalIn(
    p,
    "chrome.storage.sync.get('prefixes').then(d => JSON.stringify(d.prefixes))"
  );
  report("popup default list", before === "youtube.com/shorts", JSON.stringify(before));
  report("popup save normalizes", stored === '["youtube.com/shorts","example.com"]', stored);
  await close(p);

  const q = await open("https://example.com/");
  const u = await waitUrl(q, isBlockedPage);
  report("new prefix example.com blocked", isBlockedPage(u), u);
  await close(q);
}

const failed = results.filter((r) => !r).length;
console.log(failed ? `${failed} of ${results.length} failed` : `all ${results.length} passed`);
await finish(failed ? 1 : 0);
