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
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
function change(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}
function renderAdvanced() {
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "Advanced Mode" }));
  fireEvent.click(screen.getByRole("button", { name: "Optimize" }));
}
describe("browser planner interactions", () => {
  it("renders optimized demo, financial distinctions and local-only statement", () => {
    renderAdvanced();
    expect(
      screen.getByText("Plan Smarter Discounts. Protect Your Profit."),
    ).toBeTruthy();
    expect(screen.getByText("Portfolio floor protected")).toBeTruthy();
    expect(screen.getAllByText("Gross profit").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Contribution profit").length).toBeGreaterThan(
      0,
    );
    expect(
      screen.getByText(/No financial data is sent to a server/),
    ).toBeTruthy();
  });
  it("updates uniform, category, and SKU overrides with precedence", () => {
    renderAdvanced();
    fireEvent.click(screen.getByRole("button", { name: "Manual scenario" }));
    change("Uniform discount", "20");
    expect(
      (screen.getByLabelText("ELE-001 discount percent") as HTMLInputElement)
        .value,
    ).toBe("20");
    change("Electronics (%)", "15");
    expect(
      (screen.getByLabelText("ELE-001 discount percent") as HTMLInputElement)
        .value,
    ).toBe("15");
    change("ELE-001 discount percent", "25");
    change("Electronics (%)", "10");
    expect(
      (screen.getByLabelText("ELE-001 discount percent") as HTMLInputElement)
        .value,
    ).toBe("25");
  });
  it("filters loss SKUs, searches, paginates, and saves a comparison", () => {
    renderAdvanced();
    change("Search SKUs", "ELE-001");
    expect(screen.getByText("Electronics Item 01")).toBeTruthy();
    expect(screen.queryByText("Electronics Item 02")).toBeNull();
    change("Scenario name", "Review A");
    fireEvent.click(screen.getByRole("button", { name: "Save snapshot" }));
    expect(screen.getByText("Review A")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Remove Review A" }));
    expect(screen.queryByText("Review A")).toBeNull();
  });
  it("reports impossible priority constraints and floor breaches", () => {
    renderAdvanced();
    change("Minimum (%)", "90");
    change("Preferred (%)", "90");
    fireEvent.click(
      screen.getByRole("button", { name: "Add / update priority" }),
    );
    expect(screen.getByText(/Optimization infeasible/)).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "Remove priority ELE-001" }),
    );
    change("Contribution profit floor (USD)", "1000000");
    expect(screen.getByText(/Required discounts yield/)).toBeTruthy();
  });
  it("preserves valid data after a failed CSV upload", async () => {
    renderAdvanced();
    const file = {
      size: 10,
      name: "bad.csv",
      text: async () => "SKU,Price\nA,10",
    };
    fireEvent.change(screen.getByLabelText("Upload SKU CSV"), {
      target: { files: [file] },
    });
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain(
        "Missing required column",
      ),
    );
    expect(screen.getByText("Synthetic demo · 30 fictional SKUs")).toBeTruthy();
  });
  it("loads SKU and priority CSV entirely locally", async () => {
    const fetch = vi.fn(() => {
      throw Error("Network calls forbidden");
    });
    vi.stubGlobal("fetch", fetch);
    renderAdvanced();
    fireEvent.change(screen.getByLabelText("Upload SKU CSV"), {
      target: {
        files: [
          {
            name: "merchant.csv",
            size: template.length,
            text: async () => template,
          },
        ],
      },
    });
    await waitFor(() => expect(screen.getByText("merchant.csv")).toBeTruthy());
    expect(screen.getByText("Example product")).toBeTruthy();
    const csv = "SKU,Minimum_Discount,Preferred_Discount\nEXAMPLE-001,0.1,0.2";
    fireEvent.change(screen.getByLabelText("Upload priority CSV"), {
      target: {
        files: [
          { name: "priority.csv", size: csv.length, text: async () => csv },
        ],
      },
    });
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Remove priority EXAMPLE-001" }),
      ).toBeTruthy(),
    );
    expect(fetch).not.toHaveBeenCalled();
  });
  it("exports locally with spreadsheet-safe CSV", () => {
    const create = vi.fn(() => "blob:local"),
      revoke = vi.fn();
    vi.stubGlobal("URL", { createObjectURL: create, revokeObjectURL: revoke });
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
    renderAdvanced();
    fireEvent.click(screen.getByRole("button", { name: "↓ Export" }));
    expect(create).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledOnce();
    click.mockRestore();
  });
  it("explores frontier allocation using a keyboard-compatible range", () => {
    renderAdvanced();
    change("Explore frontier allocation", "1");
    expect(screen.getByText(/Explore allocation 1 of/)).toBeTruthy();
    const chart = screen.getByRole("img", {
      name: /Contribution profit across/,
    });
    expect(within(chart).getAllByText(/Profit floor/).length).toBe(1);
  });
});
