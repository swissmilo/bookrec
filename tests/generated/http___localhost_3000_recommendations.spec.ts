import { test, expect } from '@playwright/test';

const pageName = '-recommendations';

test.describe('Test suite for /recommendations', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the page and wait for it to load
    await page.goto('http://localhost:3000/recommendations');
    await page.waitForLoadState('networkidle');
  });

  test('should load and display correctly', async ({ page }) => {
    // Verify page title and URL
    const currentUrl = page.url();
    expect(currentUrl).toContain('/recommendations');
    
    // Basic accessibility check - at least one ARIA role should be present
    const elements = await page.locator('[role]').count();
    expect(elements).toBeGreaterThan(0);
    
    // Testing input#genre
    // Input field for users to enter a genre they want book recommendations for.
    await expect(page.locator('input#genre')).toBeVisible();
    await page.locator('input#genre').fill('test value');
    await page.locator('input#genre').fill('test value');
    await page.locator('input#genre').fill('test value');
    
    // Testing button[type="submit"]
    // Submit button to trigger the search for book recommendations based on the entered genre.
    await expect(page.locator('button[type="submit"]')).toHaveText(/./);
    await page.locator('button[type="submit"]').click();
    await page.locator('button[type="submit"]').fill('test value');
    
    // Testing div#spinner
    // Spinner element that is displayed when the form is submitted.
    // TODO: Implement test for: Verify that the spinner is initially hidden.
    await expect(page.locator('div#spinner')).toBeVisible();
    // TODO: Implement test for: Ensure the spinner is hidden after the recommendations are loaded.
    
    // Testing a.win95-close[aria-label="Close window"]
    // Close link to exit the book recommendations window.
    await expect(page.locator('a.win95-close[aria-label="Close window"]')).toHaveAttribute('aria-label', /.+/);
await expect(page.locator('a.win95-close[aria-label="Close window"]')).toBeFocused();
    await page.locator('a.win95-close[aria-label="Close window"]').click();
    
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
