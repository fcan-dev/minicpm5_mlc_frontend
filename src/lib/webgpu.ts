export function isWebGPUSupported(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.gpu !== "undefined";
}

export function isWasmSupported(): boolean {
  return typeof WebAssembly !== "undefined";
}
