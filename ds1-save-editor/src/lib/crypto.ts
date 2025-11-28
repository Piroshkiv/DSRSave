import md5 from 'js-md5';

export async function decryptAesCbc(
  cipherData: Uint8Array,
  key: Uint8Array,
  iv: Uint8Array
): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'AES-CBC' },
    false,
    ['decrypt']
  );

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-CBC', iv },
    cryptoKey,
    cipherData
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
    key,
    { name: 'AES-CBC' },
    false,
    ['encrypt']
  );

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-CBC', iv },
    cryptoKey,
    plainData
  );

  return new Uint8Array(encrypted);
}

export async function calculateMD5(data: Uint8Array): Promise<Uint8Array> {
  // Use js-md5 library for correct MD5 calculation
  const hash = md5.create();
  hash.update(data);
  const hashArray = hash.array();
  return new Uint8Array(hashArray);
}
