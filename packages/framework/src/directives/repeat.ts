import { keyed, type KeyedTemplate, type TemplateResult } from '../template/html.js';

export function repeat<T>(
  iterable: Iterable<T>,
  keyFn: (item: T, index: number) => unknown,
  render: (item: T, index: number) => TemplateResult
): KeyedTemplate[] {
  const keyedResults: KeyedTemplate[] = [];
  let index = 0;
  for (const item of iterable) {
    const key = keyFn(item, index);
    const template = render(item, index);
    keyedResults.push(keyed(key, template));
    index += 1;
  }
  return keyedResults;
}
