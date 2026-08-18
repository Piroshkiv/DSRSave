import { describe, it, expect } from 'vitest';
import { ByteView } from '../../src/shared/ByteView';

describe('ByteView basics', () => {
  it('is a Uint8Array, so indexing and set still work', () => {
    const view = new ByteView(4);
    expect(view).toBeInstanceOf(Uint8Array);
    view[1] = 0xab;
    expect(view[1]).toBe(0xab);
    view.set([1, 2], 2);
    expect(Array.from(view)).toEqual([0, 0xab, 1, 2]);
  });

  it('wraps existing bytes without copying', () => {
    const original = new Uint8Array([0, 0, 0, 0]);
    const view = ByteView.wrap(original);
    view.write(0, 4, 0x11223344);
    expect(Array.from(original)).toEqual([0x44, 0x33, 0x22, 0x11]);
  });

  it('wraps a subarray without touching its neighbours', () => {
    const original = new Uint8Array(8).fill(0xee);
    const view = ByteView.wrap(original.subarray(2, 6));
    view.write(0, 4, 0);
    expect(Array.from(original)).toEqual([0xee, 0xee, 0, 0, 0, 0, 0xee, 0xee]);
  });
});

describe('little-endian access', () => {
  it('round-trips at every supported width', () => {
    const view = new ByteView(8);
    for (const [size, value] of [
      [1, 0x7f],
      [2, 0x1234],
      [3, 0x123456],
      [4, 0x12345678],
    ] as const) {
      view.write(0, size, value);
      expect(view.readUInt(0, size), `size ${size}`).toBe(value);
    }
  });

  it('writes least significant byte first', () => {
    const view = new ByteView(4);
    view.write(0, 4, 0x12345678);
    expect(Array.from(view)).toEqual([0x78, 0x56, 0x34, 0x12]);
  });

  it('honours the offset and leaves neighbours alone', () => {
    const view = new ByteView(8).fill(0xaa);
    view.write(2, 4, 0);
    expect(Array.from(view)).toEqual([0xaa, 0xaa, 0, 0, 0, 0, 0xaa, 0xaa]);
  });

  it('truncates a value wider than the field', () => {
    const view = new ByteView(4);
    view.write(0, 4, 0x1_0000_00ff);
    expect(view.readUInt(0, 4)).toBe(0xff);
  });
});

describe('signed vs unsigned', () => {
  // DS1 slot fields have always read signed; DS3 reads unsigned. Both games
  // keep their own semantics, so both readings must be available and correct.
  it('reads the top bit as magnitude or as sign', () => {
    const view = new ByteView([0xff, 0xff, 0xff, 0xff]);
    expect(view.readUInt(0, 4)).toBe(0xffffffff);
    expect(view.readInt(0, 4)).toBe(-1);
  });

  it('agrees below the sign bit', () => {
    const view = new ByteView([0xff, 0xff, 0xff, 0x7f]);
    expect(view.readInt(0, 4)).toBe(view.readUInt(0, 4));
    expect(view.readInt(0, 4)).toBe(0x7fffffff);
  });

  it('sign-extends narrower fields too', () => {
    const view = new ByteView([0xff, 0xff, 0xff]);
    expect(view.readInt(0, 1)).toBe(-1);
    expect(view.readInt(0, 2)).toBe(-1);
    expect(view.readInt(0, 3)).toBe(-1);
    expect(view.readUInt(0, 3)).toBe(0xffffff);
  });

  it('round-trips a negative value', () => {
    const view = new ByteView(4);
    view.write(0, 4, -1);
    expect(view.readUInt(0, 4)).toBe(0xffffffff);
    expect(view.readInt(0, 4)).toBe(-1);
  });

  it('never returns a negative unsigned read past bit 30', () => {
    // The classic `a | b << 24` bug: shifting into the sign bit goes negative.
    const view = new ByteView([0x00, 0x00, 0x00, 0x80]);
    expect(view.readUInt(0, 4)).toBe(0x80000000);
  });
});

describe('big-endian access', () => {
  it('writes most significant byte first', () => {
    const view = new ByteView(4);
    view.writeBE(0, 4, 0x12345678);
    expect(Array.from(view)).toEqual([0x12, 0x34, 0x56, 0x78]);
  });

  it('round-trips', () => {
    const view = new ByteView(4);
    view.writeBE(0, 4, 0x00abcdef);
    expect(view.readIntBE(0, 4)).toBe(0x00abcdef);
  });

  it('is the byte-reverse of the little-endian layout', () => {
    const le = new ByteView(4);
    const be = new ByteView(4);
    le.write(0, 4, 0x11223344);
    be.writeBE(0, 4, 0x11223344);
    expect(Array.from(be)).toEqual(Array.from(le).reverse());
  });

  it('carries the DS1 item-type encoding, which stores the value shifted', () => {
    // DS1 keeps itemType big-endian and multiplied by 16.
    const view = new ByteView(4);
    view.writeBE(0, 4, 4 * 16);
    expect(Math.floor(view.readIntBE(0, 4) / 16)).toBe(4);
  });
});

describe('guards', () => {
  it('rejects an unsupported field size', () => {
    const view = new ByteView(8);
    expect(() => view.readUInt(0, 0)).toThrow(RangeError);
    expect(() => view.readUInt(0, 7)).toThrow(RangeError);
    expect(() => view.write(0, 1.5, 1)).toThrow(RangeError);
  });

  it('rejects a field that runs past the end', () => {
    const view = new ByteView(4);
    expect(() => view.readUInt(1, 4)).toThrow(/out of range/);
    expect(() => view.write(2, 4, 0)).toThrow(/out of range/);
    expect(() => view.readUInt(-1, 1)).toThrow(/out of range/);
  });
});
