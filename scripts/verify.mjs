#!/usr/bin/env node
// `npm run verify`: type-check and lint, run CONCURRENTLY — they are
// independent. Same script as HHjsFrontEnd's, which also has a test gate.
// Each gate's output is buffered and printed whole so logs don't interleave;
// a passing gate prints only its tail. Exits non-zero if any gate fails.
//
//   node scripts/verify.mjs              all gates
//   node scripts/verify.mjs typecheck lint   just those
//   VERIFY_VERBOSE=1 ...                 full output for passing gates too
import { spawn } from 'node:child_process';

const GATES = {
  // `-b`, not `--noEmit`: the root tsconfig is references-only, so a
  // non-build invocation checks nothing at all.
  typecheck: 'tsc -b --force',
  lint: 'eslint .',
};

const only = process.argv.slice(2);
const unknown = only.filter((name) => !(name in GATES));
if (unknown.length) {
  console.error(`verify: unknown gate(s) ${unknown.join(', ')}; known: ${Object.keys(GATES).join(', ')}`);
  process.exit(2);
}
const selected = Object.entries(GATES).filter(([name]) => only.length === 0 || only.includes(name));

function run([name, cmd]) {
  return new Promise((resolve) => {
    const started = Date.now();
    const child = spawn(`npx --no-install ${cmd}`, { shell: true });
    let out = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (out += d));
    child.on('close', (code) =>
      resolve({ name, cmd, code, out, secs: Math.round((Date.now() - started) / 1000) })
    );
  });
}

const results = await Promise.all(selected.map(run));

for (const r of results) {
  const ok = r.code === 0;
  console.log(`\n===== ${r.name} (${r.cmd}): ${ok ? 'passed' : `FAILED, exit ${r.code}`} in ${r.secs}s =====`);
  const text = ok && !process.env.VERIFY_VERBOSE ? r.out.trimEnd().split('\n').slice(-6).join('\n') : r.out;
  if (text.trim()) console.log(text.trimEnd());
}

const failed = results.filter((r) => r.code !== 0).map((r) => r.name);
console.log(`\nverify: ${failed.length ? `FAILED: ${failed.join(', ')}` : 'all gates passed'}`);
process.exit(failed.length ? 1 : 0);
