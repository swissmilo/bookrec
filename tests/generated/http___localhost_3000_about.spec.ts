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
    
    // Testing div.win95-window[role='main']
    // The main container for the 'About Me' content.
    // TODO: Implement test for: Verify that the window appears on initial page load
    // TODO: Implement test for: Check that the window can be closed by the close button
    
    // Testing div.win95-titlebar[role='banner']
    // The title bar displaying the title of the window and a close button.
    await expect(page.locator('div.win95-titlebar[role="banner"]')).toBeVisible();
    await expect(page.locator('div.win95-titlebar[role="banner"]')).toBeVisible();
    
    // Testing a.win95-close[aria-label='Close window']
    // A button to close the window.
    await page.locator('a.win95-close[aria-label="Close window"]').click();
    // TODO: Implement test for: Check for any visual changes after closing the window
    
    // Testing nav[aria-label='Social links']
    // Navigation section containing social media links.
    await expect(page.locator('nav[aria-label="Social links"]')).toBeVisible();
    await expect(page.locator('nav[aria-label="Social links"]')).toHaveAttribute('aria-label', /.+/);
await expect(page.locator('nav[aria-label="Social links"]')).toBeFocused();
    // TODO: Implement test for: Check that links are functional and open in new tabs
    
    // Testing a[href='https://www.linkedin.com/in/milospirig/'][aria-label='Visit my LinkedIn profile']
    // Link to Milo's LinkedIn profile.
    // TODO: Implement test for: Test that the link opens in a new tab
    // TODO: Implement test for: Confirm the correct URL is linked
    
    // Testing a[href='https://twitter.com/SwissMilo'][aria-label='Visit my Twitter profile']
    // Link to Milo's Twitter profile.
    // TODO: Implement test for: Test that the link opens in a new tab
    // TODO: Implement test for: Confirm the correct URL is linked
    
    // Testing a[href='https://github.com/swissmilo'][aria-label='Visit my GitHub profile']
    // Link to Milo's GitHub profile.
    // TODO: Implement test for: Test that the link opens in a new tab
    // TODO: Implement test for: Confirm the correct URL is linked
    
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
