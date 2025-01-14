import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import fs from 'fs/promises';
import path from 'path';

export async function compareScreenshots(
  baselinePath: string,
  currentPath: string,
  diffPath: string
): Promise<{ diffPixels: number; diffPercentage: number }> {
  const baseline = PNG.sync.read(await fs.readFile(baselinePath));
  const current = PNG.sync.read(await fs.readFile(currentPath));
  const { width, height } = baseline;
  const diff = new PNG({ width, height });
  
  const diffPixels = pixelmatch(
    baseline.data,
    current.data,
    diff.data,
    width,
    height,
    { threshold: 0.1 }
  );
  
  await fs.writeFile(diffPath, PNG.sync.write(diff));
  
  return {
    diffPixels,
    diffPercentage: (diffPixels / (width * height)) * 100
  };
}

export async function saveScreenshot(
  screenshotBuffer: Buffer,
  routeName: string,
  viewport: string
): Promise<string> {
  const screenshotsDir = path.join(__dirname, '../screenshots');
  await fs.mkdir(screenshotsDir, { recursive: true });
  
  const filename = `${routeName.replace(/\//g, '_')}_${viewport}.png`;
  const filepath = path.join(screenshotsDir, filename);
  
  await fs.writeFile(filepath, screenshotBuffer);
  return filepath;
} 