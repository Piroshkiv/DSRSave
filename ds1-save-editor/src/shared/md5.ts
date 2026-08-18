import { md5 } from 'js-md5';

/**
 * MD5 over raw bytes, returned as 16 bytes.
 *
 * Both save formats checksum with MD5 — DS1 over the slot ciphertext, DS3 over
 * IV + ciphertext — and each editor used to carry its own implementation: DS1
 * delegated to `js-md5`, DS3 hand-rolled RFC 1321 in ~95 lines. The two were
 * verified byte-identical (RFC 1321 vectors, every padding boundary, and large
 * random buffers) before being collapsed into this one.
 *
 * Web Crypto cannot help here: `crypto.subtle` deliberately omits MD5.
 */
export async function calculateMD5(data: Uint8Array): Promise<Uint8Array> {
  const hash = md5.create();
  hash.update(data);
  return new Uint8Array(hash.array());
}
