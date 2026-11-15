// Drives a throwaway headless Chrome over the DevTools pipe.
// The temporary profile is deleted on quit(), so your normal Chrome is never touched.
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CHROME =
  process.env.CHROME_PATH ??
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function launchChrome() {
  const profileDir = mkdtempSync(join(tmpdir(), "upb-chrome-"));
  const proc = spawn(
    CHROME,
    [
      "--headless=new",
      `--user-data-dir=${profileDir}`,
      "--remote-debugging-pipe",
      // Recent Chrome ignores --load-extension; this enables Extensions.loadUnpacked instead.
      "--enable-unsafe-extension-debugging",
      "--no-first-run",
      "--no-default-browser-check",
      "about:blank",
    ],
    { stdio: ["ignore", "ignore", "ignore", "pipe", "pipe"] }
  );
  const toChrome = proc.stdio[3];
  const fromChrome = proc.stdio[4];

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
  proc.on("exit", () => {
    for (const { reject } of pending.values()) reject(new Error("Chrome exited"));
    pending.clear();
  });

  function send(method, params = {}, sessionId) {
    const id = nextId++;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      toChrome.write(JSON.stringify({ id, method, params, sessionId }) + "\0");
    });
  }

  const version = (await send("Browser.getVersion")).product;

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

  return {
    send,
    version,
    urlOf,
    evalIn,

    async loadExtension(path) {
      return (await send("Extensions.loadUnpacked", { path })).id;
    },

    async open(url) {
      const { targetId } = await send("Target.createTarget", { url });
      const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
      return { targetId, sessionId };
    },

    close(page) {
      return send("Target.closeTarget", { targetId: page.targetId });
    },

    async waitUrl(page, pred, ms = 10000) {
      const end = Date.now() + ms;
      let u;
      while (Date.now() < end) {
        u = await urlOf(page);
        if (pred(u)) return u;
        await sleep(250);
      }
      return u;
    },

    async capture(page, { width, height, scale = 1, transparent = false }) {
      await send(
        "Emulation.setDeviceMetricsOverride",
        { width, height, deviceScaleFactor: scale, mobile: false },
        page.sessionId
      );
      if (transparent) {
        await send(
          "Emulation.setDefaultBackgroundColorOverride",
          { color: { r: 0, g: 0, b: 0, a: 0 } },
          page.sessionId
        );
      }
      await evalIn(
        page,
        "Promise.all([document.fonts.ready, ...[...document.images].map((i) => i.decode())]).then(() => 1)"
      );
      await sleep(200);
      const { data } = await send("Page.captureScreenshot", { format: "png" }, page.sessionId);
      return Buffer.from(data, "base64");
    },

    async quit() {
      await send("Browser.close").catch(() => {});
      await sleep(1000);
      proc.kill();
      rmSync(profileDir, { recursive: true, force: true });
    },
  };
}
