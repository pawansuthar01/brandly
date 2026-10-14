import { createServer } from 'node:http';
import { defaultTheme } from '../src/modules/themes/theme-schema.js';

if (process.env.NODE_ENV === 'production') throw new Error('Local preview fixture cannot run in production');
// Read-only, memory-only browser fixture; no database or published theme is touched.
const server = createServer((request, response) => {
  response.setHeader('Access-Control-Allow-Origin', 'http://localhost:3001');
  response.setHeader('Access-Control-Allow-Headers', 'content-type,authorization');
  response.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  response.setHeader('Content-Type', 'application/json');
  if (request.method === 'OPTIONS') { response.end(); return; }
  const path = new URL(request.url ?? '/', 'http://localhost').pathname;
  if (path === '/v1/auth/admin/login' && request.method === 'POST') { response.end(JSON.stringify({ accessToken: 'local-preview-fixture', expiresIn: 3600, email: 'preview@local.test', role: 'Owner' })); return; }
  if (request.method !== 'GET') { response.statusCode = 405; response.end(JSON.stringify({ message: 'Read-only preview fixture: saving and publishing are disabled' })); return; }
  if (path === '/v1/app-themes/active') { response.end(JSON.stringify({ id: 'bundled-default-v1', name: defaultTheme.name, revision: 1, published: false, theme: defaultTheme })); return; }
  if (['/v1/admin/themes/drafts', '/v1/admin/themes/versions', '/v1/admin/themes/activations'].includes(path)) { response.end(JSON.stringify({ items: [], nextCursor: null })); return; }
  response.statusCode = 404; response.end(JSON.stringify({ message: 'Not part of the theme preview fixture' }));
});
server.listen(3000, '127.0.0.1', () => console.log('Read-only Theme Studio fixture: http://127.0.0.1:3000/v1'));
