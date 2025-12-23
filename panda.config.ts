import { defineConfig } from "@pandacss/dev";
import chakraPreset from "@chakra-ui/panda-preset";

export default defineConfig({
  // Use Chakra UI preset for design tokens and recipes
  presets: [chakraPreset],

  // Whether to use css reset
  preflight: true,

  // Where to look for your css declarations
  include: ["./src/**/*.{js,jsx,ts,tsx}"],

  // Files to exclude
  exclude: [],

  // The output directory for your css system
  outdir: "styled-system",

  // Enable JSX support
  jsxFramework: "react",
});
