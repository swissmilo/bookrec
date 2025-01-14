import { test, expect } from '@playwright/test';

const pageName = '-music';

test.describe('Test suite for /music', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the page and wait for it to load
    await page.goto('http://localhost:3000/music');
    await page.waitForLoadState('networkidle');
  });

  test('should load and display correctly', async ({ page }) => {
    // Verify page title and URL
    const currentUrl = page.url();
    expect(currentUrl).toContain('/music');
    
    // Basic accessibility check - at least one ARIA role should be present
    const elements = await page.locator('[role]').count();
    expect(elements).toBeGreaterThan(0);
    
    // Testing .win95-titlebar
    // This is the title bar of the window that displays 'My Music' and contains a close button.
    await expect(page.locator('.win95-titlebar')).toBeVisible();
    await expect(page.locator('.win95-titlebar')).toBeVisible();
    await page.locator('.win95-titlebar').click();
    
    // Testing iframe[title='Spotify Playlist Embed']
    // This iframe embeds a Spotify playlist, allowing users to interact with the music directly.
    await expect(page.locator('iframe[title="Spotify Playlist Embed"]')).toBeVisible();
    // TODO: Implement test for: Test that the iframe loads correctly and displays the embedded Spotify playlist.
    // TODO: Implement test for: Ensure music controls (play, pause, skip) within the iframe work as intended.
    await page.locator('iframe[title="Spotify Playlist Embed"]').click();
    
    // Testing a.win95-close
    // The close button that allows users to exit the music window.
    await page.locator('a.win95-close').click();
    await page.locator('a.win95-close').click();
    await page.locator('a.win95-close').click();
    
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
    
    expect(hasHeadings).toBeTruthy();
  });
});
