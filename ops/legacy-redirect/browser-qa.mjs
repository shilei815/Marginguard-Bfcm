// Local two-origin HTTP MODEL only. No Cloudflare endpoint/SDK/credentials.
// Verifies Chromium fragment inheritance, not Pages query/redirect behavior.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { modeledLocation, targetOrigin } from "./model.mjs";
const artifacts = fileURLToPath(new URL("../../work/legacy-redirect-qa/", import.meta.url));
await mkdir(artifacts, { recursive: true });
const requests = [], external = [], results = [];
const target = createServer((req, res) => {
  requests.push({ role: "target", url: req.url });
  if (req.url.split("?")[0] === "/assets/example.js") {
    res.writeHead(404, { "Content-Type": "text/plain" }).end("Missing historical asset (intentional mock)");
  } else if (req.url.split("?")[0] === "/demo-skus.csv") {
    res.writeHead(200, { "Content-Type": "text/plain" }).end("SKU,Price\nFICTIONAL,1\n");
  } else {
    res.writeHead(200, { "Content-Type": "text/html" }).end('<!doctype html><title>Local evergreen model</title><section id="step-2">Step 2</section>');
  }
});
await new Promise(r => target.listen(0, "127.0.0.1", r));
const newOrigin = `http://127.0.0.1:${target.address().port}`;
const legacy = createServer((req, res) => {
  requests.push({ role: "legacy", url: req.url });
  const modeled = modeledLocation("https://marginguard-bfcm.pages.dev" + req.url, { preserveQuery: true });
  const location = newOrigin + modeled.location.slice(targetOrigin.length);
  res.writeHead(301, { Location: location }).end();
});
await new Promise(r => legacy.listen(0, "127.0.0.1", r));
const oldOrigin = `http://127.0.0.1:${legacy.address().port}`;
let chrome, ws;
try {
  const profile = await mkdtemp(artifacts + "/profile-");
  chrome = spawn(process.env.CHROMIUM_BIN ?? "chromium", [
    "--headless", "--disable-gpu", "--disable-background-networking", "--no-first-run", "--no-default-browser-check",
    ...(process.env.CHROMIUM_NO_SANDBOX === "1" ? ["--no-sandbox"] : []),
    "--remote-debugging-address=127.0.0.1", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank",
  ], { stdio: ["ignore", "ignore", "pipe"] });
  const endpoint = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(Error("CDP startup timeout")), 15000);
    chrome.on("error", reject);
    chrome.stderr.on("data", data => {
      const match = data.toString().match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (match) { clearTimeout(timeout); resolve(match[1]); }
    });
  });
  ws = new WebSocket(endpoint);
  await new Promise((resolve, reject) => { ws.addEventListener("open", resolve, { once: true }); ws.addEventListener("error", reject, { once: true }); });
  let nextId = 0;
  const pending = new Map();
  ws.addEventListener("message", event => {
    const data = JSON.parse(event.data);
    if (data.id) {
      const p = pending.get(data.id); if (!p) return;
      pending.delete(data.id); clearTimeout(p.timer);
      data.error ? p.reject(Error(JSON.stringify(data.error))) : p.resolve(data.result);
    } else if (data.method === "Network.requestWillBeSent") {
      const url = data.params.request.url;
      if (/^https?:/.test(url) && ![oldOrigin, newOrigin].some(origin => url.startsWith(origin + "/"))) external.push(url);
    }
  });
  const call = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    const id = ++nextId;
    const timer = setTimeout(() => reject(Error("CDP timeout: " + method)), 10000);
    pending.set(id, { resolve, reject, timer });
    ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
  const version = await call("Browser.getVersion");
  const { targetId } = await call("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await call("Target.attachToTarget", { targetId, flatten: true });
  const page = (method, params = {}) => call(method, params, sessionId);
  const evaluate = async expression => {
    const r = await page("Runtime.evaluate", { expression, returnByValue: true });
    if (r.exceptionDetails) throw Error(JSON.stringify(r.exceptionDetails));
    return r.result.value;
  };
  await page("Page.enable"); await page("Runtime.enable"); await page("Network.enable");
  for (const suffix of ["/", "/demo-skus.csv", "/?utm_source=shopify", "/#step-2", "/?utm_source=shopify#step-2", "/assets/example.js"]) {
    const before = requests.filter(r => r.role === "legacy").length;
    await page("Page.navigate", { url: oldOrigin + suffix });
    let href;
    for (let i = 0; i < 100; i++) {
      href = await evaluate("location.href");
      if (href === newOrigin + suffix) break;
      await new Promise(r => setTimeout(r, 50));
    }
    assert.equal(href, newOrigin + suffix);
    const legacyRequests = requests.filter(r => r.role === "legacy").length - before;
    assert(legacyRequests <= 1, "At most one local redirect; cached 301 reuse is allowed, never a loop");
    if (suffix.includes("#")) assert.equal(await evaluate("location.hash"), "#step-2");
    results.push({ source: oldOrigin + suffix, result: href, legacyRequests, modeledAssetMissing: suffix === "/assets/example.js" });
  }
  await page("Page.navigate", { url: newOrigin + "/" });
  await new Promise(r => setTimeout(r, 100));
  assert.equal(await evaluate("location.origin"), newOrigin);
  assert(requests.every(r => !r.url.includes("#")), "Fragments must never reach either HTTP server");
  assert.deepEqual(external, []);
  await writeFile(artifacts + "/report.json", JSON.stringify({ browser: version.product, scope: "Local mock only; Pages live routing/query behavior NOT VERIFIED", results, fragmentsAbsentFromHTTP: true, external }, null, 2) + "\n");
  await call("Target.closeTarget", { targetId });
  console.log(`${version.product}: ${results.length} LOCAL MODEL browser cases pass, including fragment inheritance. No external requests. Not Cloudflare validation.`);
} finally {
  ws?.close(); chrome?.kill("SIGTERM"); legacy.close(); target.close();
}
