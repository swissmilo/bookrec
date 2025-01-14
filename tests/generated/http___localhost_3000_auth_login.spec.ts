import { test, expect } from '@playwright/test';

const pageName = '-auth-login';

test.describe('Test suite for /auth/login', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the page and wait for it to load
    await page.goto('http://localhost:3000/auth/login');
    await page.waitForLoadState('networkidle');
  });

  test('should load and display correctly', async ({ page }) => {
    // Verify page title and URL
    const currentUrl = page.url();
    expect(currentUrl).toContain('/auth/login');
    
    // Basic accessibility check - at least one ARIA role should be present
    const elements = await page.locator('[role]').count();
    expect(elements).toBeGreaterThan(0);
    
    // Testing h1.HeaderHeading
    // Displays the title of the sign-in page.
    await expect(page.locator('h1.HeaderHeading')).toBeVisible();
    await expect(page.locator('h1.HeaderHeading')).toHaveText(/./);
    
    // Testing label[for='radix-:Rl6pnltbnla:']
    // Label for the email input field, indicating what the user should enter.
    await expect(page.locator('label[for="radix-:Rl6pnltbnla:"]')).toBeVisible();
    await expect(page.locator('label[for="radix-:Rl6pnltbnla:"]')).toHaveText(/./);
    await page.locator('label[for="radix-:Rl6pnltbnla:"]').click();
    
    // Testing input#radix-:Rl6pnltbnla:
    // Input field for users to enter their email address.
    await expect(page.locator('input#radix-:Rl6pnltbnla:')).toBeVisible();
    await page.locator('input#radix-:Rl6pnltbnla:').fill('test value');
    await expect(page.locator('input#radix-:Rl6pnltbnla:')).toHaveText(/./);
    await page.locator('input#radix-:Rl6pnltbnla:').fill('test value');
    await expect(page.locator('input#radix-:Rl6pnltbnla:')).toBeVisible();
    
    // Testing button[type='submit']
    // The submit button to continue the sign-in process.
    await expect(page.locator('button[type="submit"]')).toBeVisible();
    await page.locator('button[type="submit"]').click();
    await expect(page.locator('button[type="submit"]')).toHaveText(/./);
    await page.locator('button[type="submit"]').fill('test value');
    await expect(page.locator('button[type="submit"]')).toBeVisible();
    
    // Testing p.rt-Text.rt-r-ta-center.rt-r-lt-end.rt-r-mt-5
    // Text that provides additional information about signing up for a new account.
    await expect(page.locator('p.rt-Text.rt-r-ta-center.rt-r-lt-end.rt-r-mt-5')).toBeVisible();
    await expect(page.locator('p.rt-Text.rt-r-ta-center.rt-r-lt-end.rt-r-mt-5')).toBeVisible();
    await page.locator('p.rt-Text.rt-r-ta-center.rt-r-lt-end.rt-r-mt-5').click();
    
    // Testing a.rt-Text.BrandedLink.rt-reset
    // Link to the sign-up page for new users.
    await page.locator('a.rt-Text.BrandedLink.rt-reset').click();
    // TODO: Implement test for: Check that the link opens in the same tab.
    await expect(page.locator('a.rt-Text.BrandedLink.rt-reset')).toHaveText(/./);
    
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
