// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, it, expect, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  within,
} from "@testing-library/react";
import App from "./App";
import { Amount, ProfitChart } from "./MerchantView";
import {
  DisplayNumberInput,
  WarningSummary,
  DiagnosticSummary,
  usd,
} from "./presentation";
import { parseSKUs, template, download, records } from "./csv";
import { initialGoal, type PlanWarning } from "./planner";
import demo from "../sku_master.csv?raw";
vi.mock("./csv", async () => ({
  ...(await vi.importActual<typeof import("./csv")>("./csv")),
  download: vi.fn(),
}));
const skus = parseSKUs(template).skus,
  id = skus[0].id;
const click = (name: string) =>
  fireEvent.click(screen.getByRole("button", { name }));
const change = (name: string, value: string) =>
  fireEvent.change(screen.getByLabelText(name), { target: { value } });
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});
describe("Phase 2B UX regressions", () => {
  it("orders the four actual sections and navigation anchors 1,2,3,4", () => {
    render(<App />);
    expect(
      [...document.querySelectorAll('section[id^="step-"]')].map((e) => e.id),
    ).toEqual(["step-1", "step-2", "step-3", "step-4"]);
    expect(
      [...document.querySelectorAll(".step-nav a")].map((e) =>
        e.getAttribute("href"),
      ),
    ).toEqual(["#step-1", "#step-2", "#step-3", "#step-4"]);
    expect(document.querySelector("#step-3 .merchant-cards")).toBeTruthy();
  });
  it("replaces identical rule-compliant plans with an informative profit/goal state", () => {
    render(
      <ProfitChart
        skus={skus}
        current={{ [id]: 0.1 }}
        suggested={{ [id]: 0.1 }}
        a={{ stack: 0, shipping: 0, returns: 0 }}
        goal={100}
        buffer={50}
      />,
    );
    expect(
      screen.getByText(
        "Your current discount plan already meets your profit goal. No changes are needed.",
      ),
    ).toBeTruthy();
    expect(
      screen.getByText(/Current profit after variable costs/),
    ).toBeTruthy();
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByText("$150.00")).toBeTruthy();
  });
  it("handles effectively identical plans without changing financial tolerances", () => {
    render(
      <ProfitChart
        skus={skus}
        current={{ [id]: 0.1 }}
        suggested={{ [id]: 0.1 + 1e-12 }}
        a={{ stack: 0, shipping: 0, returns: 0 }}
        goal={100}
        buffer={0}
      />,
    );
    expect(screen.getByText(/No changes are needed/)).toBeTruthy();
  });
  it("never displays all-clear for coincident endpoints with conflicting hard rules", () => {
    render(
      <ProfitChart
        skus={skus}
        current={{ [id]: 0.1 }}
        suggested={{ [id]: 0.1 }}
        a={{ stack: 0, shipping: 0, returns: 0 }}
        goal={100}
        buffer={0}
        rules={[{ id, min: 0.4, max: 0.2 }]}
      />,
    );
    expect(screen.queryByText(/No changes are needed/)).toBeNull();
    expect(screen.getByText(/unresolved discount rules/)).toBeTruthy();
    expect(
      screen.getByText(/required and maximum\/exact discounts conflict/),
    ).toBeTruthy();
  });
  it("does not display all-clear when identical outputs miss the buffered goal", () => {
    render(
      <ProfitChart
        skus={skus}
        current={{ [id]: 0.1 }}
        suggested={{ [id]: 0.1 }}
        a={{ stack: 0, shipping: 0, returns: 0 }}
        goal={100000}
        buffer={100}
      />,
    );
    expect(screen.queryByText(/No changes are needed/)).toBeNull();
    expect(screen.getByText(/unresolved discount rules/)).toBeTruthy();
  });
  it("retains the detailed chart when discount vectors differ despite equal totals", () => {
    const two = [skus[0], { ...skus[0], id: "B" }];
    render(
      <ProfitChart
        skus={two}
        current={{ [id]: 0.1, B: 0.2 }}
        suggested={{ [id]: 0.2, B: 0.1 }}
        a={{ stack: 0, shipping: 0, returns: 0 }}
        goal={100}
        buffer={0}
      />,
    );
    expect(screen.getByRole("img")).toBeTruthy();
    expect(screen.queryByText(/No changes are needed/)).toBeNull();
  });
  it("shows cents in supporting money labels, with rounded monetary inputs", () => {
    expect(usd(23434.665500000003)).toBe("$23,434.67");
    expect(usd(-0.25)).toBe("-$0.25");
    const cb = vi.fn();
    render(
      <Amount label="Goal (USD)" value={23434.665500000003} onChange={cb} />,
    );
    const input = screen.getByLabelText("Goal (USD)") as HTMLInputElement;
    expect(input.value).toBe("23434.67");
    fireEvent.focus(input);
    fireEvent.blur(input);
    expect(cb).not.toHaveBeenCalled();
  });
  it("retains explicit high-precision edits and only formats on blur", () => {
    const cb = vi.fn();
    render(
      <DisplayNumberInput
        aria-label="Money"
        value={10.1234567}
        onValueChange={cb}
      />,
    );
    const input = screen.getByLabelText("Money");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "12.3456789" } });
    expect((input as HTMLInputElement).value).toBe("12.3456789");
    expect(cb).toHaveBeenLastCalledWith(12.3456789);
    fireEvent.blur(input);
    expect(cb).toHaveBeenCalledOnce();
  });
  it("does not round saved goals while focusing inputs or switching modes", () => {
    render(<App />);
    const expected = initialGoal(parseSKUs(demo).skus),
      input = screen.getByLabelText("Minimum Profit to Keep (USD)");
    fireEvent.focus(input);
    fireEvent.blur(input);
    click("Advanced Mode");
    const advanced = screen.getByLabelText(
      "Contribution profit floor (USD)",
    ) as HTMLInputElement;
    expect(advanced.value).toBe("23434.67");
    fireEvent.focus(advanced);
    fireEvent.blur(advanced);
    click("Simple Mode");
    click("Export plan & recommendations");
    const output = vi.mocked(download).mock.calls.at(-1)![1];
    expect(Number(records(output)[0].Minimum_Profit_Goal)).toBe(expected);
  });
  it("summarizes unique affected products separately and retains categorized details", () => {
    const warnings: PlanWarning[] = [
      {
        kind: "Below minimum",
        category: "Example",
        id,
        message: "minimum needed",
      },
      {
        kind: "Exact discount",
        category: "Example",
        id,
        message: "exact needed",
      },
      {
        kind: "Above maximum",
        category: "Other",
        id: "B",
        message: "too high",
      },
      { kind: "Profit goal", category: "Campaign", message: "goal not met" },
    ];
    render(<WarningSummary warnings={warnings} />);
    expect(screen.getByText("2 unique products affected.")).toBeTruthy();
    const summary = screen.getByText(/4 discount rules or profit warnings/);
    expect(summary.closest("details")!.open).toBe(false);
    expect(screen.getByText("exact needed")).toBeTruthy();
    expect(screen.getByText(/Other · 1 warning · 1 product/)).toBeTruthy();
  });
  it("shows one primary conflict reason before collapsed original diagnostics", () => {
    const errors = [
      `${id}: required and maximum/exact discounts conflict with product-file rules.`,
      `${id}: second conflict detail`,
    ];
    render(
      <DiagnosticSummary
        title="Cannot meet all goals"
        errors={errors}
        skus={skus}
      />,
    );
    const alert = screen.getByRole("alert");
    expect(
      within(alert).getByText(/Some required offers conflict/),
    ).toBeTruthy();
    expect(within(alert).getByText(/second conflict detail/)).toBeTruthy();
    expect(alert.querySelector("details")!.open).toBe(false);
    expect(within(alert).getByText("1 unique product affected.")).toBeTruthy();
  });
  it("shows the campaign safety buffer once in Scenario Builder, not in SKU rows", () => {
    render(<App />);
    click("Advanced Mode");
    const fields = screen.getAllByLabelText("Additional Safety Buffer (USD)");
    expect(fields).toHaveLength(1);
    expect(fields[0].closest(".controls")).toBeTruthy();
    expect(document.querySelector("#sku-table")!.textContent).not.toContain(
      "Safety Buffer",
    );
  });
  it.each([320, 375, 390, 430, 768])(
    "retains mobile navigation and scenario controls at %ipx (layout verified separately in Chromium)",
    (width) => {
      vi.stubGlobal("innerWidth", width);
      render(<App />);
      change("Minimum Profit to Keep (USD)", "1234.567");
      click("Advanced Mode");
      const nav = screen.getByRole("button", { name: "Navigation" });
      expect(nav.getAttribute("aria-expanded")).toBe("false");
      fireEvent.click(nav);
      expect(nav.getAttribute("aria-expanded")).toBe("true");
      const menu = screen.getByRole("navigation", {
        name: "Advanced mobile navigation",
      });
      expect(
        within(menu).getByRole("link", { name: "SKU profitability" }),
      ).toBeTruthy();
      fireEvent.click(
        within(menu).getByRole("link", { name: "SKU profitability" }),
      );
      expect(nav.getAttribute("aria-expanded")).toBe("false");
      expect(screen.getByText("Scenario builder")).toBeTruthy();
      click("Simple Mode");
      expect(
        (
          screen.getByLabelText(
            "Minimum Profit to Keep (USD)",
          ) as HTMLInputElement
        ).value,
      ).toBe("1234.57");
    },
  );
});
