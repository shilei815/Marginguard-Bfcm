// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, it, expect, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import App from "./App";
import { download, records, template } from "./csv";
vi.mock("./csv", async () => ({
  ...(await vi.importActual<typeof import("./csv")>("./csv")),
  download: vi.fn(),
}));
const change = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
const click = (name: string) =>
  fireEvent.click(screen.getByRole("button", { name }));
const upload = (label: string, csv: string, name = "tiers.csv") =>
  fireEvent.change(screen.getByLabelText(label), {
    target: { files: [{ name, size: csv.length, text: async () => csv }] },
  });
const list =
  "SKU,Priority_Tier,Target_Discount,Min_Discount,Max_Discount\nELE-004,1,0.1,0.05,0.15\nHOM-004,2,0.1,0,0.1\nACC-004,3,0.1,0,0.1";
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});
async function loadList() {
  upload("Upload tier CSV", list);
  await waitFor(() =>
    expect(screen.getByRole("status").textContent).toContain(
      "Loaded 3 tier assignments",
    ),
  );
}
describe("merchant tier controls", () => {
  it("keeps neutral defaults and the four-step workflow, with a separate merchant tier section", () => {
    render(<App />);
    expect(
      screen.getByRole("region", { name: "Protect Your Important Products" }),
    ).toBeTruthy();
    expect(
      (screen.getByLabelText("Tier 1 target (%)") as HTMLInputElement).value,
    ).toBe("0");
    expect(
      (screen.getByLabelText("Tier 1 hard maximum (%)") as HTMLInputElement)
        .value,
    ).toBe("100");
    expect(
      [...document.querySelectorAll('section[id^="step-"]')].map((x) => x.id),
    ).toEqual(["step-1", "step-2", "step-3", "step-4"]);
    expect(screen.getByText(/A tier is not an exact lock/)).toBeTruthy();
  });
  it("bulk assigns and removes tiers without making a hard minimum commitment", () => {
    render(<App />);
    change("Tier 1 target (%)", "10");
    fireEvent.click(screen.getByLabelText("Select ELE-004 for tier"));
    fireEvent.click(screen.getByLabelText("Select ELE-005 for tier"));
    click("Apply tier to 2 selected products");
    expect(screen.getByLabelText("Promotion tier for ELE-004")).toBeTruthy();
    expect(
      (screen.getByLabelText("Must-promote ELE-004") as HTMLInputElement)
        .checked,
    ).toBe(false);
    change("Assign selected products to tier", "");
    click("Apply tier to 2 selected products");
    expect(screen.queryByLabelText("Promotion tier for ELE-004")).toBeNull();
  });
  it("inherits tier defaults, uses individual overrides, and retains them when changing tiers", () => {
    render(<App />);
    change("Tier 1 target (%)", "10");
    change("Tier 1 hard maximum (%)", "15");
    fireEvent.click(screen.getByLabelText("Select ELE-004 for tier"));
    click("Apply tier to 1 selected products");
    change("Product for tier overrides", "ELE-004");
    expect(
      (
        screen.getByLabelText(
          "Product tier maximum override (%)",
        ) as HTMLInputElement
      ).placeholder,
    ).toBe("Inherit 15.0%");
    change("Product tier maximum override (%)", "12");
    change("Individual product tier", "2");
    expect(
      (
        screen.getByLabelText(
          "Product tier maximum override (%)",
        ) as HTMLInputElement
      ).value,
    ).toBe("12");
    click("Export tier assignments");
    expect(records(vi.mocked(download).mock.calls.at(-1)![1])[0]).toMatchObject(
      { SKU: "ELE-004", Priority_Tier: "2", Max_Discount: "0.12" },
    );
    change("Product tier maximum override (%)", "");
    expect(
      (
        screen.getByLabelText(
          "Product tier maximum override (%)",
        ) as HTMLInputElement
      ).placeholder,
    ).toBe("Inherit 100.0%");
  });
  it("loads standalone CSV locally and preserves assignments/defaults/rules across modes", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => {
        throw Error("No network");
      }),
    );
    render(<App />);
    change("Tier 1 target (%)", "10");
    await loadList();
    change("Minimum Profit to Keep (USD)", "20000");
    change("Additional Safety Buffer (USD)", "500");
    click("Advanced Mode");
    expect(
      (screen.getByLabelText("Tier 1 target (%)") as HTMLInputElement).value,
    ).toBe("10");
    expect(
      screen.getAllByText("File priority (legacy)").length,
    ).toBeGreaterThan(0);
    change("Tier 2 target (%)", "12");
    click("Simple Mode");
    expect(
      (screen.getByLabelText("Tier 2 target (%)") as HTMLInputElement).value,
    ).toBe("12");
    expect(
      (screen.getByLabelText("Promotion tier for HOM-004") as HTMLSelectElement)
        .value,
    ).toBe("2");
    expect(
      (
        screen.getByLabelText(
          "Minimum Profit to Keep (USD)",
        ) as HTMLInputElement
      ).value,
    ).toBe("20000");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("keeps current offers unchanged when configuring tiers after an Advanced allocation", () => {
    render(<App />);
    click("Advanced Mode");
    click("Optimize");
    click("Simple Mode");
    click("Export plan & recommendations");
    const before = records(vi.mocked(download).mock.calls.at(-1)![1]).map(
      (r) => [r.SKU, r.Current_Discount],
    );
    change("Tier 1 target (%)", "10");
    fireEvent.click(screen.getByLabelText("Select ELE-004 for tier"));
    click("Apply tier to 1 selected products");
    click("Export plan & recommendations");
    const after = records(vi.mocked(download).mock.calls.at(-1)![1]).map(
      (r) => [r.SKU, r.Current_Discount],
    );
    expect(after).toEqual(before);
  });
  it("exports importable assignment CSV and financial recommendations with verification fields", async () => {
    render(<App />);
    await loadList();
    click("Export tier assignments");
    expect(records(vi.mocked(download).mock.calls.at(-1)![1])).toHaveLength(3);
    click("Export tier recommendations");
    const rows = records(vi.mocked(download).mock.calls.at(-1)![1]);
    const row = rows.find((r) => r.SKU === "ELE-004")!;
    expect(row).toMatchObject({
      Priority_Tier: "1",
      Data_File_Priority: "P2",
      Target_Discount: "0.1",
      Hard_Rules_Satisfied: "true",
      Suggestion_Feasible: "true",
    });
    expect(Number.isFinite(Number(row.Suggested_Contribution))).toBe(true);
  });
  it("shows live tier target reporting, clear lower-tier reasons, and safe suggestion application", async () => {
    render(<App />);
    await loadList();
    change("Storewide discount (%)", "20");
    change("Minimum Profit to Keep (USD)", "20000");
    change("Additional Safety Buffer (USD)", "500");
    click("Improve My Plan");
    expect(
      screen.getByRole("region", { name: "Product protection summary" }),
    ).toBeTruthy();
    expect(
      screen.getByText(/Minimum profit goal \+ safety buffer: Met/),
    ).toBeTruthy();
    click("Use Suggested Plan");
    expect(screen.getByText(/No changes are needed/)).toBeTruthy();
    expect(screen.getByText("Profitable Plan")).toBeTruthy();
  });
  it("rejects invalid tier CSV atomically, including a conflict with existing file bounds", async () => {
    render(<App />);
    await loadList();
    upload(
      "Upload tier CSV",
      "SKU,Priority_Tier,Target_Discount,Min_Discount,Max_Discount\nELE-001,1,.3,.25,.35",
    );
    await waitFor(() =>
      expect(screen.getByText("Tier list could not be loaded")).toBeTruthy(),
    );
    expect(screen.getByLabelText("Promotion tier for ELE-004")).toBeTruthy();
    expect(screen.queryByLabelText("Promotion tier for ELE-001")).toBeNull();
  });
  it("does not offer a suggestion when editing inherited hard settings makes a campaign impossible", () => {
    render(<App />);
    change("Tier 1 target (%)", "30");
    change("Tier 1 hard minimum (%)", "25");
    fireEvent.click(screen.getByLabelText("Select ELE-001 for tier"));
    click("Apply tier to 1 selected products");
    click("Improve My Plan");
    expect(
      screen.getByText("Your Discount Goals Can't All Be Met"),
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Use Suggested Plan" }),
    ).toBeNull();
  });
  it("reports explicit preferred-versus-tier target precedence instead of guaranteeing the tier target", async () => {
    render(<App />);
    await loadList();
    upload(
      "Upload must-promote CSV",
      "SKU,Preferred_Discount\nELE-004,0.05",
      "rules.csv",
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Remove commitment ELE-004" }),
      ).toBeTruthy(),
    );
    expect(
      screen.getAllByText(/explicit product preferred offer overrides/).length,
    ).toBeGreaterThan(0);
  });
  it("starts new product uploads with fresh tier settings, also in Advanced Mode", async () => {
    render(<App />);
    await loadList();
    click("Advanced Mode");
    upload("Upload SKU CSV", template, "new-products.csv");
    await waitFor(() =>
      expect(screen.getByText("new-products.csv")).toBeTruthy(),
    );
    expect(
      (screen.getByLabelText("Product for tier overrides") as HTMLSelectElement)
        .value,
    ).toBe("EXAMPLE-001");
    click("Simple Mode");
    expect(
      screen.queryByRole("region", { name: "Product protection summary" }),
    ).toBeNull();
    expect(
      (screen.getByLabelText("Tier 1 target (%)") as HTMLInputElement).value,
    ).toBe("0");
  });
  it.each([320, 375, 390, 430])(
    "retains labelled tier inputs and CSV actions at %ipx (real layout checked in Chromium)",
    (width) => {
      vi.stubGlobal("innerWidth", width);
      render(<App />);
      expect(
        screen.getByLabelText("Assign selected products to tier"),
      ).toBeTruthy();
      expect(screen.getByLabelText("Upload tier CSV")).toBeTruthy();
      expect(
        screen.getByRole("button", { name: "Download tier CSV template" }),
      ).toBeTruthy();
    },
  );
});
