import { expect, test, describe, beforeEach, afterEach } from "vitest";
import React from "react";
import { createRoot } from "react-dom/client";
import { Welcome } from "../app/welcome/welcome";

// Helper function to wait for elements
const waitForElement = async (selector: string, timeout = 3000): Promise<Element | null> => {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    const element = document.querySelector(selector);
    if (element) return element;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return null;
};

// Helper function to wait for multiple elements
const waitForElements = async (
  selector: string,
  count: number,
  timeout = 3000,
): Promise<boolean> => {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    const elements = document.querySelectorAll(selector);
    if (elements.length === count) return true;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return false;
};

describe("Welcome Component", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(async () => {
    // Create a container for the component
    container = document.createElement("div");
    container.id = "test-container";
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    // Clean up after each test
    root.unmount();
    container.remove();
  });

  test("should render the component with all elements", async () => {
    // Render the component
    root.render(<Welcome />);

    // Wait for the component to render
    const main = await waitForElement("main");
    expect(main).toBeTruthy();
    expect(main?.className).toContain("flex");
    expect(main?.className).toContain("items-center");
    expect(main?.className).toContain("justify-center");

    // Check header exists
    const header = document.querySelector("header");
    expect(header).toBeTruthy();
    expect(header?.className).toContain("flex");
    expect(header?.className).toContain("flex-col");
    expect(header?.className).toContain("items-center");
  });

  test("should render both light and dark mode logos", async () => {
    root.render(<Welcome />);

    await waitForElements("img", 2);

    const images = document.querySelectorAll("img");
    expect(images.length).toBe(2);

    // Check light mode logo
    const lightLogo = images[0] as HTMLImageElement;
    expect(lightLogo.alt).toBe("React Router");
    expect(lightLogo.className).toContain("block");
    expect(lightLogo.className).toContain("dark:hidden");
    expect(lightLogo.src).toContain("logo-light");

    // Check dark mode logo
    const darkLogo = images[1] as HTMLImageElement;
    expect(darkLogo.alt).toBe("React Router");
    expect(darkLogo.className).toContain("hidden");
    expect(darkLogo.className).toContain("dark:block");
    expect(darkLogo.src).toContain("logo-dark");
  });

  test("should render navigation with 'What's next?' text", async () => {
    root.render(<Welcome />);

    const nav = await waitForElement("nav");
    expect(nav).toBeTruthy();
    expect(nav?.className).toContain("rounded-3xl");
    expect(nav?.className).toContain("border");

    const paragraph = nav?.querySelector("p");
    expect(paragraph).toBeTruthy();
    expect(paragraph?.textContent).toBe("What's next?");
    expect(paragraph?.className).toContain("text-center");
  });

  test("should render resource links with correct attributes", async () => {
    root.render(<Welcome />);

    await waitForElements("a", 2);

    const links = document.querySelectorAll("a");
    expect(links.length).toBe(2);

    // Check React Router Docs link
    const docsLink = links[0] as HTMLAnchorElement;
    expect(docsLink.href).toBe("https://reactrouter.com/docs");
    expect(docsLink.textContent).toContain("React Router Docs");
    expect(docsLink.target).toBe("_blank");
    expect(docsLink.rel).toBe("noreferrer");
    expect(docsLink.className).toContain("group");
    expect(docsLink.className).toContain("flex");
    expect(docsLink.className).toContain("items-center");

    // Check Discord link
    const discordLink = links[1] as HTMLAnchorElement;
    expect(discordLink.href).toBe("https://rmx.as/discord");
    expect(discordLink.textContent).toContain("Join Discord");
    expect(discordLink.target).toBe("_blank");
    expect(discordLink.rel).toBe("noreferrer");
  });

  test("should render SVG icons for each resource link", async () => {
    root.render(<Welcome />);

    await waitForElements("svg", 2);

    const svgs = document.querySelectorAll("svg");
    expect(svgs.length).toBe(2);

    // Check that each link has an SVG icon
    const links = document.querySelectorAll("a");
    links.forEach((link) => {
      const svg = link.querySelector("svg");
      expect(svg).toBeTruthy();
      expect(svg?.getAttribute("width")).toBe("24");
      expect(svg?.getAttribute("viewBox")).toBeTruthy();
    });
  });

  test("should have correct dark mode classes", async () => {
    root.render(<Welcome />);

    const nav = await waitForElement("nav");
    expect(nav?.className).toContain("dark:border-gray-700");

    const paragraph = nav?.querySelector("p");
    expect(paragraph?.className).toContain("dark:text-gray-200");

    const links = document.querySelectorAll("a");
    links.forEach((link) => {
      expect(link.className).toContain("dark:text-blue-500");
    });

    const svgs = document.querySelectorAll("svg");
    svgs.forEach((svg) => {
      const classAttr = svg.getAttribute("class");
      expect(classAttr).toContain("dark:stroke-gray-300");
    });
  });

  test("should toggle logo visibility when dark mode class is applied", async () => {
    root.render(<Welcome />);

    await waitForElements("img", 2);

    // Add dark class to the root element
    document.documentElement.classList.add("dark");

    // Get the computed styles
    const images = document.querySelectorAll("img");
    const lightLogo = images[0] as HTMLImageElement;
    const darkLogo = images[1] as HTMLImageElement;

    // In browser mode, we check the classes that would control visibility
    expect(lightLogo.className).toContain("dark:hidden");
    expect(darkLogo.className).toContain("dark:block");

    // Remove dark class
    document.documentElement.classList.remove("dark");
  });

  test("should have correct hover styles on links", async () => {
    root.render(<Welcome />);

    await waitForElements("a", 2);

    const links = document.querySelectorAll("a");
    links.forEach((link) => {
      expect(link.className).toContain("hover:underline");

      // Check that SVGs have group-hover classes
      const svg = link.querySelector("svg");
      const classAttr = svg?.getAttribute("class");
      expect(classAttr).toContain("group-hover:stroke-current");
    });
  });
});
