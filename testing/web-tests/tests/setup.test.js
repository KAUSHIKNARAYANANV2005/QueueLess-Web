import http from 'http';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { reportManager } from '../utils/reportManager.js';
import { createDriver } from '../utils/driver.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let spawnedServerProcess = null;
global.sharedDriver = null;

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
  this.timeout(40000); // Set higher timeout for global startup
  
  // 1. Check/Start Vite dev server
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
    console.log('[TestSetup] Vite dev server spawned successfully.');
  } else {
    console.log('\n[TestSetup] Vite dev server is already running on port 5173.');
  }

  // 2. Initialize shared driver instance
  console.log('[TestSetup] Initializing shared WebDriver instance...');
  global.sharedDriver = await createDriver();
  console.log('[TestSetup] Shared WebDriver initialized. Starting E2E tests...\n');
});

after(async function() {
  console.log('\n[MochaGlobal] Writing final E2E test report...');
  await reportManager.saveReport();
  
  // 1. Quit the shared driver instance
  if (global.sharedDriver) {
    console.log('[TestSetup] Quitting shared WebDriver instance...');
    try {
      await global.sharedDriver.quit();
    } catch (err) {
      console.error('[TestSetup] Error quitting shared WebDriver:', err.message);
    }
    global.sharedDriver = null;
  }
  
  // 2. Stop server if spawned
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
