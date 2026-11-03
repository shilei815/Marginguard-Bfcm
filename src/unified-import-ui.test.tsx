// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, it, expect, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
  within,
} from "@testing-library/react";
import App from "./App";
import { download, records } from "./csv";
import {
  simpleProductTemplate,
  advancedProductTemplate,
  costColumns,
} from "./unifiedImport";
vi.mock("./csv", async () => ({
  ...(await vi.importActual<typeof import("./csv")>("./csv")),
  download: vi.fn(),
}));
const minimal =
  "SKU,Regular_Price_USD,Unit_COGS_USD,Inventory_Units,Expected_Units\nA,50,20,100,10";
const unified =
  "SKU,Regular_Price_USD,Unit_COGS_USD,Inventory_Units,Expected_Units,Priority_Tier,Target_Discount,Min_Discount,Max_Discount,Planned_Discount,Exact_Discount,Preferred_Discount\nA,50,20,100,10,1,.3,.1,.4,.25,.25,.3";
const click = (name: string) =>
  fireEvent.click(screen.getByRole("button", { name }));
const change = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
const upload = (
  text: string,
  name = "products.csv",
  label = "Upload products CSV",
) =>
  fireEvent.change(screen.getByLabelText(label), {
    target: { files: [{ name, size: text.length, text: async () => text }] },
  });
async function load(text = minimal, name = "products.csv") {
  upload(text, name);
  await waitFor(() => expect(screen.getByText(name)).toBeTruthy());
}
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});
describe("unified evergreen onboarding", () => {
  it("uses evergreen copy and one primary upload with both named templates", () => {
    render(<App />);
    expect(
      screen.getByText("Plan Smarter Discounts. Protect Your Profit."),
    ).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/BFCM|Black Friday/);
    const section = screen.getByRole("region", { name: "Upload Products" });
    expect(
      section.querySelectorAll(".button.primary input[type=file]"),
    ).toHaveLength(1);
    expect(
      screen.getByRole("button", { name: "Download Simple Template" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Download Advanced Template" }),
    ).toBeTruthy();
    const tools = screen.getByText("Advanced Import Tools").closest("details")!;
    expect(tools.open).toBe(false);
    expect(tools.contains(screen.getByLabelText("Upload tier CSV"))).toBe(true);
    expect(
      tools.contains(screen.getByLabelText("Upload must-promote CSV")),
    ).toBe(true);
  });
  it("downloads the exact Simple and supported Advanced schemas with evergreen file names", () => {
    render(<App />);
    click("Download Simple Template");
    expect(vi.mocked(download)).toHaveBeenLastCalledWith(
      "marginguard-simple-product-template.csv",
      simpleProductTemplate,
    );
    click("Download Advanced Template");
    expect(vi.mocked(download)).toHaveBeenLastCalledWith(
      "marginguard-advanced-product-template.csv",
      advancedProductTemplate,
    );
  });
  it("accepts five columns, shows incomplete cost status, and preserves numbers across explicit zero confirmation", async () => {
    render(<App />);
    await load();
    expect(
      screen.getByRole("heading", { name: "Some Costs Missing" }),
    ).toBeTruthy();
    expect(
      screen.getByText(/Your estimated profit may be overstated/),
    ).toBeTruthy();
    expect(
      screen.getByText("Estimated goal met — costs incomplete"),
    ).toBeTruthy();
    expect(
      screen.queryByText(
        /Your current discount plan already meets your profit goal/,
      ),
    ).toBeNull();
    const before = document.querySelector(".merchant-cards")!.textContent;
    fireEvent.click(
      screen.getByLabelText(
        "Confirm all omitted cost inputs are zero or not applicable",
      ),
    );
    expect(
      screen.getByRole("heading", { name: "Cost Data Complete" }),
    ).toBeTruthy();
    expect(document.querySelector(".merchant-cards")!.textContent).toBe(before);
    expect(screen.getByText("Profitable Plan")).toBeTruthy();
    fireEvent.click(
      screen.getByLabelText(
        "Confirm all omitted cost inputs are zero or not applicable",
      ),
    );
    expect(
      screen.getByRole("heading", { name: "Some Costs Missing" }),
    ).toBeTruthy();
  });
  it("loads products, tiers, rules and planned offers in one upload without converting Tier 1 into P1", async () => {
    render(<App />);
    await load(unified);
    expect(
      (screen.getByLabelText("A special discount percent") as HTMLInputElement)
        .value,
    ).toBe("25");
    expect(
      (screen.getByLabelText("Promotion tier for A") as HTMLSelectElement)
        .value,
    ).toBe("1");
    expect(
      screen.getByRole("button", { name: "Remove commitment A" }),
    ).toBeTruthy();
    const summary = screen.getByLabelText("Import summary");
    expect(summary.textContent).toContain("1 products loaded");
    expect(summary.textContent).toContain("1 tier assignments");
    expect(summary.textContent).toContain("1 custom discount rule sets");
    expect(summary.textContent).toContain("1 imported planned offers");
    click("Advanced Mode");
    expect(screen.getAllByText("P3").length).toBeGreaterThan(0);
    expect(
      (screen.getByLabelText("A discount percent") as HTMLInputElement).value,
    ).toBe("25");
    expect(document.body.textContent).not.toMatch(/BFCM|Black Friday/);
  });
  it("shows imported planned-versus-hard-rule conflicts without overwriting the merchant offer", async () => {
    render(<App />);
    await load(unified.replace(",.25,.25,.3", ",.05,.25,.3"));
    expect(
      (screen.getByLabelText("A special discount percent") as HTMLInputElement)
        .value,
    ).toBe("5");
    expect(screen.getByText(/Keep the exact 25.0% offer/)).toBeTruthy();
    click("Improve My Plan");
    click("Use Suggested Plan");
    expect(
      (screen.getByLabelText("A special discount percent") as HTMLInputElement)
        .value,
    ).toBe("25");
  });
  it("atomically retains data, tiers, rules, costs, goal, buffer and offers after a failed primary import", async () => {
    render(<App />);
    await load(unified);
    fireEvent.click(
      screen.getByLabelText(
        "Confirm all omitted cost inputs are zero or not applicable",
      ),
    );
    change("Minimum Profit to Keep (USD)", "120");
    change("Additional Safety Buffer (USD)", "5");
    click("Export plan & recommendations");
    const before = vi.mocked(download).mock.calls.at(-1)![1];
    upload(unified.replace(",.1,.4,", ",.8,.4,"), "invalid.csv");
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    expect(screen.getByText("products.csv")).toBeTruthy();
    expect(screen.queryByText("invalid.csv")).toBeNull();
    expect(
      screen.getByRole("heading", { name: "Cost Data Complete" }),
    ).toBeTruthy();
    expect(
      (
        screen.getByLabelText(
          "Minimum Profit to Keep (USD)",
        ) as HTMLInputElement
      ).value,
    ).toBe("120");
    expect(
      (
        screen.getByLabelText(
          "Additional Safety Buffer (USD)",
        ) as HTMLInputElement
      ).value,
    ).toBe("5");
    expect(screen.getByLabelText("Promotion tier for A")).toBeTruthy();
    click("Export plan & recommendations");
    expect(vi.mocked(download).mock.calls.at(-1)![1]).toBe(before);
  });
  it("keeps explicit zeros distinct from missing costs and confirms completeness only with all fields supplied", async () => {
    render(<App />);
    const allZero =
      minimal.split("\n")[0] +
      "," +
      costColumns.join(",") +
      "\nA,50,20,100,10," +
      costColumns.map(() => 0).join(",");
    await load(allZero);
    expect(
      screen.getByRole("heading", { name: "Cost Data Complete" }),
    ).toBeTruthy();
    expect(
      screen.getByText("7 explicit zero inputs · 0 positive inputs"),
    ).toBeTruthy();
    expect(
      screen.queryByLabelText(
        "Confirm all omitted cost inputs are zero or not applicable",
      ),
    ).toBeNull();
  });
  it("retains cost confirmation, imported offers and tiers across mode switches", async () => {
    render(<App />);
    await load(unified);
    fireEvent.click(
      screen.getByLabelText(
        "Confirm all omitted cost inputs are zero or not applicable",
      ),
    );
    click("Advanced Mode");
    expect(
      screen.getByRole("heading", { name: "Cost Data Complete" }),
    ).toBeTruthy();
    click("Simple Mode");
    expect(
      (
        screen.getByLabelText(
          "Confirm all omitted cost inputs are zero or not applicable",
        ) as HTMLInputElement
      ).checked,
    ).toBe(true);
    expect(
      (screen.getByLabelText("A special discount percent") as HTMLInputElement)
        .value,
    ).toBe("25");
    expect(screen.getByLabelText("Promotion tier for A")).toBeTruthy();
  });
  it("allows structurally valid, financially infeasible campaigns for review without a suggested apply action", async () => {
    render(<App />);
    await load(minimal.replace("A,50,20", "A,50,60"));
    expect(screen.getByText("Losing Money")).toBeTruthy();
    click("Improve My Plan");
    expect(
      screen.getByText("Your Discount Goals Can't All Be Met"),
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Use Suggested Plan" }),
    ).toBeNull();
  });
  it("exports numeric estimates with cost-completeness metadata and formula-safe quality reports", async () => {
    render(<App />);
    await load();
    click("Export plan & recommendations");
    const row = records(vi.mocked(download).mock.calls.at(-1)![1])[0];
    expect(row.Costs_Complete).toBe("false");
    click("Export cost input report");
    expect(records(vi.mocked(download).mock.calls.at(-1)![1])).toHaveLength(7);
  });
  it("preserves standalone tier and rule updates under Advanced Import Tools", async () => {
    render(<App />);
    await load();
    upload(
      "SKU,Priority_Tier,Target_Discount\nA,2,.3",
      "tiers.csv",
      "Upload tier CSV",
    );
    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toContain(
        "Loaded 1 tier assignments",
      ),
    );
    upload(
      "SKU,Minimum_Discount,Preferred_Discount\nA,.1,.3",
      "rules.csv",
      "Upload must-promote CSV",
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Remove commitment A" }),
      ).toBeTruthy(),
    );
    expect(
      screen.getByRole("heading", { name: "Some Costs Missing" }),
    ).toBeTruthy();
    expect(
      (screen.getByLabelText("A special discount percent") as HTMLInputElement)
        .value,
    ).toBe("10");
    expect(screen.getByLabelText("Promotion tier for A")).toBeTruthy();
  });
  it("ignores a stale slow file when a newer upload completes first", async () => {
    render(<App />);
    let finish!: (text: string) => void;
    const pending = new Promise<string>((r) => {
      finish = r;
    });
    fireEvent.change(screen.getByLabelText("Upload products CSV"), {
      target: { files: [{ name: "slow.csv", size: 10, text: () => pending }] },
    });
    await load(unified, "latest.csv");
    finish(minimal);
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.getByText("latest.csv")).toBeTruthy();
    expect(screen.queryByText("slow.csv")).toBeNull();
    expect(screen.getByLabelText("Promotion tier for A")).toBeTruthy();
  });
  it("performs imports and estimates with network calls disabled", async () => {
    const fetch = vi.fn(() => {
      throw Error("No remote financial requests");
    });
    vi.stubGlobal("fetch", fetch);
    render(<App />);
    await load(unified);
    click("Improve My Plan");
    expect(fetch).not.toHaveBeenCalled();
  });
});
