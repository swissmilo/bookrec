import { test, expect } from '@playwright/test';

const pageName = '-about';

test.describe('Test suite for /about', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the page and wait for it to load
    await page.goto('http://localhost:3000/about');
    await page.waitForLoadState('networkidle');
  });

  test('should load and display correctly', async ({ page }) => {
    // Verify page title and URL
    const currentUrl = page.url();
    expect(currentUrl).toContain('/about');
    
    // Basic accessibility check - at least one ARIA role should be present
    const elements = await page.locator('[role]').count();
    expect(elements).toBeGreaterThan(0);
    
    // Testing .win95-titlebar
    // The title bar of the window, displaying 'About Me' title and a close button.
    // TODO: Implement test for: Verify that the title bar displays 'About Me'.
    await expect(page.locator('.win95-titlebar')).toBeVisible();
    await page.locator('.win95-titlebar').click();
    
    // Testing .win95-close
    // The button to close the About Me window.
    await expect(page.locator('.win95-close')).toBeVisible();
    await expect(page.locator('.win95-close')).toHaveAttribute('aria-label', /.+/);
await expect(page.locator('.win95-close')).toBeFocused();
    await page.locator('.win95-close').click();
    
    // Testing .win95-content
    // The main content area of the window containing personal information.
    await expect(page.locator('.win95-content')).toBeVisible();
    await expect(page.locator('.win95-content')).toHaveText(/./);
    await expect(page.locator('.win95-content')).toHaveText(/./);
    
    // Testing nav[aria-label='Social links']
    // The navigation area containing links to social media profiles.
    await expect(page.locator('nav[aria-label="Social links"]')).toBeVisible();
    await expect(page.locator('nav[aria-label="Social links"]')).toHaveText(/./);
    await page.locator('nav[aria-label="Social links"]').click();
    await page.locator('nav[aria-label="Social links"]').click();
    
    // Testing a[href='https://www.linkedin.com/in/milospirig/']
    // Link to Milo's LinkedIn profile.
    await expect(page.locator('a[href="https://www.linkedin.com/in/milospirig/"]')).toBeVisible();
    await page.locator('a[href="https://www.linkedin.com/in/milospirig/"]').click();
    await expect(page.locator('a[href="https://www.linkedin.com/in/milospirig/"]')).toHaveAttribute('aria-label', /.+/);
await expect(page.locator('a[href="https://www.linkedin.com/in/milospirig/"]')).toBeFocused();
    
    // Testing a[href='https://twitter.com/SwissMilo']
    // Link to Milo's Twitter profile.
    await expect(page.locator('a[href="https://twitter.com/SwissMilo"]')).toBeVisible();
    await page.locator('a[href="https://twitter.com/SwissMilo"]').click();
    await expect(page.locator('a[href="https://twitter.com/SwissMilo"]')).toHaveAttribute('aria-label', /.+/);
await expect(page.locator('a[href="https://twitter.com/SwissMilo"]')).toBeFocused();
    
    // Testing a[href='https://github.com/swissmilo']
    // Link to Milo's GitHub profile.
    await expect(page.locator('a[href="https://github.com/swissmilo"]')).toBeVisible();
    await page.locator('a[href="https://github.com/swissmilo"]').click();
    await expect(page.locator('a[href="https://github.com/swissmilo"]')).toHaveAttribute('aria-label', /.+/);
await expect(page.locator('a[href="https://github.com/swissmilo"]')).toBeFocused();
    
  });

  test('should be responsive', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot(`${pageName}-mobile.png`, {
      animations: 'disabled'
    });
    
    // Test tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot(`${pageName}-tablet.png`, {
      animations: 'disabled'
    });
    
    // Test desktop viewport
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot(`${pageName}-desktop.png`, {
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
      return roles.some(role => document.querySelector(`[role="${role}"]`));
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
