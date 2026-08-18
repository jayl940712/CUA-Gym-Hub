#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { secureMockApiPlugin } from './secureMockApiPlugin.mjs';

const sharedDir = path.dirname(fileURLToPath(import.meta.url));
const websitesDir = path.join(sharedDir, '..', 'websites');
const viteConfigs = fs.readdirSync(websitesDir)
  .flatMap((name) => [
    path.join(websitesDir, name, 'vite.config.js'),
    path.join(websitesDir, name, 'vite.config.ts'),
  ])
  .filter((file) => fs.existsSync(file));
const missingSharedReset = viteConfigs.filter(
  (file) => !fs.readFileSync(file, 'utf-8').includes('secureMockApiPlugin()'),
);
assert.equal(missingSharedReset.length, 0, `legacy reset plugin missing from: ${missingSharedReset.join(', ')}`);

const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cua-legacy-reset-'));
const stateDir = path.join(rootDir, '.mock-states');
const secureStateDir = path.join(rootDir, '.mock-secure-states');
fs.mkdirSync(stateDir, { recursive: true });

const oldHardened = process.env.CUA_GYM_HARDENED;
delete process.env.CUA_GYM_HARDENED;

let middleware;
const plugin = secureMockApiPlugin({
  stateDir: secureStateDir,
  legacyRootDir: rootDir,
  legacyStateDir: stateDir,
});
plugin.configureServer({
  middlewares: {
    use(handler) {
      middleware = handler;
    },
  },
});

function downstream(req, res) {
  const chunks = [];
  req.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
  req.on('end', () => {
    const payload = JSON.parse(Buffer.concat(chunks).toString('utf-8'));
    if (payload.fail) {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: 'rejected' }));
      return;
    }
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ success: true, action: payload.action }));
  });
}

const server = http.createServer((req, res) => middleware(req, res, () => downstream(req, res)));
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const { port } = server.address();

async function post(sid, payload) {
  const suffix = sid === null ? '' : `?sid=${encodeURIComponent(sid)}`;
  return fetch(`http://127.0.0.1:${port}/post${suffix}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

function write(file, value = '{}') {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, value);
}

try {
  const sid = 'episode_42';
  const namedFiles = [
    path.join(stateDir, `${sid}.json`),
    path.join(stateDir, `${sid}.initial.json`),
    path.join(stateDir, `${sid}_initial.json`),
    path.join(stateDir, `${sid}.revision`),
  ];
  for (const file of namedFiles) write(file);
  const upload = path.join(rootDir, '.mock-files', sid, 'fixture.txt');
  write(upload, 'keep');

  const resetResponse = await post(sid, { action: 'reset' });
  assert.equal(resetResponse.status, 200);
  for (const file of namedFiles) assert.equal(fs.existsSync(file), false, `${file} survived reset`);
  assert.equal(fs.readFileSync(upload, 'utf-8'), 'keep', 'reset removed a session upload');

  const defaultFiles = [
    path.join(rootDir, '.mock-state.json'),
    path.join(rootDir, '.mock-state.initial.json'),
    path.join(rootDir, '.mock-state.revision'),
    path.join(stateDir, 'default.json'),
    path.join(stateDir, 'default.initial.json'),
    path.join(stateDir, 'default_initial.json'),
    path.join(stateDir, 'default.revision'),
  ];
  for (const file of defaultFiles) write(file);
  assert.equal((await post(null, { action: 'reset' })).status, 200);
  for (const file of defaultFiles) assert.equal(fs.existsSync(file), false, `${file} survived reset`);

  const preserved = path.join(stateDir, 'preserved.json');
  write(preserved);
  assert.equal((await post('preserved', { action: 'set_current', state: {} })).status, 200);
  assert.equal(fs.existsSync(preserved), true, 'non-reset request deleted state');
  assert.equal((await post('preserved', { action: 'reset', fail: true })).status, 400);
  assert.equal(fs.existsSync(preserved), true, 'failed reset deleted state');

  console.log(`PASS legacy reset deletes current, baseline, and revision state across ${viteConfigs.length} mocks`);
} finally {
  await new Promise((resolve) => server.close(resolve));
  fs.rmSync(rootDir, { recursive: true, force: true });
  if (oldHardened === undefined) delete process.env.CUA_GYM_HARDENED;
  else process.env.CUA_GYM_HARDENED = oldHardened;
}
