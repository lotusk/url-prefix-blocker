// Renders the extension icons and the Chrome Web Store images with headless Chrome.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { launchChrome, sleep } from "./lib/chrome.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const extDir = resolve(root, "extension");
const storeDir = resolve(root, "store");
const buildDir = resolve(storeDir, "build");
const iconSvg = readFileSync(resolve(storeDir, "src/icon.svg"), "utf8");

mkdirSync(resolve(extDir, "icons"), { recursive: true });
mkdirSync(buildDir, { recursive: true });

const chrome = await launchChrome();
const save = (path, png) => {
  writeFileSync(path, png);
  console.log("wrote", path.slice(root.length + 1));
};

try {
  // Chrome asks for 96px of artwork inside the 128px icon; smaller sizes use the full square.
  const blank = await chrome.open("about:blank");
  for (const [size, pad] of [[16, 0], [32, 0], [48, 0], [128, 16]]) {
    await chrome.evalIn(
      blank,
      `document.body.style.margin = '0';
       document.body.innerHTML = ${JSON.stringify(
         `<div style="box-sizing:border-box;width:${size}px;height:${size}px;padding:${pad}px">${iconSvg}</div>`
       )};
       document.querySelector('svg').setAttribute('style', 'display:block;width:100%;height:100%');
       1`
    );
    const png = await chrome.capture(blank, { width: size, height: size, transparent: true });
    save(resolve(extDir, `icons/icon-${size}.png`), png);
  }
  await chrome.close(blank);

  const extId = await chrome.loadExtension(extDir);
  await sleep(1000);

  const popup = await chrome.open(`chrome-extension://${extId}/popup.html`);
  await sleep(800);
  const height = await chrome.evalIn(
    popup,
    `document.getElementById('list').value = ${JSON.stringify(
      ["youtube.com/shorts", "reddit.com/r/all", "x.com/explore", "news.ycombinator.com"].join("\n")
    )};
     document.getElementById('status').textContent = 'Saved';
     Math.ceil(document.body.getBoundingClientRect().height)`
  );
  save(resolve(buildDir, "popup.png"), await chrome.capture(popup, { width: 328, height, scale: 2 }));
  await chrome.close(popup);

  const blocked = await chrome.open(
    `chrome-extension://${extId}/blocked.html?url=${encodeURIComponent("https://www.youtube.com/shorts/abc123")}`
  );
  save(resolve(buildDir, "blocked.png"), await chrome.capture(blocked, { width: 660, height: 420, scale: 2 }));
  await chrome.close(blocked);

  for (const [name, width, height] of [
    ["screenshot-1", 1280, 800],
    ["screenshot-2", 1280, 800],
    ["promo-small", 440, 280],
  ]) {
    const page = await chrome.open(pathToFileURL(resolve(storeDir, `src/${name}.html`)).href);
    await sleep(500);
    save(resolve(storeDir, `${name}.png`), await chrome.capture(page, { width, height }));
    await chrome.close(page);
  }
} finally {
  await chrome.quit();
}
