// Optional real Chromium QA, using Node's built-in CDP WebSocket (no browser npm dependency).
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { readFile, writeFile, mkdir, mkdtemp } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url)),
  artifacts = resolve(root, "work/browser-qa");
await mkdir(artifacts, { recursive: true });
const dist = resolve(root, "dist"),
  types = {
    ".html": "text/html",
    ".js": "text/javascript",
    ".css": "text/css",
    ".csv": "text/csv",
  };
const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(
      new URL(req.url, "http://localhost").pathname,
    );
    const path = resolve(
      dist,
      "." + (pathname === "/" ? "/index.html" : pathname),
    );
    if (!path.startsWith(dist + sep)) {
      res.writeHead(403).end();
      return;
    }
    const data = await readFile(path);
    res.writeHead(200, {
      "Content-Type": types[extname(path)] ?? "application/octet-stream",
    });
    res.end(data);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const origin = `http://127.0.0.1:${server.address().port}`;
let chrome, ws;
const report = {
  browser: "",
  viewports: [],
  checks: [],
  runtimeErrors: [],
  externalRequests: [],
};
try {
  let endpoint = process.env.BROWSER_CDP_URL;
  if (!endpoint) {
    const profile = await mkdtemp(resolve(artifacts, "profile-"));
    chrome = spawn(
      process.env.CHROMIUM_BIN ?? "chromium",
      [
        "--headless",
        "--disable-gpu",
        "--disable-background-networking",
        "--no-first-run",
        "--no-default-browser-check",
        ...(process.env.CHROMIUM_NO_SANDBOX === "1" ? ["--no-sandbox"] : []),
        "--remote-debugging-address=127.0.0.1",
        "--remote-debugging-port=0",
        `--user-data-dir=${profile}`,
        "about:blank",
      ],
      { stdio: ["ignore", "ignore", "pipe"] },
    );
    endpoint = await new Promise((resolve, reject) => {
      let log = "";
      const timeout = setTimeout(
        () => reject(Error("Chromium did not expose CDP within 15 seconds")),
        15000,
      );
      chrome.on("error", (e) => {
        clearTimeout(timeout);
        reject(e);
      });
      chrome.on("exit", (code) => {
        clearTimeout(timeout);
        reject(
          Error(
            `Chromium exited (${code}). In a sandboxed container, set CHROMIUM_NO_SANDBOX=1. ${log.slice(-800)}`,
          ),
        );
      });
      chrome.stderr.on("data", (chunk) => {
        log = (log + chunk).slice(-10000);
        const match = log.match(/DevTools listening on (ws:\/\/[^\s]+)/);
        if (match) {
          clearTimeout(timeout);
          resolve(match[1]);
        }
      });
    });
  }
  if (endpoint.startsWith("http"))
    endpoint = (await (await fetch(endpoint + "/json/version")).json())
      .webSocketDebuggerUrl;
  ws = new WebSocket(endpoint);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });
  let id = 0;
  const pending = new Map();
  ws.addEventListener("message", (e) => {
    const message = JSON.parse(e.data);
    if (message.id) {
      const item = pending.get(message.id);
      if (!item) return;
      pending.delete(message.id);
      clearTimeout(item.timeout);
      message.error
        ? item.reject(Error(JSON.stringify(message.error)))
        : item.resolve(message.result);
    } else if (message.method === "Runtime.exceptionThrown")
      report.runtimeErrors.push(message.params.exceptionDetails.text);
    else if (message.method === "Network.requestWillBeSent") {
      const url = message.params.request.url;
      if (/^https?:/.test(url) && !url.startsWith(origin + "/"))
        report.externalRequests.push(url);
    }
  });
  function call(method, params = {}, sessionId) {
    return new Promise((resolve, reject) => {
      const next = ++id,
        timeout = setTimeout(() => {
          pending.delete(next);
          reject(Error(`CDP timeout: ${method}`));
        }, 10000);
      pending.set(next, { resolve, reject, timeout });
      ws.send(
        JSON.stringify({
          id: next,
          method,
          params,
          ...(sessionId ? { sessionId } : {}),
        }),
      );
    });
  }
  const version = await call("Browser.getVersion");
  report.browser = version.product;
  const { targetId } = await call("Target.createTarget", {
      url: "about:blank",
    }),
    { sessionId } = await call("Target.attachToTarget", {
      targetId,
      flatten: true,
    });
  const page = (method, params = {}) => call(method, params, sessionId);
  const evaluate = async (expression) => {
    const result = await page("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (result.exceptionDetails)
      throw Error(
        result.exceptionDetails.exception?.description ??
          result.exceptionDetails.text,
      );
    return result.result.value;
  };
  const frame = () =>
    evaluate(
      "new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))",
    );
  async function wait(expression) {
    for (let attempt = 0; attempt < 100; attempt++) {
      if (await evaluate(expression)) return;
      await new Promise((r) => setTimeout(r, 50));
    }
    throw Error("Wait failed: " + expression);
  }
  await page("Page.enable");
  await page("Runtime.enable");
  await page("Network.enable");
  async function load(width) {
    await page("Emulation.setDeviceMetricsOverride", {
      width,
      height: 1000,
      deviceScaleFactor: 1,
      mobile: width <= 430,
    });
    await page("Page.navigate", { url: origin + "/" });
    await wait("!!document.querySelector('.merchant-shell')");
    await frame();
  }
  async function button(name) {
    const found = await evaluate(
      `(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(name)});if(!b)return false;b.click();return true;})()`,
    );
    assert(found, `Missing button ${name}`);
    await frame();
  }
  async function input(label, value) {
    const found = await evaluate(
      `(()=>{const name=${JSON.stringify(label)};const el=[...document.querySelectorAll('input,select')].find(e=>e.getAttribute('aria-label')===name)||[...document.querySelectorAll('label')].find(l=>l.textContent.trim()===name)?.querySelector('input,select');if(!el)return false;Object.getOwnPropertyDescriptor(el.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype,'value').set.call(el,${JSON.stringify(String(value))});el.dispatchEvent(new Event(el.tagName==='SELECT'?'change':'input',{bubbles:true}));return true;})()`,
    );
    assert(found, `Missing field ${label}`);
    await frame();
  }
  async function fit(width, mode, state) {
    const layout = await evaluate(
      `(()=>{const d=document.documentElement;return {viewport:innerWidth,client:d.clientWidth,scroll:d.scrollWidth,body:document.body.scrollWidth,overflowingText:[...document.querySelectorAll('body *')].filter(e=>e.namespaceURI==='http://www.w3.org/1999/xhtml'&&!e.children.length&&!e.closest('.table-scroll')&&e.clientWidth>0&&e.scrollWidth>e.clientWidth+1&&getComputedStyle(e).overflowX==='visible').map(e=>({tag:e.tagName,class:e.className,text:e.textContent.slice(0,60)})).slice(0,8),tableScrollers:[...document.querySelectorAll('.table-scroll')].filter(e=>e.clientWidth>0&&e.scrollWidth>e.clientWidth).length,offscreenControls:[...document.querySelectorAll('button,input,select')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&!e.closest('.table-scroll')&&(r.left< -1||r.right>d.clientWidth+1)}).map(e=>e.getAttribute('aria-label')||e.textContent.trim())};})()`,
    );
    assert(
      layout.scroll <= layout.client + 1,
      `${mode}/${state}/${width}: document scrollWidth ${layout.scroll} exceeds clientWidth ${layout.client}; ${JSON.stringify(layout)}`,
    );
    assert(
      layout.body <= layout.client + 1,
      `${mode}/${state}/${width}: body overflows`,
    );
    assert.deepEqual(
      layout.offscreenControls,
      [],
      `${mode}/${state}/${width}: controls extend beyond viewport`,
    );
    report.viewports.push({ width, mode, state, ...layout });
  }
  const screenshot = async (name) => {
    await evaluate("window.scrollTo(0,0)");
    await frame();
    const shot = await page("Page.captureScreenshot", { format: "png" });
    await writeFile(
      resolve(artifacts, name + ".png"),
      Buffer.from(shot.data, "base64"),
    );
  };
  for (const width of [320, 375, 390, 430, 768, 1440]) {
    await load(width);
    assert.deepEqual(
      await evaluate(
        "[...document.querySelectorAll('section[id^=\"step-\"]')].map(e=>e.id)",
      ),
      ["step-1", "step-2", "step-3", "step-4"],
    );
    const ys = await evaluate(
      "[...document.querySelectorAll('section[id^=\"step-\"]')].map(e=>e.getBoundingClientRect().top)",
    );
    assert(
      ys.every((y, i) => i === 0 || y > ys[i - 1]),
      "Workflow order must match actual vertical layout",
    );
    await fit(width, "Simple", "default");
    if (width === 375 || width === 1440) await screenshot(`simple-${width}`);
    await evaluate(
      "document.querySelectorAll('details').forEach(e=>e.open=true)",
    );
    await frame();
    await fit(width, "Simple", "all-details-expanded");
    await input("Storewide discount (%)", 20);
    const kpis = await evaluate(
      "document.querySelector('.merchant-cards').textContent",
    );
    assert(
      kpis.includes("$253,257") &&
        kpis.includes("-$14,609") &&
        kpis.includes("22"),
    );
    await input("Minimum Profit to Keep (USD)", 20000);
    await input("Additional Safety Buffer (USD)", 500);
    await button("Improve My Plan");
    assert(
      await evaluate(
        "document.body.textContent.includes('Current Plan → Suggested Plan')",
      ),
    );
    await fit(width, "Simple", "suggestion");
    await button("Use Suggested Plan");
    assert(
      await evaluate(
        "document.body.textContent.includes('Your current discount plan already meets your profit goal. No changes are needed.')",
      ),
    );
    await fit(width, "Simple", "identical-plan");
    await button("Advanced Mode");
    await fit(width, "Advanced", "manual");
    if (width <= 768) {
      await button("Navigation");
      assert(
        await evaluate(
          "!document.querySelector('#advanced-mobile-navigation').hidden",
        ),
      );
      await fit(width, "Advanced", "menu-open");
      await evaluate(
        "document.querySelector('#advanced-mobile-navigation a[href=\"#sku-table\"]').click()",
      );
      await frame();
      assert(
        await evaluate(
          "document.querySelector('#advanced-mobile-navigation').hidden",
        ),
      );
    }
    await evaluate(
      "document.querySelectorAll('details').forEach(e=>e.open=true)",
    );
    await frame();
    await fit(width, "Advanced", "all-details-expanded");
    await button("Optimize");
    await fit(width, "Advanced", "optimized");
    if (width === 375 || width === 1440) await screenshot(`advanced-${width}`);
    await input("Contribution profit floor (USD)", 1000000);
    await fit(width, "Advanced", "infeasible");
    assert(await evaluate("!!document.querySelector('.diagnostic-summary')"));
    await button("Simple Mode");
    assert(
      await evaluate(
        "[...document.querySelectorAll('label')].find(l=>l.textContent.trim()==='Additional Safety Buffer (USD)').querySelector('input').value==='500'",
      ),
    );
  }
  report.checks.push(
    "Both modes fit all 6 requested viewport widths, including expanded disclosures, suggestions, allocations, infeasible goals and mobile navigation.",
    "Uniform 20% demo figures and goal/buffer state verified in Chromium.",
    "Identical plans show an informative state after applying recommendations.",
  );
  // Actual native-file upload and long-label/conflicting-rule stress case.
  await load(320);
  const longId = "LONG-PRODUCT-" + "A".repeat(80),
    longCategory = "Long category " + "B".repeat(80);
  const productCsv =
    "SKU,Product_Name,Category,Regular_Price_USD,Unit_COGS_USD,Inventory_Units,Expected_Units\n" +
    [
      longId,
      "Long name " + "C".repeat(150),
      longCategory,
      50,
      20,
      150,
      100,
    ].join(",") +
    "\n";
  const productsPath = resolve(artifacts, "synthetic-long-products.csv"),
    rulesPath = resolve(artifacts, "synthetic-conflicting-rules.csv");
  await writeFile(productsPath, productCsv);
  await writeFile(
    rulesPath,
    "SKU,Minimum_Discount,Maximum_Discount\n" + longId + ",0.4,0.1\n",
  );
  async function upload(selector, path) {
    const { root: doc } = await page("DOM.getDocument");
    const { nodeId } = await page("DOM.querySelector", {
      nodeId: doc.nodeId,
      selector,
    });
    assert(nodeId, "Missing upload input");
    await page("DOM.setFileInputFiles", { nodeId, files: [path] });
    await frame();
  }
  await upload('input[aria-label="Upload products CSV"]', productsPath);
  await wait(
    "document.body.textContent.includes('synthetic-long-products.csv')",
  );
  await upload('input[aria-label="Upload must-promote CSV"]', rulesPath);
  await wait("document.body.textContent.includes('Conflicting rules')");
  await button("Improve My Plan");
  assert(
    await evaluate(
      "document.body.textContent.includes('Some required offers conflict')",
    ),
  );
  assert(
    !(await evaluate(
      "[...document.querySelectorAll('button')].some(e=>e.textContent==='Use Suggested Plan')",
    )),
  );
  await evaluate(
    "document.querySelectorAll('details').forEach(e=>e.open=true)",
  );
  await frame();
  await fit(320, "Simple", "long-labels-conflicting-rules");
  await button("Advanced Mode");
  await evaluate(
    "document.querySelectorAll('details').forEach(e=>e.open=true)",
  );
  await frame();
  await fit(320, "Advanced", "long-labels-conflicting-rules");
  report.checks.push(
    "Native product/list uploads with long SKU, product/category names and conflicting hard rules remain usable without page overflow.",
  );
  // Ensure display-only rounding does not modify the exported goal across focus and modes.
  await load(375);
  await evaluate(
    "window.__exports=[];window.URL.createObjectURL=b=>{window.__exports.push(b);return 'blob:qa'};HTMLAnchorElement.prototype.click=function(){};window.URL.revokeObjectURL=()=>{}",
  );
  await button("Export plan & recommendations");
  const before = await evaluate("window.__exports.at(-1).text()");
  await evaluate(
    "(()=>{const i=[...document.querySelectorAll('label')].find(l=>l.textContent.trim()==='Minimum Profit to Keep (USD)').querySelector('input');i.focus();i.blur();})()",
  );
  await button("Advanced Mode");
  await evaluate(
    "(()=>{const i=[...document.querySelectorAll('label')].find(l=>l.textContent.trim()==='Contribution profit floor (USD)').querySelector('input');i.focus();i.blur();})()",
  );
  await button("Simple Mode");
  await button("Export plan & recommendations");
  assert.equal(await evaluate("window.__exports.at(-1).text()"), before);
  report.checks.push(
    "CSV before/after focus, blur and mode switches is identical: display formatting does not mutate precision.",
  );
  assert.deepEqual(report.runtimeErrors, []);
  assert.deepEqual(report.externalRequests, []);
  await call("Target.closeTarget", { targetId });
  await writeFile(
    resolve(artifacts, "report.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(
    `${report.browser}: ${report.viewports.length} layout/state checks passed across 320,375,390,430,768,1440px. No runtime errors or external requests. Report: work/browser-qa/report.json`,
  );
} finally {
  ws?.close();
  chrome?.kill("SIGTERM");
  server.close();
}
