/**
 * Web Crypto API based PBKDF2 / SHA-256 password hashing and validation
 * Avoids storing plaintext passwords; generates secure cryptographic salt
 */

export function generateSalt(length = 16): string {
  const array = new Uint8Array(length);
  window.crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function hashPassword(password: string, salt: string): Promise<string> {
  const enc = new TextEncoder();
  const passwordBuffer = enc.encode(password);
  const saltBuffer = enc.encode(salt);

  const importedKey = await window.crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );

  const derivedKey = await window.crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBuffer,
      iterations: 100000,
      hash: 'SHA-256',
    },
    importedKey,
    256
  );

  return Array.from(new Uint8Array(derivedKey), byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function verifyPassword(password: string, salt: string, expectedHash: string): Promise<boolean> {
  const computedHash = await hashPassword(password, salt);
  return computedHash === expectedHash;
}
