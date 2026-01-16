import { StateDecorator } from '@vanishing/framework/wc';
import { createEffect, createSignal, createMemo, batch, untrack, onCleanup } from '@vanishing/framework/reactive';
import { TemplateBinding, type PartRuntime } from '@vanishing/framework/template';

// Define the native signal runtime
export const nativeRuntime: PartRuntime = {
  effect: run => createEffect(run),
  createSignal: initial => createSignal(initial),
  createMemo: fn => createMemo(fn),
  batch: fn => batch(fn),
  untrack: fn => untrack(fn),
  onCleanup: fn => onCleanup(fn)
};

export const html = TemplateBinding.with(nativeRuntime);
export const state = StateDecorator.with(nativeRuntime);