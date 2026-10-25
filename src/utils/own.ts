/**
 * @packageDocumentation
 *
 * Looking a word up in a table written as an object literal. A plain object
 * inherits from `Object.prototype`, so `table['constructor']` or
 * `table['toString']` finds a built-in function the table never listed, and
 * `table['__proto__']` finds the prototype itself. For anything typed by a
 * person (a pantry word, a unit) that is a bug waiting to happen.
 */

/**
 * The value `table` lists for `key`, or `undefined` when it does not list it
 * itself. Names that only exist because every object inherits them
 * (`constructor`, `toString`, `__proto__`…) count as not listed.
 */
export function own<Value>(
  table: Readonly<Record<string, Value>>,
  key: string,
): Value | undefined {
  return Object.hasOwn(table, key) ? table[key] : undefined;
}
