import { setRuntime } from "@vanishing/framework/runtime";
import { solidRuntime } from "./runtime/solid-runtime.js";

// Configure the global runtime
setRuntime(solidRuntime);

// Now import and register components (using dynamic imports to ensure runtime is set first)
await import("@demo/components/counter");
await import("@demo/components/list");
