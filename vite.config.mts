import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";
import ejs from 'vite-plugin-ejs';
import html from 'vite-plugin-html';
import staticFiles from 'vite-plugin-static';
import raw from 'vite-plugin-raw';
export default defineConfig({
  test: {
    coverage: {
      exclude: ["**/node_modules/**", "**/index.ts"],
    },
    globals: true,
    restoreMocks: true,
  },
  plugins: [
    tsconfigPaths(),
    ejs(), // For .ejs files
    html(), // For .html files (if needed)
    raw({
      fileRegex: /\.backup$/, // Treat .backup files as raw text
    }),
    staticFiles({ // For .backup files
      include: ['**/*.backup'],
    }),],
});
