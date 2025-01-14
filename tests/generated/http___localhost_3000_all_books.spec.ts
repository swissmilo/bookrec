import { test, expect } from '@playwright/test';

const pageName = '-all-books';

test.describe('Test suite for /all-books', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the page and wait for it to load
    await page.goto('http://localhost:3000/all-books');
    await page.waitForLoadState('networkidle');
  });

  test('should load and display correctly', async ({ page }) => {
    // Verify page title and URL
    const currentUrl = page.url();
    expect(currentUrl).toContain('/all-books');
    
    // Basic accessibility check - at least one ARIA role should be present
    const elements = await page.locator('[role]').count();
    expect(elements).toBeGreaterThan(0);
    
    // Testing .win95-titlebar
    // The title bar at the top of the window displaying the page title 'Library', including a close button.
    await expect(page.locator('.win95-titlebar')).toBeVisible();
    await expect(page.locator('.win95-titlebar')).toBeVisible();
    await page.locator('.win95-titlebar').click();
    
    // Testing .category-link
    // Links for filtering books by category.
    await expect(page.locator('.category-link')).toBeVisible();
    // TODO: Implement test for: Test the functionality of each link to ensure it navigates to the correct category page.
    
    // Testing table
    // The table structure that displays the list of books.
    await expect(page.locator('table')).toBeVisible();
    // TODO: Implement test for: Ensure proper styling of the table for different screen sizes.
    
    // Testing .book-row
    // Each row representing a book with a tooltip for details.
    await expect(page.locator('.book-row')).toBeVisible();
    await page.locator('.book-row').hover();
    
    // Testing .tooltip-container
    // Wrapper for the book links that shows the tooltip on mouseover.
    // TODO: Implement test for: Verify that the tooltip container changes state on mouseover and mouseout events.
    // TODO: Implement test for: Test for proper positioning of the tooltip relative to the mouse pointer.
    
    // Testing .tooltip
    // The tooltip element providing additional information about the books.
    await page.locator('.tooltip').click();
await page.waitForLoadState('networkidle');
    // TODO: Implement test for: Check that the tooltip disappears on mouseout and does not obstruct other elements.
    
    // Testing .win95-close
    // The close button on the title bar.
    await page.locator('.win95-close').click();
    // TODO: Implement test for: Ensure that the close action results in the window being hidden or closed.
    
    // Testing thead
    // The table header containing category headers.
    await expect(page.locator('thead')).toBeVisible();
    
    // Testing .tooltip-container a
    // Links that redirect to the Amazon product pages for books.
    await page.locator('.tooltip-container a').click();
    // TODO: Implement test for: Test links in a new tab to verify that they function correctly.
    
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
