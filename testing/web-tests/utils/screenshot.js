import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function takeScreenshot(driver, testId) {
  try {
    const screenshotsDir = path.resolve(__dirname, '../reports/screenshots');
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }

    const screenshotData = await driver.takeScreenshot();
    const fileName = `${testId}_${Date.now()}.png`;
    const filePath = path.join(screenshotsDir, fileName);
    
    fs.writeFileSync(filePath, screenshotData, 'base64');
    
    // Return path relative to the reports folder or web-tests directory for portable viewing
    return path.join('screenshots', fileName);
  } catch (err) {
    console.error(`Failed to take screenshot for test ${testId}:`, err.message);
    return null;
  }
}
