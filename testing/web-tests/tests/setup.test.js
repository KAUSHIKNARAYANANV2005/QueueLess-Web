import { reportManager } from '../utils/reportManager.js';

after(async function() {
  console.log('\n[MochaGlobal] Writing final E2E test report...');
  await reportManager.saveReport();
});
