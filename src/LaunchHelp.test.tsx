// @vitest-environment jsdom
import React from "react";
import { afterEach, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import App from "./App";
import { feedbackHref } from "./LaunchHelp";
afterEach(cleanup);
it("exposes the demo, native help and unconfigured feedback in both modes", () => {
  render(<App />);
  expect(screen.getByText(/A fictional demo is already loaded/)).toBeTruthy();
  const checkHelp = () => {
    expect(document.querySelectorAll('.launch-help details > summary')).toHaveLength(5);
    expect(screen.getByText(/does not represent final net profit/)).toBeTruthy();
    expect(screen.getByText(/not stored between page refreshes/)).toBeTruthy();
    expect(screen.getByText(/Send Feedback — coming soon/)).toBeTruthy();
    expect(document.querySelector('a[href^="mailto:"]')).toBeNull();
  };
  checkHelp();
  fireEvent.click(screen.getByRole("button", {name:"Advanced Mode"}));
  checkHelp();
});
it("only enables a configured email and encodes the subject", () => {
  for (const email of [null, "", "placeholder", "test@example.com", "a@demo.invalid", "a@demo.test", "a@b.com?subject=fake", "a@b.com\nBcc:x@y.com"])
    expect(feedbackHref(email)).toBeNull();
  expect(feedbackHref("feedback@merchant.dev")).toBe("mailto:feedback@merchant.dev?subject=MarginGuard%20beta%20feedback");
});
