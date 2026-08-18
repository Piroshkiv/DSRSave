import { toArrayBuffer } from '../../../shared/binary';

export { calculateMD5 } from '../../../shared/md5';

export async function decryptAesCbc(
  cipherData: Uint8Array,
  key: Uint8Array,
  iv: Uint8Array
): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    toArrayBuffer(key),
    { name: 'AES-CBC' },
    false,
    ['decrypt']
  );

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-CBC', iv: toArrayBuffer(iv) },
    cryptoKey,
    toArrayBuffer(cipherData)
  );

  return new Uint8Array(decrypted);
}

export async function encryptAesCbc(
  plainData: Uint8Array,
  key: Uint8Array,
  iv: Uint8Array
): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    toArrayBuffer(key),
    { name: 'AES-CBC' },
    false,
    ['encrypt']
  );

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-CBC', iv: toArrayBuffer(iv) },
    cryptoKey,
    toArrayBuffer(plainData)
  );

  return new Uint8Array(encrypted);
}
