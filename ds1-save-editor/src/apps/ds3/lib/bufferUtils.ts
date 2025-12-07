export function toArrayBuffer(view: Uint8Array): ArrayBuffer {
  if (view.buffer instanceof ArrayBuffer) {
    const { byteOffset, byteLength, buffer } = view;
    if (byteOffset === 0 && byteLength === buffer.byteLength) {
      return buffer;
    }
    return buffer.slice(byteOffset, byteOffset + byteLength);
  }

  const copy = new Uint8Array(view.byteLength);
  copy.set(view);
  return copy.buffer;
}
