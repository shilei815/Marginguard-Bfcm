// @vitest-environment jsdom
import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within, waitFor } from "@testing-library/react";
import App from "./App";
import { download } from "./csv";
vi.mock("./csv", async () => ({
  ...(await vi.importActual<typeof import("./csv")>("./csv")),
  download: vi.fn(),
}));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
it("warns about rounded checkout offers next to Simple recommendations", () => {
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "Improve My Plan" }));
  const step = document.querySelector("#step-4")! as HTMLElement;
  expect(within(step).getByText(/Rounding checkout discounts can break minimum, maximum or exact offers/)).toBeTruthy();
  expect(within(step).getByText(/Re-enter the actual checkout discounts and check all warnings before launch/)).toBeTruthy();
});
it("keeps the same rounding disclosure visible alongside Advanced allocations", () => {
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "Advanced Mode" }));
  fireEvent.click(screen.getByRole("button", { name: "Optimize" }));
  expect(screen.getByText(/Rounding checkout discounts can break minimum, maximum or exact offers/)).toBeTruthy();
  expect(screen.getByText(/recommendations and CSV exports retain full precision/)).toBeTruthy();
});

it("retains the campaign across the structural-failure matrix, including unreadable and oversized files", async () => {
  render(<App />);
  const header = "SKU,Regular_Price_USD,Unit_COGS_USD,Inventory_Units,Expected_Units,Priority_Tier,Target_Discount,Min_Discount,Max_Discount,Planned_Discount,Exact_Discount";
  const row = "A,50,20,100,10,1,.3,.1,.4,.25,.25";
  const valid = header + "\n" + row;
  const upload = (text: string, name: string, size = text.length, unreadable = false) => fireEvent.change(screen.getByLabelText("Upload products CSV"), {
    target: { files: [{ name, size, text: async () => { if (unreadable) throw Error("Read failed"); return text; } }] },
  });
  upload(valid, "retained.csv");
  await waitFor(() => expect(screen.getByText("retained.csv")).toBeTruthy());
  fireEvent.click(screen.getByLabelText("Confirm all omitted cost inputs are zero or not applicable"));
  fireEvent.change(screen.getByLabelText("Minimum Profit to Keep (USD)"), { target: { value: "120" } });
  fireEvent.change(screen.getByLabelText("Additional Safety Buffer (USD)"), { target: { value: "5" } });
  const exportPlan = () => {
    fireEvent.click(screen.getByRole("button", { name: "Export plan & recommendations" }));
    return vi.mocked(download).mock.calls.at(-1)![1];
  };
  const before = exportPlan();
  const invalid = [
    valid.replace(",.1,.4,", ",.8,.4,"), // conflicting bounds
    valid.replace(",.25,.25", ",2,.25"), // invalid planned rate
    valid.replace("50,20", "50,NaN"), // invalid core financial number
    valid.replace("Expected_Units", "Unmapped_Units"), // missing mandatory column
    valid + "\n" + row, // duplicate product
    header + ",SKU\n" + row + ",B", // duplicate header
    valid + "\nA", // malformed record
    valid.replace(",.25,.25", ",.25,.8"), // exact above maximum
  ];
  for (const [i, text] of invalid.entries()) {
    upload(text, `invalid-${i}.csv`);
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    expect(exportPlan()).toBe(before);
    expect(screen.getByText("retained.csv")).toBeTruthy();
    expect(screen.getByLabelText("Promotion tier for A")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Cost Data Complete" })).toBeTruthy();
  }
  upload(valid, "oversized.csv", 5_000_001);
  await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("5 MB"));
  expect(exportPlan()).toBe(before);
  upload(valid, "unreadable.csv", valid.length, true);
  await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Read failed"));
  expect(exportPlan()).toBe(before);
});
it("renders imported HTML-looking product text without creating executable markup", async () => {
  render(<App />);
  const name = '<img src=x onerror=alert(1)>';
  const csv = "SKU,Product_Name,Regular_Price_USD,Unit_COGS_USD,Inventory_Units,Expected_Units\nA," + name + ",50,20,100,10";
  fireEvent.change(screen.getByLabelText("Upload products CSV"), { target: { files: [{ name: "text.csv", size: csv.length, text: async () => csv }] } });
  await waitFor(() => expect(screen.getByText("text.csv")).toBeTruthy());
  expect(document.body.textContent).toContain(name);
  expect(document.querySelector("img[src=x]")).toBeNull();
});
