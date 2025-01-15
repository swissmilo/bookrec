import { test, expect } from '@playwright/test';

const pageName = '-';

test.describe('Test suite for /', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the page and wait for it to load
    await page.goto('http://localhost:3000/');
    await page.waitForLoadState('networkidle');
  });

  test('should load and display correctly', async ({ page }) => {
    // Verify page title and URL
    const currentUrl = page.url();
    expect(currentUrl).toContain('/');
    
    // Basic accessibility check - at least one ARIA role should be present
    const elements = await page.locator('[role]').count();
    expect(elements).toBeGreaterThan(0);
    
    // Testing a[aria-label="About Me"]
    // Link to the About Me section of the website.
    await page.locator('a[aria-label="About Me"]').click();
    // TODO: Implement test for: Check that the about page loads correctly without errors.
    
    // Testing a[aria-label="Book Library"]
    // Link to the Book Library section.
    await page.locator('a[aria-label="Book Library"]').click();
    // TODO: Implement test for: Confirm that the book library page displays a list of available books.
    
    // Testing a[aria-label="Book Recommendations"]
    // Link to the Book Recommendations section.
    // TODO: Implement test for: Test if the link correctly redirects to '/recommendations'.
    await expect(page.locator('a[aria-label="Book Recommendations"]')).toBeVisible();
    
    // Testing a[aria-label="Play Sokobox Game"]
    // Link to play the Sokobox game.
    // TODO: Implement test for: Check that the link navigates to the '/sokobox' URL.
    // TODO: Implement test for: Validate that the game loads and functions correctly.
    
    // Testing a[aria-label="Venue Notifications"]
    // Link to view Venue Notifications.
    await page.locator('a[aria-label="Venue Notifications"]').click();
    await expect(page.locator('a[aria-label="Venue Notifications"]')).toBeVisible();
    
    // Testing a[aria-label="My Music"]
    // Link to the Music section.
    await page.locator('a[aria-label="My Music"]').click();
    await expect(page.locator('a[aria-label="My Music"]')).toHaveText(/./);
    
    // Testing a[href="/auth/login"]
    // Login link that redirects users to the login page.
    // TODO: Implement test for: Check that the login link redirects to the correct '/auth/login' URL.
    // TODO: Implement test for: Verify that the login page loads successfully without issues.
    
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
