import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const child = spawn(process.execPath, ['--test', 'integration/system.test.js'], {
  cwd: fileURLToPath(new URL('../', import.meta.url)),
  env: { ...process.env, RUN_QA_INTEGRATION: '1' },
  windowsHide: true,
  stdio: 'inherit'
});
child.on('error', (error) => { console.error(error.message); process.exitCode = 1; });
child.on('exit', (code) => { process.exitCode = code ?? 1; });
