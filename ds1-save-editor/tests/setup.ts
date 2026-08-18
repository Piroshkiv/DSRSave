import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const testsDir = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(testsDir, '..', 'public');

/**
 * The Inventory classes load their item databases with `fetch('/json/…json')`,
 * which has no meaning in Node. Serve those paths off the real `public/`
 * directory so the production code path is exercised verbatim — no mocking of
 * the parsing logic itself, only of the transport.
 */
const originalFetch = globalThis.fetch;

globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

  if (url.includes('/json/') || url.startsWith('./json/') || url.startsWith('json/')) {
    const fileName = url.split('/json/').pop() ?? url.replace(/^\.?\/?/, '');
    const filePath = path.join(publicDir, 'json', fileName);
    try {
      const body = await readFile(filePath, 'utf8');
      return new Response(body, {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    } catch {
      return new Response('not found', { status: 404, statusText: 'Not Found' });
    }
  }

  if (originalFetch) return originalFetch(input as never, init);
  throw new Error(`Unexpected fetch in tests: ${url}`);
}) as typeof fetch;

// The save-file core is chatty (pattern hits, bonfire dumps, DB load messages).
// Keep warn/error so genuine problems still surface.
console.log = () => {};
