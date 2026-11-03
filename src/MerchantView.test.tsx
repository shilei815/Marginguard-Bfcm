// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, it, expect, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
  within,
} from "@testing-library/react";
import App from "./App";
import { template } from "./csv";
const change = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
const click = (name: string) =>
  fireEvent.click(screen.getByRole("button", { name }));
const upload = (
  csv: string,
  name = "merchant.csv",
  label = "Upload products CSV",
) =>
  fireEvent.change(screen.getByLabelText(label), {
    target: { files: [{ name, size: csv.length, text: async () => csv }] },
  });
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
describe("Phase 2A merchant workflow", () => {
  it("defaults to plain English with condensed warnings and visible profit exclusions", () => {
    render(<App />);
    expect(screen.getByRole("button", { name: "Advanced Mode" })).toBeTruthy();
    expect(screen.queryByText("Cumulative profitability frontier")).toBeNull();
    expect(screen.queryByLabelText("Optimization objective")).toBeNull();
    expect(screen.queryByText("Contribution profit")).toBeNull();
    expect(screen.getByText(/not final net profit/)).toBeTruthy();
    const summary = screen.getByText(
      /discount rules or profit warnings need attention/,
    );
    expect(summary.closest("details")!.open).toBe(false);
    expect(
      screen.getByRole("button", { name: "Improve My Plan" }),
    ).toBeTruthy();
  });
  it("reconfirms losing-money outcome for a uniform 20% discount in the rendered UI", () => {
    render(<App />);
    change("Storewide discount (%)", "20");
    expect(screen.getByText("Losing Money")).toBeTruthy();
    const cards = document.querySelector(".merchant-cards")!;
    expect(cards.textContent).toContain("$253,257");
    expect(cards.textContent).toContain("-$14,609");
    expect(cards.textContent).toContain("22");
    expect(
      screen.getByText(/This discount plan would lose money/),
    ).toBeTruthy();
  });
  it("preserves offers, rules, goals, buffers and stress assumptions when switching modes", () => {
    render(<App />);
    change("Storewide discount (%)", "20");
    change("Minimum Profit to Keep (USD)", "10000");
    change("Additional Safety Buffer (USD)", "500");
    fireEvent.click(screen.getByLabelText("Must-promote ELE-001"));
    click("Advanced Mode");
    expect(
      (
        screen.getByLabelText(
          "Contribution profit floor (USD)",
        ) as HTMLInputElement
      ).value,
    ).toBe("10000");
    expect(
      (screen.getByLabelText("ELE-001 discount percent") as HTMLInputElement)
        .value,
    ).toBe("20");
    change("Extra shipping / unit (USD)", "2");
    click("Simple Mode");
    expect(
      (screen.getByLabelText("Storewide discount (%)") as HTMLInputElement)
        .value,
    ).toBe("20");
    expect(
      (
        screen.getByLabelText(
          "Additional Safety Buffer (USD)",
        ) as HTMLInputElement
      ).value,
    ).toBe("500");
    expect(
      (screen.getByLabelText("Must-promote ELE-001") as HTMLInputElement)
        .checked,
    ).toBe(true);
    expect(
      screen.getByText(
        /Extra costs or discounts from Advanced Mode are active/,
      ),
    ).toBeTruthy();
    click("Advanced Mode");
    expect(
      (screen.getByLabelText("Extra shipping / unit (USD)") as HTMLInputElement)
        .value,
    ).toBe("2");
  });
  it("bulk-selects products and applies discounts and must-promote commitments", () => {
    render(<App />);
    fireEvent.click(screen.getByLabelText("Select ELE-001 for discount"));
    fireEvent.click(screen.getByLabelText("Select ELE-002 for discount"));
    change("Bulk special discount (%)", "15");
    click("Apply discount to 2 products");
    expect(
      (
        screen.getByLabelText(
          "ELE-001 special discount percent",
        ) as HTMLInputElement
      ).value,
    ).toBe("15");
    expect(
      (
        screen.getByLabelText(
          "ELE-002 special discount percent",
        ) as HTMLInputElement
      ).value,
    ).toBe("15");
    click("Mark selected Must-Promote");
    expect(
      (screen.getByLabelText("Must-promote ELE-002") as HTMLInputElement)
        .checked,
    ).toBe(true);
  });
  it("adds and clears differentiated bulk exact/max/preferred rules", () => {
    render(<App />);
    fireEvent.click(screen.getByLabelText("Select ELE-004 for promotion"));
    change("Discount rule", "exact");
    change("Rule discount (%)", "10");
    click("Apply rule to 1 selected products");
    expect(
      screen.getByRole("button", { name: "Clear exact rule for ELE-004" }),
    ).toBeTruthy();
    change("Discount rule", "max");
    change("Rule discount (%)", "12");
    click("Apply rule to 1 selected products");
    expect(
      screen.getByRole("button", { name: "Clear max rule for ELE-004" }),
    ).toBeTruthy();
    change("Discount rule", "preferred");
    click("Apply rule to 1 selected products");
    expect(
      screen.getByRole("button", { name: "Clear preferred rule for ELE-004" }),
    ).toBeTruthy();
    click("Clear exact rule for ELE-004");
    expect(
      screen.queryByRole("button", { name: "Clear exact rule for ELE-004" }),
    ).toBeNull();
  });
  it("initializes every successful dataset upload with a new explained goal, buffer and costs", async () => {
    render(<App />);
    change("Minimum Profit to Keep (USD)", "999");
    change("Additional Safety Buffer (USD)", "123");
    click("Advanced Mode");
    change("Extra shipping / unit (USD)", "5");
    click("Simple Mode");
    upload(template);
    await waitFor(() => expect(screen.getByText(/merchant.csv/)).toBeTruthy());
    expect(
      (
        screen.getByLabelText(
          "Minimum Profit to Keep (USD)",
        ) as HTMLInputElement
      ).value,
    ).toBe("1037.5");
    expect(
      (
        screen.getByLabelText(
          "Additional Safety Buffer (USD)",
        ) as HTMLInputElement
      ).value,
    ).toBe("0");
    expect(
      screen.queryByText(
        /Extra costs or discounts from Advanced Mode are active/,
      ),
    ).toBeNull();
    expect(screen.getByText(/50% of positive no-discount profit/)).toBeTruthy();
  });
  it("generates a verified before/after plan, honors buffer, and applies it", () => {
    render(<App />);
    change("Storewide discount (%)", "20");
    change("Minimum Profit to Keep (USD)", "20000");
    change("Additional Safety Buffer (USD)", "500");
    click("Improve My Plan");
    expect(screen.getByText("Current Plan → Suggested Plan")).toBeTruthy();
    expect(screen.getByText(/Goal plus buffer: met/)).toBeTruthy();
    expect(screen.getByText(/product discount changes required/)).toBeTruthy();
    click("Use Suggested Plan");
    expect(screen.getByText("Profitable Plan")).toBeTruthy();
    expect(screen.getByText(/Goal \+ buffer met: Yes/)).toBeTruthy();
  });
  it("never offers an apply button for conflicting rules or an impossible goal", async () => {
    render(<App />);
    upload(
      "SKU,Exact_Discount,Maximum_Discount\nELE-004,.2,.1",
      "rules.csv",
      "Upload must-promote CSV",
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Remove commitment ELE-004" }),
      ).toBeTruthy(),
    );
    click("Improve My Plan");
    expect(screen.getByRole("alert").textContent).toContain(
      "Your Discount Goals Can't All Be Met",
    );
    expect(
      screen.queryByRole("button", { name: "Use Suggested Plan" }),
    ).toBeNull();
  });
  it("exports before/after calculations locally with browser APIs", () => {
    const create = vi.fn(() => "blob:export");
    vi.stubGlobal("URL", { createObjectURL: create, revokeObjectURL: vi.fn() });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn(() => {
        throw Error("Network forbidden");
      }),
    );
    render(<App />);
    click("Export plan & recommendations");
    expect(create).toHaveBeenCalledOnce();
    expect(fetch).not.toHaveBeenCalled();
  });
  it("labels chart path, weighting, goal, safety buffer and break-even without frontier claims", () => {
    render(<App />);
    change("Storewide discount (%)", "20");
    change("Additional Safety Buffer (USD)", "100");
    const chart = screen.getByRole("img", {
      name: /Profit after variable costs from current plan/,
    });
    expect(within(chart).getByText("Current Plan")).toBeTruthy();
    expect(within(chart).getByText("Suggested Plan")).toBeTruthy();
    expect(within(chart).getByText("Break-even")).toBeTruthy();
    expect(screen.getByText(/Overall discount = sum/)).toBeTruthy();
    expect(screen.getByText(/Goal \+ Safety Buffer:/)).toBeTruthy();
  });
  it("retains the previous campaign after invalid upload and explains required data", async () => {
    render(<App />);
    change("Minimum Profit to Keep (USD)", "1234");
    upload("SKU,Price\nA,10");
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain(
        "Missing required column",
      ),
    );
    expect(
      (
        screen.getByLabelText(
          "Minimum Profit to Keep (USD)",
        ) as HTMLInputElement
      ).value,
    ).toBe("1234");
    expect(screen.getByText(/Field mapping is not available yet/)).toBeTruthy();
  });
  it("keeps accessible actions at narrow widths; visual layout needs real-browser QA", () => {
    vi.stubGlobal("innerWidth", 375);
    render(<App />);
    expect(screen.getByLabelText("Storewide discount (%)")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Improve My Plan" }),
    ).toBeTruthy();
    expect(screen.getByLabelText("Upload products CSV")).toBeTruthy();
    expect(document.querySelector(".table-scroll")).toBeTruthy();
  });
});
