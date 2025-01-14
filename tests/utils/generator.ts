import path from 'path';
import fs from 'fs/promises';
import { convertAnalysisToAssertions } from './openai';
import type { ElementAnalysis } from './openai';

export async function generateTestFromScreenshot(
  route: string,
  analysis: ElementAnalysis[]
): Promise<void> {
  const testDir = path.join(__dirname, '..', 'generated');
  await fs.mkdir(testDir, { recursive: true });

  const fileName = `${route.replace(/[^a-zA-Z0-9]/g, '_')}.spec.ts`;
  const filePath = path.join(testDir, fileName);

  const assertions = convertAnalysisToAssertions(analysis);
  const testContent = generateTestContent(route, assertions);

  await fs.writeFile(filePath, testContent);
  console.log(`Generated test file: ${filePath}`);
}

function generateTestContent(route: string, assertions: string[]): string {
  const normalizedRoute = route.replace(/^http:\/\/localhost:3000/, '');
  const testDescription = `Test suite for ${normalizedRoute || 'home page'}`;
  
  return `import { test, expect } from '@playwright/test';

// Ensure dev server is running
test.beforeAll(async () => {
  try {
    const response = await fetch('http://localhost:3000/');
    if (!response.ok) {
      throw new Error('Dev server is not responding');
    }
  } catch (error) {
    console.error('Dev server must be running: npm run dev');
    process.exit(1);
  }
});

test.describe('${testDescription}', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the page and wait for it to load
    await page.goto('http://localhost:3000${normalizedRoute}');
    await page.waitForLoadState('networkidle');
    
    // Basic viewport check
    await expect(page).toHaveScreenshot({ fullPage: true });
  });

  test('should load and display correctly', async ({ page }) => {
    // Verify page title and URL
    await expect(page).toHaveURL(new RegExp('${normalizedRoute.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$'));
    
    // Basic accessibility check
    await expect(page.locator('body')).toHaveAttribute('role', /.*/);
    
    ${assertions.map(line => line.replace(/page\.locator\("([^"]+)"\)/g, 'page.locator(\'$1\')')).join('\n    ')}
  });

  test('should be responsive', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page).toHaveScreenshot({ fullPage: true });
    
    // Test tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(page).toHaveScreenshot({ fullPage: true });
    
    // Test desktop viewport
    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(page).toHaveScreenshot({ fullPage: true });
  });

  test('should handle keyboard navigation', async ({ page }) => {
    // Test tab navigation
    await page.keyboard.press('Tab');
    const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
    expect(focusedElement).toBeTruthy();
    
    // Test basic keyboard shortcuts
    await page.keyboard.press('Escape');
    await page.keyboard.press('Enter');
  });

  test('should meet basic accessibility requirements', async ({ page }) => {
    // Check for ARIA landmarks
    await expect(page.locator('[role="main"]')).toBeVisible();
    await expect(page.locator('[role="navigation"]')).toBeVisible();
    
    // Check for image alt texts
    const images = await page.locator('img');
    const count = await images.count();
    for (let i = 0; i < count; i++) {
      await expect(images.nth(i)).toHaveAttribute('alt', /.*/);
    }
    
    // Check for proper heading structure
    await expect(page.locator('h1')).toBeVisible();
  });
});
`;
} 