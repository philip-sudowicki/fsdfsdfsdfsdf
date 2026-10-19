// Runs every automated test in sequence and reports a summary.
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { root } from './harness.mjs';

const out = path.join(root, 'tools', 'test', 'shots');
const suites = ['fullshift.mjs', 'touch.mjs', 'garage.mjs', 'screens.mjs'];
let failed = 0;
for (const s of suites) {
  console.log(`\n=== ${s} ===`);
  const r = spawnSync(process.execPath, [path.join(root, 'tools', 'test', s), out], { stdio: 'inherit' });
  if (r.status !== 0) failed++;
}
console.log(failed ? `\n${failed} suite(s) failed` : '\nAll suites passed. Screenshots are in tools/test/shots/');
process.exit(failed ? 1 : 0);
