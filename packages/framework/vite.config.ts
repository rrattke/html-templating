import { defineConfig } from "vite";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import checker from "vite-plugin-checker";
import dts from "vite-plugin-dts";

const dirname = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  plugins: [
    checker({ typescript: true, enableBuild: false }),
    dts({
      tsconfigPath: path.resolve(dirname, "tsconfig.json"),
      outDir: "lib",
      insertTypesEntry: true,
      exclude: ["**/*.spec.ts", "**/*.test.ts"],
      rollupTypes: false,
    }),
  ],
  resolve: {
    alias: { "~": path.resolve(dirname, "src") },
  },
  build: {
    lib: {
      entry: {
        index: path.resolve(dirname, "src/index.ts"),
        reactive: path.resolve(dirname, "src/reactive.ts"),
        runtime: path.resolve(dirname, "src/runtime.ts"),
        template: path.resolve(dirname, "src/template.ts"),
        wc: path.resolve(dirname, "src/wc.ts"),
      },
      formats: ["es"],
      fileName: (_, entryName) => `${entryName}.js`,
    },
    outDir: "lib",
    emptyOutDir: true,
    sourcemap: true,
    target: "es2024",
    rolldownOptions: {
      external: (id) => !(id.startsWith(".") || id.startsWith("~") || path.isAbsolute(id)),
      output: {
        preserveModules: true,
        preserveModulesRoot: "src",
        entryFileNames: "[name].js",
      },
    },
  },
});
