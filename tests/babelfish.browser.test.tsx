import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import React from "react";
import { createRoot } from "react-dom/client";
import { Babelfish } from "../app/components/Babelfish";

// Poll for an element instead of relying on render timing.
const waitForElement = async (selector: string, timeout = 3000): Promise<Element | null> => {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    const element = document.querySelector(selector);
    if (element) return element;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return null;
};

describe("Babelfish component", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    // The component fetches GET /scenarios on mount — serve a fixed list.
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({ scenarios: [{ slug: "demo", name: "Demo", version: "1" }] }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          ),
      ),
    );
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    root.unmount();
    container.remove();
    vi.unstubAllGlobals();
  });

  test("renders title, scenario picker, and a disabled Connect button", async () => {
    root.render(<Babelfish />);

    const heading = await waitForElement("h1");
    expect(heading?.textContent).toBe("Babelfish");

    // The fetched scenario appears in the picker.
    const option = await waitForElement("option[value='demo']");
    expect(option?.textContent).toContain("Demo");

    // Connect stays disabled until a scenario is chosen.
    const button = document.querySelector("button");
    expect(button?.textContent).toBe("Connect");
    expect(button?.disabled).toBe(true);
  });
});
