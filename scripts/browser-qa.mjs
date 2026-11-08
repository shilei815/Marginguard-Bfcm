// Optional real Chromium QA, using Node's built-in CDP WebSocket (no browser npm dependency).
import assert from "node:assert/strict";
import { auditRenderedContrast } from "./contrast-audit.mjs";
import { measureTypography } from "./typography-audit.mjs";
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
const browserZoom = Number(process.env.BROWSER_ZOOM ?? 1);
assert([1, 1.25, 1.5, 2].includes(browserZoom), "Supported QA browser zoom: 1, 1.25, 1.5, 2");
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
    // Chromium's actual desktop default zoom in an isolated test profile.
    await mkdir(resolve(profile, "Default"));
    await writeFile(resolve(profile, "Default/Preferences"), JSON.stringify({
      partition: { default_zoom_level: { x: Math.log(browserZoom) / Math.log(1.2) } },
    }));
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
    if (browserZoom !== 1) {
      const { windowId } = await call("Browser.getWindowForTarget", { targetId });
      await call("Browser.setWindowBounds", { windowId, bounds: { width, height: 1000, windowState: "normal" } });
    } else await page("Emulation.setDeviceMetricsOverride", {
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
      `(()=>{const name=${JSON.stringify(label)};const el=[...document.querySelectorAll('input,select')].find(e=>e.getAttribute('aria-label')===name)||[...document.querySelectorAll('label')].find(l=>[...l.childNodes].filter(n=>n.nodeType===Node.TEXT_NODE).map(n=>n.textContent).join('').replace(/\\s+/g,' ').trim()===name)?.querySelector('input,select');if(!el)return false;Object.getOwnPropertyDescriptor(el.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype,'value').set.call(el,${JSON.stringify(String(value))});el.dispatchEvent(new Event(el.tagName==='SELECT'?'change':'input',{bubbles:true}));return true;})()`,
    );
    assert(found, `Missing field ${label}`);
    await frame();
  }
  async function fit(width, mode, state) {
    const contrast = await evaluate(`(${auditRenderedContrast.toString()})()`);
    (report.contrast ??= []).push({ width, mode, state, ...contrast });
    if (process.env.CONTRAST_ALLOW_FAILURES !== "1") assert.deepEqual(contrast.failures, [], `${mode}/${state}/${width}: contrast failures`);
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
    const typography = await evaluate(`(${measureTypography.toString()})()`);
    const minimumSizes = { body: 16, paragraph: 15, caption: 13, button: 14, label: 14, value: 16, navigation: 14, disclosure: 14, table: 13, tableHeader: 12, sectionHeading: 18, legend: 13, warning: 14 };
    for (const [name, minimum] of Object.entries(minimumSizes)) {
      if (typography[name]) assert(typography[name].size >= minimum, `${mode}/${state}: ${name} is ${typography[name].size}px, expected >=${minimum}px`);
    }
    if (typography.chartLabel) assert(typography.chartLabel.renderedSize >= 13, `Chart text must remain readable after SVG scaling: ${JSON.stringify(typography.chartLabel)}`);
    assert.deepEqual(layout.overflowingText, [], `${mode}/${state}: text extends outside its container`);
    const overlaps = await evaluate(`(()=>{const out=[];for(const p of document.querySelectorAll('.actions,.two-fields,.tier-defaults,.bulk-controls,.merchant-cards,.panel-heading,.section-title,.topbar,.step-nav,.pagination')){const children=[...p.children].filter(e=>e.checkVisibility({checkVisibilityCSS:true})&&e.getClientRects().length);for(let i=0;i<children.length;i++)for(let j=i+1;j<children.length;j++){const a=children[i].getBoundingClientRect(),b=children[j].getBoundingClientRect();if(Math.min(a.right,b.right)-Math.max(a.left,b.left)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1)out.push(p.className)}}return out})()`);
    assert.deepEqual(overlaps, [], `${mode}/${state}: sibling content overlaps`);
    const chartOverlaps = await evaluate(`(()=>{const out=[];for(const svg of document.querySelectorAll('svg')){const texts=[...svg.querySelectorAll('text')].filter(e=>e.checkVisibility({checkVisibilityCSS:true})&&e.getClientRects().length);for(let i=0;i<texts.length;i++)for(let j=i+1;j<texts.length;j++){const a=texts[i].getBoundingClientRect(),b=texts[j].getBoundingClientRect();if(Math.min(a.right,b.right)-Math.max(a.left,b.left)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1)out.push([texts[i].textContent,texts[j].textContent])}}return out})()`);
    assert.deepEqual(chartOverlaps, [], `${mode}/${state}: SVG labels overlap`);
    report.viewports.push({ width, mode, state, typography, ...layout });
  }
  const screenshot = async (name, scrollToTop = true) => {
    if (scrollToTop) await evaluate("window.scrollTo(0,0)");
    await frame();
    const shot = await page("Page.captureScreenshot", { format: "png" });
    await writeFile(
      resolve(artifacts, name + ".png"),
      Buffer.from(shot.data, "base64"),
    );
  };
  const key = async (key, code, windowsVirtualKeyCode, modifiers = 0) => {
    await page("Input.dispatchKeyEvent", { type: "keyDown", key, code, windowsVirtualKeyCode, modifiers, ...(key === "Enter" ? { text: "\r" } : {}) });
    await page("Input.dispatchKeyEvent", { type: "keyUp", key, code, windowsVirtualKeyCode, modifiers });
    await frame();
  };
  const verifyFeedback = async () => {
    assert.equal(await evaluate("document.querySelector('.launch-help a').getAttribute('href')"), "mailto:miniventurelab@gmail.com?subject=MarginGuard%20beta%20feedback");
    assert(!(await evaluate("document.querySelector('.launch-help').textContent.includes('coming soon')")));
    const before = await evaluate("document.querySelector('.cards')?.textContent");
    await evaluate("document.querySelector('.topbar a[href=\"#help-feedback\"]').click()");
    await frame();
    assert(await evaluate("location.hash==='#help-feedback' && document.querySelector('#help-feedback').getBoundingClientRect().top < innerHeight"));
    await evaluate("document.querySelector('.topbar a[href=\"#help-feedback\"]').focus()");
    await key("Tab", "Tab", 9);
    await key("Tab", "Tab", 9, 8);
    assert(await evaluate("document.activeElement.matches('.topbar a[href=\"#help-feedback\"]') && getComputedStyle(document.activeElement).outlineStyle !== 'none'"));
    await key("Enter", "Enter", 13);
    assert(await evaluate("document.activeElement.id==='help-feedback'"));
    assert.equal(await evaluate("document.querySelector('.cards')?.textContent"), before);
    // Inspect the mailto only; never activate an email client or send a message.
  };
  if (browserZoom === 1) {
  const tierListPath = resolve(artifacts, "synthetic-tiers.csv");
  await writeFile(
    tierListPath,
    "SKU,Priority_Tier,Target_Discount,Min_Discount,Max_Discount\nELE-004,1,0.1,0.05,0.15\nHOM-004,2,0.1,0,0.1\nACC-004,3,0.1,0,0.1\n",
  );
  const unifiedPath = resolve(artifacts, "unified-products.csv"),
    minimalPath = resolve(artifacts, "minimal-products.csv"),
    invalidUnifiedPath = resolve(artifacts, "invalid-unified.csv");
  const costHeaders = [
    "Fulfillment_Cost_USD",
    "Merchant_Shipping_USD",
    "Payment_Fee_Rate",
    "Order_Fixed_Fee_Allocated_USD",
    "Expected_Return_Rate",
    "Return_Cost_Per_Return_USD",
    "Other_Variable_Cost_USD",
  ];
  const unifiedHeader =
    "SKU,Product_Name,Category,Regular_Price_USD,Unit_COGS_USD,Inventory_Units,Expected_Units,Priority_Tier,Target_Discount,Min_Discount,Max_Discount,Planned_Discount,Exact_Discount,Preferred_Discount," +
    costHeaders.join(",");
  const unifiedText =
    unifiedHeader +
    "\nUA,Launch item,Seasonal,100,20,10,1,1,.4,.1,.6,.3,.3,.4,0,0,0,0,0,0,0\nUB,Everyday item,Everyday,100,20,10,1,2,.3,.1,.6,.3,,,0,0,0,0,0,0,0\nUC,Clearance item,Clearance,100,20,10,1,3,.2,0,.5,.3,,,0,0,0,0,0,0,0\n";
  await writeFile(unifiedPath, unifiedText);
  await writeFile(
    invalidUnifiedPath,
    unifiedText.replace("1,.4,.1,.6", "1,.4,.8,.6"),
  );
  await writeFile(
    minimalPath,
    "SKU,Regular_Price_USD,Unit_COGS_USD,Inventory_Units,Expected_Units\nMIN,50,20,100,10\n",
  );
  for (const width of [320, 375, 390, 430, 768, 1024, 1440, 1920]) {
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
    assert(
      await evaluate(
        "document.title==='MarginGuard · Discount Profit Planner'&&!/BFCM|Black Friday/i.test(document.body.textContent)",
      ),
    );
    const activeSite = JSON.parse(await readFile(resolve(root, "config/site.json"), "utf8"));
    const head = await evaluate("({canonical:document.querySelector('link[rel=canonical]')?.href,og:document.querySelector('meta[property=\"og:url\"]')?.content,twitter:document.querySelector('meta[name=\"twitter:url\"]')?.content,name:document.querySelector('meta[property=\"og:site_name\"]')?.content,description:document.querySelector('meta[name=description]')?.content})");
    assert.deepEqual(head, { canonical: activeSite.productionOrigin + "/", og: activeSite.productionOrigin + "/", twitter: activeSite.productionOrigin + "/", name: activeSite.name, description: activeSite.description });
    assert(await evaluate("document.body.textContent.includes('A fictional demo is already loaded')"));
    assert.equal(await evaluate("document.querySelectorAll('.launch-help details > summary').length"), 5);
    await verifyFeedback();
    await evaluate("document.querySelector('.launch-help summary').focus()");
    await key("Enter", "Enter", 13);
    assert(await evaluate("document.querySelector('.launch-help details').open"));
    await key("Enter", "Enter", 13);
    assert(await evaluate("!document.querySelector('.launch-help details').open"));
    await fit(width, "Simple", "default");
    if (width === 375 || width === 1440) await screenshot(`simple-${width}`);
    await evaluate(
      "document.querySelectorAll('details').forEach(e=>e.open=true)",
    );
    await frame();
    await fit(width, "Simple", "all-details-expanded");
    await input("Tier 1 target (%)", 10);
    await input("Tier 1 hard maximum (%)", 15);
    await evaluate(
      `document.querySelector('input[aria-label="Select ELE-004 for tier"]').click()`,
    );
    await frame();
    await button("Apply tier to 1 selected products");
    assert(
      await evaluate(
        `!!document.querySelector('select[aria-label="Promotion tier for ELE-004"]')`,
      ),
    );
    await fit(width, "Simple", "bulk-tier-assignment");
    await upload('input[aria-label="Upload tier CSV"]', tierListPath);
    await wait(
      "document.body.textContent.includes('Loaded 3 tier assignments')",
    );
    await fit(width, "Simple", "native-tier-csv");
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
    if (width === 375 || width === 1440) {
      await evaluate("document.querySelector('.simple-chart').scrollIntoView()");
      await evaluate("window.scrollBy(0,-90)");
      await screenshot(`comparison-${width}`, false);
    }
    if (width === 375 || width === 1440) {
      await evaluate(
        "document.querySelector('.tier-report').scrollIntoView({block:'start'});window.scrollBy(0,-80)",
      );
      await screenshot("tier-protection-" + width, false);
    }
    await button("Use Suggested Plan");
    assert(
      await evaluate(
        "document.body.textContent.includes('Your current discount plan already meets your profit goal. No changes are needed.')",
      ),
    );
    await fit(width, "Simple", "identical-plan");
    await button("Advanced Mode");
    await fit(width, "Advanced", "manual");
    assert(
      await evaluate(
        `document.querySelector('select[aria-label="Promotion tier for ELE-004"]').value==='1'`,
      ),
    );
    assert(
      await evaluate(
        `[...document.querySelectorAll('label')].find(l=>l.textContent.trim()==='Tier 1 target (%)').querySelector('input').value==='10'`,
      ),
    );
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
    assert.equal(await evaluate("document.querySelectorAll('.launch-help details > summary').length"), 5);
    assert(await evaluate("document.querySelector('.launch-help').textContent.includes('Send Feedback')"));
    await verifyFeedback();
    await fit(width, "Advanced", "all-details-expanded");
    await button("Optimize");
    await fit(width, "Advanced", "optimized");
    if (width === 375 || width === 1440) await screenshot(`advanced-${width}`);
    if (width === 1440) {
      await evaluate("document.querySelector('.chart-panel').scrollIntoView();window.scrollBy(0,-90)");
      await screenshot("launch-advanced-frontier", false);
    }
    await input("Contribution profit floor (USD)", 1000000);
    await fit(width, "Advanced", "infeasible");
    assert(await evaluate("!!document.querySelector('.diagnostic-summary')"));
    await button("Simple Mode");
    assert(
      await evaluate(
        "[...document.querySelectorAll('label')].find(l=>l.textContent.trim()==='Additional Safety Buffer (USD)').querySelector('input').value==='500'",
      ),
    );
    // New primary onboarding is one native file transaction, including costs, tiers and planned offers.
    await upload('input[aria-label="Upload products CSV"]', unifiedPath);
    await wait("document.body.textContent.includes('unified-products.csv')");
    assert(
      await evaluate(
        `document.querySelector('input[aria-label="UA special discount percent"]').value==='30'&&document.querySelector('select[aria-label="Promotion tier for UA"]').value==='1'`,
      ),
    );
    assert(
      await evaluate("!!document.querySelector('.cost-quality.complete')"),
    );
    await fit(width, "Simple", "unified-complete-import");
    await input("Minimum Profit to Keep (USD)", 180);
    await input("Additional Safety Buffer (USD)", 5);
    const importedCards = await evaluate(
      "document.querySelector('.merchant-cards').textContent",
    );
    await upload('input[aria-label="Upload products CSV"]', invalidUnifiedPath);
    await wait("!!document.querySelector('.unified-import [role=alert]')");
    assert.equal(
      await evaluate("document.querySelector('.merchant-cards').textContent"),
      importedCards,
    );
    assert(
      await evaluate(
        "document.body.textContent.includes('unified-products.csv')&&!document.body.textContent.includes('invalid-unified.csv')",
      ),
    );
    assert(
      await evaluate(
        `[...document.querySelectorAll('label')].find(l=>l.textContent.trim()==='Additional Safety Buffer (USD)').querySelector('input').value==='5'`,
      ),
    );
    await fit(width, "Simple", "atomic-import-rollback");
    await upload('input[aria-label="Upload products CSV"]', minimalPath);
    await wait("document.body.textContent.includes('minimal-products.csv')");
    assert(
      await evaluate(
        "!!document.querySelector('.cost-quality.incomplete')&&document.body.textContent.includes('Estimated goal met — costs incomplete')",
      ),
    );
    await fit(width, "Simple", "minimal-missing-costs");
    await evaluate("document.querySelector('.cost-quality details').open=true");
    await frame();
    if (width === 375 || width === 1440) {
      await evaluate(
        "document.querySelector('.cost-quality').scrollIntoView({block:'start'});window.scrollBy(0,-80)",
      );
      await screenshot("missing-costs-" + width, false);
    }
    const estimatedCards = await evaluate(
      "document.querySelector('.merchant-cards').textContent",
    );
    await evaluate(
      `document.querySelector('input[aria-label="Confirm all omitted cost inputs are zero or not applicable"]').click()`,
    );
    await frame();
    assert.equal(
      await evaluate("document.querySelector('.merchant-cards').textContent"),
      estimatedCards,
    );
    assert(
      await evaluate("!!document.querySelector('.cost-quality.complete')"),
    );
    await fit(width, "Simple", "confirmed-zero-costs");
    await button("Advanced Mode");
    assert(
      await evaluate(
        "!!document.querySelector('.cost-quality.complete')&&!/BFCM|Black Friday/i.test(document.body.textContent)",
      ),
    );
    await fit(width, "Advanced", "unified-state-cost-confirmation");
    await button("Load demo");
    assert(await evaluate("document.body.textContent.includes('Synthetic demo · 30 fictional SKUs')"));
    await button("Simple Mode");
    assert(await evaluate("document.body.textContent.includes('A fictional demo is already loaded')"));
    assert.equal(await evaluate("document.querySelector('.merchant-cards').textContent.includes('Estimated')"), false);
    await fit(width, "Simple", "demo-reset");
  }
  report.checks.push(
    "Unified native product import, cost presence/confirmation and atomic rollback verified at all six widths. Both modes fit all 6 requested viewport widths, including expanded disclosures, suggestions, allocations, infeasible goals and mobile navigation.",
    "Uniform 20% demo figures and goal/buffer state verified in Chromium.",
    "Identical plans show an informative state after applying recommendations.",
    "Tier bulk assignment, native tier CSV import, tier reporting and mode-state preservation verified at every viewport.",
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
  const longTierPath = resolve(artifacts, "synthetic-long-tiers.csv");
  await writeFile(
    longTierPath,
    "SKU,Priority_Tier,Target_Discount,Min_Discount,Max_Discount\n" +
      longId +
      ",1,0.2,0,0.4\n",
  );
  await upload('input[aria-label="Upload tier CSV"]', longTierPath);
  await wait("document.body.textContent.includes('Loaded 1 tier assignments')");
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
  await button("Download Simple Template");
  const simpleTemplate = await evaluate("window.__exports.at(-1).text()");
  assert.equal(
    simpleTemplate.split("\n")[0],
    "SKU,Product_Name,Category,Regular_Price_USD,Unit_COGS_USD,Inventory_Units,Expected_Units,Priority_Tier,Target_Discount,Min_Discount,Max_Discount",
  );
  await button("Download Advanced Template");
  const advancedTemplate = await evaluate("window.__exports.at(-1).text()");
  assert(
    advancedTemplate.includes("Planned_Discount") &&
      advancedTemplate.includes("Other_Variable_Cost_USD") &&
      advancedTemplate.includes("Priority"),
  );
  // Export inherited tier settings, change defaults, then restore the portable snapshot natively.
  await evaluate(
    "document.querySelectorAll('details').forEach(e=>e.open=true)",
  );
  await input("Tier 1 target (%)", 10);
  await input("Tier 1 hard maximum (%)", 15);
  await evaluate(
    `document.querySelector('input[aria-label="Select ELE-004 for tier"]').click()`,
  );
  await frame();
  await button("Apply tier to 1 selected products");
  await button("Export tier assignments");
  const tierSnapshot = await evaluate("window.__exports.at(-1).text()");
  assert(tierSnapshot.includes("ELE-004,1,0.1,0,0.15"));
  const snapshotPath = resolve(artifacts, "exported-tier-snapshot.csv");
  await writeFile(snapshotPath, tierSnapshot);
  await input("Tier 1 target (%)", 5);
  await upload('input[aria-label="Upload tier CSV"]', snapshotPath);
  await wait("document.body.textContent.includes('Loaded 1 tier assignments')");
  await input("Product for tier overrides", "ELE-004");
  assert(
    await evaluate(
      `[...document.querySelectorAll('label')].find(l=>l.textContent.trim()==='Product tier target override (%)').querySelector('input').value==='10'`,
    ),
  );
  assert(
    await evaluate(
      `[...document.querySelectorAll('label')].find(l=>l.textContent.trim()==='Tier 1 target (%)').querySelector('input').value==='5'`,
    ),
  );
  await button("Export tier recommendations");
  const tierRecommendations = await evaluate("window.__exports.at(-1).text()");
  assert(
    tierRecommendations.includes("Suggested_Contribution") &&
      tierRecommendations.includes("Hard_Rules_Satisfied") &&
      tierRecommendations.includes("ELE-004"),
  );
  await fit(375, "Simple", "tier-csv-export-roundtrip");
  report.checks.push(
    "Real browser tier assignment export, native import under changed defaults and recommendation export preserve resolved offers.",
  );
  // Beta release audit: real key events and browser accessibility tree.

  await load(375);
  await evaluate("document.querySelector('.step-nav a').focus()");
  await key("Tab", "Tab", 9);
  assert(await evaluate("document.activeElement.getAttribute('href') === '#step-2'"));
  await key("Tab", "Tab", 9, 8);
  assert(await evaluate("document.activeElement.getAttribute('href') === '#step-1'"));
  await evaluate("document.querySelector('#step-3 .warning-summary > summary').focus()");
  await key(" ", "Space", 32);
  assert(await evaluate("document.querySelector('#step-3 .warning-summary').open"));
  await evaluate("document.querySelector('.improve').focus()");
  await key("Enter", "Enter", 13);
  assert(await evaluate("!!document.querySelector('.suggestion')"));
  assert(await evaluate("document.querySelector('#step-4').textContent.includes('Rounding checkout discounts can break')"));
  await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Use Suggested Plan').focus()");
  await key("Enter", "Enter", 13);
  assert(await evaluate("!document.querySelector('.suggestion') && document.body.textContent.includes('Profitable Plan')"));
  await fit(375, "Simple", "beta-keyboard-recommendation-and-warning");
  await button("Advanced Mode");
  await button("Optimize");
  const range = 'input[aria-label="Explore product discount steps"]';
  const previousStep = await evaluate(`Number(document.querySelector('${range}').value)`);
  await evaluate(`document.querySelector('${range}').focus()`);
  await key("ArrowRight", "ArrowRight", 39);
  assert.equal(await evaluate(`Number(document.querySelector('${range}').value)`), previousStep + 1);
  assert(await evaluate("document.body.textContent.includes('How Much More Can You Discount?') && document.body.textContent.includes('Rounding checkout discounts can break')"));
  await evaluate("document.querySelector('.chart-panel summary').focus()");
  await key("Enter", "Enter", 13);
  assert(await evaluate("document.querySelector('.chart-panel details').open"));
  await fit(375, "Advanced", "beta-keyboard-chart-and-methodology");
  const disabledAppearance = await evaluate("(()=>{const e=document.querySelector('button:disabled');return {disabled:e.disabled,opacity:getComputedStyle(e).opacity}})()");
  assert.deepEqual(disabledAppearance, { disabled: true, opacity: "1" });
  await evaluate("document.querySelector('.topbar button').scrollIntoView()");
  const hoverTarget = await evaluate("(()=>{const r=document.querySelector('.topbar button').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()");
  await page("Input.dispatchMouseEvent", { type: "mouseMoved", ...hoverTarget });
  await frame();
  await fit(375, "Advanced", "contrast-hover-and-disabled");
  const ax = await page("Accessibility.getFullAXTree");
  const controls = ax.nodes.filter(n => !n.ignored && ['button', 'link', 'textbox', 'spinbutton', 'slider', 'combobox', 'checkbox'].includes(n.role?.value));
  report.accessibility = {
    inspectedNamedControls: controls.length,
    unnamedControls: controls.filter(n => !n.name?.value).map(n => n.role.value),
    scope: "Chromium AX semantics and sampled keyboard navigation only; no screen reader or WCAG certification.",
  };
  assert.deepEqual(report.accessibility.unnamedControls, []);
  await evaluate("document.querySelector('.chart-panel').scrollIntoView()");
  await screenshot("beta-chart-375", false);
  report.captionStyle = await evaluate("(()=>{const e=document.querySelector('.chart-panel .caption'),s=getComputedStyle(e);return {color:s.color,fontSize:s.fontSize,panelBackground:getComputedStyle(e.closest('.panel')).backgroundColor}})()");
  report.checks.push("Beta keyboard: Tab/Shift+Tab workflow links, Space warning disclosure, Enter suggestion/apply/methodology and ArrowRight chart scrubber passed; sampled AX controls have names. Checkout-rounding disclosures are present in both modes.");
  } else {
    // Browser zoom changes layout viewport and DPR; pinch/page scale is not used.
    report.zoom = [];
    for (const width of [1024, 1440, 1920]) {
      await load(width);
      const metrics = await evaluate("({width:innerWidth,dpr:devicePixelRatio,scale:visualViewport.scale})");
      assert(Math.abs(metrics.width - width / browserZoom) < 2, `Expected actual browser zoom reflow: ${JSON.stringify({width,browserZoom,metrics})}`);
      assert(Math.abs(metrics.dpr - browserZoom) < 0.01, "Browser zoom must scale devicePixelRatio");
      await evaluate("document.querySelectorAll('details').forEach(e=>e.open=true)");
      await evaluate("document.querySelector('.step-nav a').focus()");
      await key("Tab", "Tab", 9);
      const focus = await evaluate("({width:parseFloat(getComputedStyle(document.activeElement).outlineWidth),visible:document.activeElement.matches(':focus-visible'),href:document.activeElement.getAttribute('href')})");
      assert(focus.width >= 2 && focus.visible && focus.href === '#step-2', `Keyboard focus at zoom: ${JSON.stringify(focus)}`);
      await fit(width, "Simple", `browser-zoom-${browserZoom}`);
      await button("Improve My Plan");
      assert(await evaluate("!!document.querySelector('.suggestion')"));
      await fit(width, "Simple", `zoom-suggestion-${browserZoom}`);
      if (width === 1440) await screenshot(`simple-1440-zoom-${browserZoom*100}`);
      await button("Advanced Mode");
      await button("Optimize");
      await evaluate("document.querySelectorAll('details').forEach(e=>e.open=true)");
      await fit(width, "Advanced", `browser-zoom-${browserZoom}`);
      assert(await evaluate("!!document.querySelector('input[aria-label=\"Explore product discount steps\"]')"));
      if (width === 1440) await screenshot(`advanced-1440-zoom-${browserZoom*100}`);
      if (await evaluate("document.querySelector('.mobile-nav-toggle').checkVisibility({checkVisibilityCSS:true})")) {
        await evaluate("document.querySelector('.mobile-nav-toggle').focus()");
        await key("Enter", "Enter", 13);
        assert(await evaluate("!document.querySelector('.mobile-navigation').hidden"));
        await fit(width, "Advanced", `zoom-navigation-${browserZoom}`);
        await evaluate("document.querySelector('.mobile-navigation a[href=\"#sku-table\"]').focus()");
        await key("Enter", "Enter", 13);
        assert(await evaluate("document.querySelector('.mobile-navigation').hidden"));
      }
      report.zoom.push({ physicalWidth: width, factor: browserZoom, ...metrics });
    }
  }
  assert.deepEqual(report.runtimeErrors, []);
  assert.deepEqual(report.externalRequests, []);
  await call("Target.closeTarget", { targetId });
  await writeFile(
    resolve(artifacts, browserZoom === 1 ? "report.json" : `zoom-${browserZoom*100}.json`),
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(
    `${report.browser}: ${report.viewports.length} layout/state checks passed; physical widths ${[...new Set(report.viewports.map(v=>v.width))].join(",")}px; browser zoom ${browserZoom * 100}%. No runtime errors or external requests. Report: work/browser-qa/${browserZoom === 1 ? "report.json" : `zoom-${browserZoom*100}.json`}`,
  );
} finally {
  ws?.close();
  chrome?.kill("SIGTERM");
  server.close();
}
