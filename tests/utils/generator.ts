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
  const pageName = normalizedRoute.replace(/[^a-zA-Z0-9]/g, '-') || 'home';
  
  return `import { test, expect } from '@playwright/test';

const pageName = '${normalizedRoute.replace(/[^a-zA-Z0-9]/g, '-') || 'home'}';

test.describe('${testDescription}', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the page and wait for it to load
    await page.goto('http://localhost:3000${normalizedRoute}');
    await page.waitForLoadState('networkidle');
  });

  test('should load and display correctly', async ({ page }) => {
    // Verify page title and URL
    const currentUrl = page.url();
    expect(currentUrl).toContain('${normalizedRoute}');
    
    // Basic accessibility check - at least one ARIA role should be present
    const elements = await page.locator('[role]').count();
    expect(elements).toBeGreaterThan(0);
    
    ${assertions.map(line => line.replace(/page\.locator\("([^"]+)"\)/g, 'page.locator(\'$1\')')).join('\n    ')}
  });

  test('should be responsive', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot(\`\${pageName}-mobile.png\`, {
      animations: 'disabled'
    });
    
    // Test tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot(\`\${pageName}-tablet.png\`, {
      animations: 'disabled'
    });
    
    // Test desktop viewport
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot(\`\${pageName}-desktop.png\`, {
      animations: 'disabled'
    });
  });

  test('should handle keyboard navigation', async ({ page }) => {
    // Wait for page to be fully loaded
    await page.waitForLoadState('networkidle');
    
    // Find all focusable elements
    const focusableElements = await page.evaluate(() => {
      const selector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
      return document.querySelectorAll(selector).length;
    });
    
    if (focusableElements > 0) {
      // Test tab navigation only if there are focusable elements
      await page.keyboard.press('Tab');
      const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
      expect(focusedElement).toBeTruthy();
      
      // Test basic keyboard shortcuts
      await page.keyboard.press('Escape');
      await page.keyboard.press('Enter');
    } else {
      test.skip();
    }
  });

  test('should meet basic accessibility requirements', async ({ page }) => {
    // Check for ARIA landmarks - at least one of these should exist
    const landmarks = await page.evaluate(() => {
      const roles = ['main', 'navigation', 'banner', 'contentinfo', 'complementary', 'search'];
      return roles.some(role => document.querySelector(\`[role="\${role}"]\`));
    });
    expect(landmarks).toBeTruthy();
    
    // Check for image alt texts if images exist
    const images = await page.locator('img');
    const count = await images.count();
    if (count > 0) {
      for (let i = 0; i < count; i++) {
        await expect(images.nth(i)).toHaveAttribute('alt', /.*/);
      }
    }
  });
});
`;
} 