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
      rollupTypes: false,
    }),
  ],
  resolve: {
    alias: { "~": path.resolve(dirname, "src") },
  },
  build: {
    lib: {
      entry: {
        counter: path.resolve(dirname, "src/counter.ts"),
        list: path.resolve(dirname, "src/list.ts"),
        "todo-list": path.resolve(dirname, "src/todo-list.ts"),
        "data-table": path.resolve(dirname, "src/data-table.ts"),
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
    },
  },
});
