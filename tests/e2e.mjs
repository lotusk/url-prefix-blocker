// Loads the extension into a throwaway headless Chrome profile and checks
// blocking on the live YouTube site. Your normal Chrome profile is not touched.
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const CHROME =
  process.env.CHROME_PATH ??
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const extDir = resolve(fileURLToPath(import.meta.url), "../../extension");
const profileDir = mkdtempSync(join(tmpdir(), "upb-e2e-"));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(
  CHROME,
  [
    "--headless=new",
    `--user-data-dir=${profileDir}`,
    "--remote-debugging-pipe",
    "--enable-unsafe-extension-debugging",
    "--no-first-run",
    "--no-default-browser-check",
    "about:blank",
  ],
  { stdio: ["ignore", "ignore", "ignore", "pipe", "pipe"] }
);
const toChrome = chrome.stdio[3];
const fromChrome = chrome.stdio[4];

let nextId = 1;
const pending = new Map();
let buf = Buffer.alloc(0);
fromChrome.on("data", (chunk) => {
  buf = Buffer.concat([buf, chunk]);
  let i;
  while ((i = buf.indexOf(0)) !== -1) {
    const msg = JSON.parse(buf.subarray(0, i).toString());
    buf = buf.subarray(i + 1);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
    }
  }
});

function send(method, params = {}, sessionId) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    toChrome.write(JSON.stringify({ id, method, params, sessionId }) + "\0");
  });
}

async function quit(code) {
  await send("Browser.close").catch(() => {});
  await sleep(1500);
  chrome.kill();
  rmSync(profileDir, { recursive: true, force: true });
  process.exit(code);
}

async function open(url) {
  const { targetId } = await send("Target.createTarget", { url });
  const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
  return { targetId, sessionId };
}

async function urlOf(page) {
  return (await send("Target.getTargetInfo", { targetId: page.targetId })).targetInfo.url;
}

async function evalIn(page, expression) {
  const r = await send(
    "Runtime.evaluate",
    { expression, awaitPromise: true, returnByValue: true },
    page.sessionId
  );
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text);
  return r.result.value;
}

async function waitUrl(page, pred, ms = 10000) {
  const end = Date.now() + ms;
  let u;
  while (Date.now() < end) {
    u = await urlOf(page);
    if (pred(u)) return u;
    await sleep(250);
  }
  return u;
}

const close = (page) => send("Target.closeTarget", { targetId: page.targetId });

const results = [];
function report(name, ok, detail) {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}  ->  ${detail}`);
}

await sleep(1500);
console.log((await send("Browser.getVersion")).product);

let extId;
try {
  extId = (await send("Extensions.loadUnpacked", { path: extDir })).id;
} catch (e) {
  console.log("FAIL  could not load extension", e.message);
  await quit(1);
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
await quit(failed ? 1 : 0);
