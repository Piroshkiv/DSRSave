import { AES_KEY } from './constants';
import { toArrayBuffer } from './bufferUtils';

/**
 * Decrypt data using AES-256-CBC with provided IV
 * Based on DS3SaveEditor.cs DecryptAesCbc method
 */
export async function decryptAesCbc(
  encryptedData: Uint8Array,
  iv: Uint8Array
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    toArrayBuffer(AES_KEY),
    { name: 'AES-CBC', length: 128 },
    false,
    ['decrypt']
  );

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-CBC', iv: toArrayBuffer(iv) },
    key,
    toArrayBuffer(encryptedData)
  );

  return new Uint8Array(decrypted);
}

/**
 * Encrypt data using AES-256-CBC with provided IV
 * Based on DS3SaveEditor.cs EncryptAesCbc method
 */
export async function encryptAesCbc(
  plainData: Uint8Array,
  iv: Uint8Array
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    toArrayBuffer(AES_KEY),
    { name: 'AES-CBC', length: 128 },
    false,
    ['encrypt']
  );

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-CBC', iv: toArrayBuffer(iv) },
    key,
    toArrayBuffer(plainData)
  );

  return new Uint8Array(encrypted);
}

/**
 * Calculate MD5 hash of data
 * Note: Web Crypto API doesn't support MD5, so we need a fallback
 */
export async function calculateMD5(data: Uint8Array): Promise<Uint8Array> {
  // We'll use a simple MD5 implementation
  // This is based on the reference implementation
  return md5(data);
}

// MD5 implementation (simplified)
// Based on RFC 1321
function md5(data: Uint8Array): Uint8Array {
  const s = [
    7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
    5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
    4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
    6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21
  ];

  const K = [
    0xd76aa478, 0xe8c7b756, 0x242070db, 0xc1bdceee,
    0xf57c0faf, 0x4787c62a, 0xa8304613, 0xfd469501,
    0x698098d8, 0x8b44f7af, 0xffff5bb1, 0x895cd7be,
    0x6b901122, 0xfd987193, 0xa679438e, 0x49b40821,
    0xf61e2562, 0xc040b340, 0x265e5a51, 0xe9b6c7aa,
    0xd62f105d, 0x02441453, 0xd8a1e681, 0xe7d3fbc8,
    0x21e1cde6, 0xc33707d6, 0xf4d50d87, 0x455a14ed,
    0xa9e3e905, 0xfcefa3f8, 0x676f02d9, 0x8d2a4c8a,
    0xfffa3942, 0x8771f681, 0x6d9d6122, 0xfde5380c,
    0xa4beea44, 0x4bdecfa9, 0xf6bb4b60, 0xbebfbc70,
    0x289b7ec6, 0xeaa127fa, 0xd4ef3085, 0x04881d05,
    0xd9d4d039, 0xe6db99e5, 0x1fa27cf8, 0xc4ac5665,
    0xf4292244, 0x432aff97, 0xab9423a7, 0xfc93a039,
    0x655b59c3, 0x8f0ccc92, 0xffeff47d, 0x85845dd1,
    0x6fa87e4f, 0xfe2ce6e0, 0xa3014314, 0x4e0811a1,
    0xf7537e82, 0xbd3af235, 0x2ad7d2bb, 0xeb86d391
  ];

  let a0 = 0x67452301;
  let b0 = 0xefcdab89;
  let c0 = 0x98badcfe;
  let d0 = 0x10325476;

  // Padding
  const msgLen = data.length;
  const bitLen = msgLen * 8;
  const paddingLen = (msgLen % 64 < 56) ? (56 - msgLen % 64) : (120 - msgLen % 64);
  const padded = new Uint8Array(msgLen + paddingLen + 8);
  padded.set(data);
  padded[msgLen] = 0x80;

  // Append length in bits (little-endian)
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 8, bitLen >>> 0, true);
  view.setUint32(padded.length - 4, (bitLen / 0x100000000) >>> 0, true);

  // Process chunks
  for (let offset = 0; offset < padded.length; offset += 64) {
    const M = new Uint32Array(16);
    for (let i = 0; i < 16; i++) {
      M[i] = view.getUint32(offset + i * 4, true);
    }

    let A = a0, B = b0, C = c0, D = d0;

    for (let i = 0; i < 64; i++) {
      let F, g;
      if (i < 16) {
        F = (B & C) | (~B & D);
        g = i;
      } else if (i < 32) {
        F = (D & B) | (~D & C);
        g = (5 * i + 1) % 16;
      } else if (i < 48) {
        F = B ^ C ^ D;
        g = (3 * i + 5) % 16;
      } else {
        F = C ^ (B | ~D);
        g = (7 * i) % 16;
      }

      F = (F + A + K[i] + M[g]) >>> 0;
      A = D;
      D = C;
      C = B;
      B = (B + ((F << s[i]) | (F >>> (32 - s[i])))) >>> 0;
    }

    a0 = (a0 + A) >>> 0;
    b0 = (b0 + B) >>> 0;
    c0 = (c0 + C) >>> 0;
    d0 = (d0 + D) >>> 0;
  }

  // Convert to bytes (little-endian)
  const result = new Uint8Array(16);
  const resultView = new DataView(result.buffer);
  resultView.setUint32(0, a0, true);
  resultView.setUint32(4, b0, true);
  resultView.setUint32(8, c0, true);
  resultView.setUint32(12, d0, true);

  return result;
}
