import { test, expect } from '@playwright/test';

const pageName = '-venues';

test.describe('Test suite for /venues', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the page and wait for it to load
    await page.goto('http://localhost:3000/venues');
    await page.waitForLoadState('networkidle');
  });

  test('should load and display correctly', async ({ page }) => {
    // Verify page title and URL
    const currentUrl = page.url();
    expect(currentUrl).toContain('/venues');
    
    // Basic accessibility check - at least one ARIA role should be present
    const elements = await page.locator('[role]').count();
    expect(elements).toBeGreaterThan(0);
    
    // Testing .win95-window > .win95-titlebar > span
    // The title of the window which indicates the purpose of the application.
    await expect(page.locator('.win95-window > .win95-titlebar > span')).toBeVisible();
    await expect(page.locator('.win95-window > .win95-titlebar > span')).toBeVisible();
    
    // Testing #map
    // Displays a Google Map showing areas related to venue notifications.
    await expect(page.locator('#map')).toBeVisible();
    // TODO: Implement test for: Test interactions such as zooming in/out and dragging the map.
    // TODO: Implement test for: Verify map functionality on different screen sizes.
    
    // Testing input[placeholder='Enter a location']
    // Input field to enter an address for venue notifications.
    await page.locator('input[placeholder="Enter a location"]').fill('test value');
    await page.locator('input[placeholder="Enter a location"]').fill('test value');
    await page.locator('input[placeholder="Enter a location"]').fill('test value');
    
    // Testing input[type='range']
    // Slider to select the radius for venue notifications.
    // TODO: Implement test for: Ensure the slider is functional and can be adjusted between minimum and maximum values.
    // TODO: Implement test for: Test the slider's appearance at different resolutions.
    // TODO: Implement test for: Verify that the radius value updates in real-time with slider movement.
    
    // Testing input[type='checkbox'][name='venue-type']
    // Checkbox options for selecting types of venues.
    await page.locator('input[type="checkbox"][name="venue-type"]').fill('test value');
    await page.locator('input[type="checkbox"][name="venue-type"]').fill('test value');
    await page.locator('input[type="checkbox"][name="venue-type"]').click();
await page.waitForLoadState('networkidle');
    
    // Testing input[type='range'][name='rating']
    // Slider to set the minimum rating for venues.
    await expect(page.locator('input[type="range"][name="rating"]')).toBeVisible();
    // TODO: Implement test for: Test for boundary values (minimum and maximum) to confirm functionality.
    await expect(page.locator('input[type="range"][name="rating"]')).toBeVisible();
    
    // Testing button[type='submit']
    // Button to subscribe to updates based on selected venue criteria.
    await page.locator('button[type="submit"]').click();
    await page.locator('button[type="submit"]').click();
await page.waitForLoadState('networkidle');
    await expect(page.locator('button[type="submit"]')).toHaveAttribute('aria-label', /.+/);
await expect(page.locator('button[type="submit"]')).toBeFocused();
    
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
