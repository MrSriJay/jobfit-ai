const runtime = globalThis as typeof globalThis & { Iterator?: new () => object };

if (typeof runtime.Iterator === "undefined") {
  runtime.Iterator = class Iterator {};
}
