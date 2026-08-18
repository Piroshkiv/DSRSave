/**
 * Byte-buffer helpers that are not tied to a particular record.
 *
 * Multi-byte field access lives on {@link ByteView} instead, so a field can be
 * described as `data.readInt(offset, size)` where it is used.
 */

/**
 * Detach a `Uint8Array` view into a standalone `ArrayBuffer`.
 *
 * Web Crypto and `Blob` reject `SharedArrayBuffer` and silently read the whole
 * backing store when handed a subarray, so views that do not span their buffer
 * exactly are copied.
 */
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
