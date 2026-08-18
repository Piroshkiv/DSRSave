import { describe, it, expect } from 'vitest';
import {
  decryptAesCbc as ds1Decrypt,
  encryptAesCbc as ds1Encrypt,
  calculateMD5 as ds1MD5,
} from '../src/apps/ds1/lib/crypto';
import {
  decryptAesCbc as ds3Decrypt,
  encryptAesCbc as ds3Encrypt,
  calculateMD5 as ds3MD5,
} from '../src/apps/ds3/lib/crypto';
import { AES_KEY as DS1_AES_KEY } from '../src/apps/ds1/lib/constants';
import { AES_KEY as DS3_AES_KEY } from '../src/apps/ds3/lib/constants';

const toHex = (b: Uint8Array) =>
  Array.from(b)
    .map((x) => x.toString(16).padStart(2, '0'))
    .join('');

const enc = (s: string) => new TextEncoder().encode(s);

/** RFC 1321, appendix A.5 test suite. */
const MD5_VECTORS: Array<[string, string]> = [
  ['', 'd41d8cd98f00b204e9800998ecf8427e'],
  ['a', '0cc175b9c0f1b6a831c399e269772661'],
  ['abc', '900150983cd24fb0d6963f7d28e17f72'],
  ['message digest', 'f96b697d7cb7938d525a2f31aaf161d0'],
  ['abcdefghijklmnopqrstuvwxyz', 'c3fcd3d76192e4007dfb496cca67e13b'],
  [
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
    'd174ab98d277d9f5a5611c2c9f419d9f',
  ],
  [
    '12345678901234567890123456789012345678901234567890123456789012345678901234567890',
    '57edf4a22be3c955ac49da2e2107b67a',
  ],
];

describe('MD5', () => {
  // DS1 used to delegate to js-md5 while DS3 carried its own hand-rolled
  // RFC 1321 implementation. These tests established that the two were
  // byte-identical, which is what allowed them to be collapsed into
  // src/shared/md5.ts; both games now re-export that single function.
  it('both games expose the same implementation', () => {
    expect(ds3MD5).toBe(ds1MD5);
  });

  it.each(MD5_VECTORS)('hashes %j correctly', async (input, expected) => {
    expect(toHex(await ds1MD5(enc(input)))).toBe(expected);
  });

  it('produces 16 bytes', async () => {
    expect((await ds1MD5(enc('anything'))).length).toBe(16);
  });

  it('handles every padding boundary', async () => {
    // Padding is the classic source of MD5 bugs: these are the lengths where
    // the message needs an extra 64-byte block. Checked against Node's own
    // MD5 so the assertion is independent of the implementation under test.
    const { createHash } = await import('node:crypto');
    for (const len of [0, 1, 55, 56, 57, 63, 64, 65, 119, 120, 121, 1000]) {
      const data = new Uint8Array(len).map((_, i) => (i * 37) & 0xff);
      const expected = createHash('md5').update(data).digest('hex');
      expect(toHex(await ds1MD5(data)), `length ${len}`).toBe(expected);
    }
  });

  it('matches Node on a large random buffer', async () => {
    const { createHash } = await import('node:crypto');
    // getRandomValues caps at 65536 bytes per call, so fill in chunks.
    const data = new Uint8Array(100_000);
    for (let i = 0; i < data.length; i += 32_768) {
      crypto.getRandomValues(data.subarray(i, Math.min(i + 32_768, data.length)));
    }
    expect(toHex(await ds1MD5(data))).toBe(createHash('md5').update(data).digest('hex'));
  });
});

describe('AES-CBC', () => {
  const iv = new Uint8Array(16).map((_, i) => i);

  it('ds1 round-trips a block-aligned payload', async () => {
    const plain = new Uint8Array(64).map((_, i) => (i * 7) & 0xff);
    const cipher = await ds1Encrypt(plain, DS1_AES_KEY, iv);
    // Web Crypto always appends a full padding block for aligned input.
    expect(cipher.length).toBe(plain.length + 16);
    const back = await ds1Decrypt(cipher, DS1_AES_KEY, iv);
    expect(Array.from(back)).toEqual(Array.from(plain));
  });

  it('ds3 round-trips a block-aligned payload', async () => {
    const plain = new Uint8Array(64).map((_, i) => (i * 11) & 0xff);
    const cipher = await ds3Encrypt(plain, iv);
    const back = await ds3Decrypt(cipher, iv);
    expect(Array.from(back)).toEqual(Array.from(plain));
  });

  it('the two games use different keys', () => {
    expect(Array.from(DS1_AES_KEY)).not.toEqual(Array.from(DS3_AES_KEY));
  });

  it('DS1 key is the documented 16-byte constant', () => {
    expect(DS1_AES_KEY.length).toBe(16);
    expect(toHex(DS1_AES_KEY)).toBe('0123456789abcdeffedcba9876543210');
  });

  it('a wrong IV corrupts exactly the first block and leaves the rest intact', async () => {
    // CBC property the save format relies on: the IV stored per slot only
    // affects block 0, so an IV mix-up is silent corruption, not a hard error.
    const plain = new Uint8Array(64).map((_, i) => (i * 3) & 0xff);
    const cipher = await ds3Encrypt(plain, iv);
    const otherIv = new Uint8Array(16).fill(0xaa);
    const back = await ds3Decrypt(cipher, otherIv);

    expect(Array.from(back.slice(0, 16))).not.toEqual(Array.from(plain.slice(0, 16)));
    expect(Array.from(back.slice(16))).toEqual(Array.from(plain.slice(16)));
  });

  it('rejects a ciphertext that is not block-aligned', async () => {
    await expect(ds3Decrypt(new Uint8Array(20), iv)).rejects.toThrow();
  });
});
