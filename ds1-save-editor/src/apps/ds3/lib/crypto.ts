import { AES_KEY } from './constants';
import { toArrayBuffer } from '../../../shared/binary';

export { calculateMD5 } from '../../../shared/md5';

/**
 * Decrypt data using AES-CBC with the DS3 key and the provided IV.
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
 * Encrypt data using AES-CBC with the DS3 key and the provided IV.
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
