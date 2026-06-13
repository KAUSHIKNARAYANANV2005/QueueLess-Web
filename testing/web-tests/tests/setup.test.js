import http from 'http';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { reportManager } from '../utils/reportManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let spawnedServerProcess = null;

function isServerRunning() {
  return new Promise((resolve) => {
    const req = http.request({
      host: 'localhost',
      port: 5173,
      method: 'GET',
      timeout: 1000
    }, (res) => {
      resolve(true);
    });
    req.on('error', () => {
      resolve(false);
    });
    req.end();
  });
}

before(async function() {
  this.timeout(20000); // Allow setup to take up to 20 seconds
  const running = await isServerRunning();
  if (!running) {
    const rootDir = path.resolve(__dirname, '../../../');
    console.log(`\n[TestSetup] Port 5173 is inactive. Auto-spawning Vite dev server at ${rootDir}...`);
    
    spawnedServerProcess = spawn('npm', ['run', 'dev'], {
      cwd: rootDir,
      shell: true
    });
    
    // Give it 5 seconds to boot up
    await new Promise(resolve => setTimeout(resolve, 5000));
    console.log('[TestSetup] Vite dev server spawned successfully. Starting E2E tests...\n');
  } else {
    console.log('\n[TestSetup] Vite dev server is already running on port 5173. Proceeding directly...\n');
  }
});

after(async function() {
  console.log('\n[MochaGlobal] Writing final E2E test report...');
  await reportManager.saveReport();
  
  if (spawnedServerProcess && spawnedServerProcess.pid) {
    console.log('[TestSetup] Stopping the auto-spawned Vite dev server...');
    const { exec } = await import('child_process');
    await new Promise((resolve) => {
      exec(`taskkill /pid ${spawnedServerProcess.pid} /t /f`, () => {
        resolve();
      });
    });
  }
});
