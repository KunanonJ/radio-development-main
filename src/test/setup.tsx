import "@testing-library/jest-dom";
import React from "react";
import { vi } from "vitest";

vi.mock("next/image", () => ({
  default: ({
    src,
    alt,
    width,
    height,
    className,
    fill,
    priority: _p,
    sizes: _s,
    unoptimized: _u,
    ...rest
  }: {
    src: string;
    alt: string;
    width?: number;
    height?: number;
    className?: string;
    fill?: boolean;
    priority?: boolean;
    sizes?: string;
    unoptimized?: boolean;
  } & Record<string, unknown>) => {
    void _p;
    void _s;
    void _u;
    if (fill) {
      return React.createElement("img", {
        src,
        alt,
        className,
        "data-next-image-mock": "fill",
        ...rest,
      });
    }
    return React.createElement("img", {
      src,
      alt,
      width,
      height,
      className,
      ...rest,
    });
  },
}));

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});
