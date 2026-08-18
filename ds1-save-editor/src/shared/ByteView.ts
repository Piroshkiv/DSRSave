/**
 * A `Uint8Array` that can also read and write multi-byte integers in place.
 *
 * Save records are dense structs of fixed-width fields, and spelling the shift
 * arithmetic out at every accessor is where offset bugs hide. `ByteView` keeps
 * that arithmetic in one place while staying a plain typed array — indexing,
 * `set`, `slice` and anything expecting a `Uint8Array` all still work.
 *
 * Sizes are given in bytes, so a field is described where it is used:
 *
 *     get quantity()      { return this.data.readInt(FIELD.quantity, 4); }
 *     set quantity(value) { this.data.write(FIELD.quantity, 4, value); }
 */
export class ByteView extends Uint8Array {
  /**
   * Wrap existing bytes without copying — writes go through to the original.
   * (Named `wrap` rather than `of`, which `Uint8Array` already defines.)
   */
  static wrap(bytes: Uint8Array): ByteView {
    return new ByteView(bytes.buffer as ArrayBuffer, bytes.byteOffset, bytes.byteLength);
  }

  private static checkSize(size: number): void {
    // 6 bytes is the widest value that still fits exactly in a JS number.
    if (!Number.isInteger(size) || size < 1 || size > 6) {
      throw new RangeError(`Unsupported field size: ${size}`);
    }
  }

  private checkRange(offset: number, size: number): void {
    if (offset < 0 || offset + size > this.length) {
      throw new RangeError(`Field at ${offset} (${size} bytes) is out of range`);
    }
  }

  /** Read `size` bytes little-endian as an unsigned integer. */
  readUInt(offset: number, size: number): number {
    ByteView.checkSize(size);
    this.checkRange(offset, size);
    // Multiplication rather than `<<`: shifting past bit 30 goes negative.
    let value = 0;
    for (let i = size - 1; i >= 0; i--) value = value * 256 + this[offset + i];
    return value;
  }

  /** Read `size` bytes little-endian as a two's-complement signed integer. */
  readInt(offset: number, size: number): number {
    const value = this.readUInt(offset, size);
    const signBit = 2 ** (size * 8 - 1);
    return value >= signBit ? value - signBit * 2 : value;
  }

  /** Write the low `size` bytes of `value` little-endian. */
  write(offset: number, size: number, value: number): void {
    ByteView.checkSize(size);
    this.checkRange(offset, size);
    let rest = Math.trunc(value);
    for (let i = 0; i < size; i++) {
      this[offset + i] = rest & 0xff;
      rest = Math.floor(rest / 256);
    }
  }

  /** Read `size` bytes big-endian as a two's-complement signed integer. */
  readIntBE(offset: number, size: number): number {
    ByteView.checkSize(size);
    this.checkRange(offset, size);
    let value = 0;
    for (let i = 0; i < size; i++) value = value * 256 + this[offset + i];
    const signBit = 2 ** (size * 8 - 1);
    return value >= signBit ? value - signBit * 2 : value;
  }

  /** Write the low `size` bytes of `value` big-endian. */
  writeBE(offset: number, size: number, value: number): void {
    ByteView.checkSize(size);
    this.checkRange(offset, size);
    let rest = Math.trunc(value);
    for (let i = size - 1; i >= 0; i--) {
      this[offset + i] = rest & 0xff;
      rest = Math.floor(rest / 256);
    }
  }
}
