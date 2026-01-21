import { setRuntime } from '@vanishing/framework/runtime';
import { nativeRuntime } from './runtime/native-runtime.js';

// Configure the global runtime
setRuntime(nativeRuntime);

// Now import and register components (using dynamic imports to ensure runtime is set first)
await import('@demo/components/counter');
await import('@demo/components/list');