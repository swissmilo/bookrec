import { test, expect } from '@playwright/test';

const pageName = '-sokobox';

test.describe('Test suite for /sokobox', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the page and wait for it to load
    await page.goto('http://localhost:3000/sokobox');
    await page.waitForLoadState('networkidle');
  });

  test('should load and display correctly', async ({ page }) => {
    // Verify page title and URL
    const currentUrl = page.url();
    expect(currentUrl).toContain('/sokobox');
    
    // Basic accessibility check - at least one ARIA role should be present
    const elements = await page.locator('[role]').count();
    expect(elements).toBeGreaterThan(0);
    
    // Testing .win95-titlebar > span[role='heading'][aria-level='1']
    // The title of the Sokobox window.
    await expect(page.locator('.win95-titlebar > span[role="heading"][aria-level="1"]')).toHaveText(/./);
    // TODO: Implement test for: Check that the title is visually distinct and properly styled.
    
    // Testing .win95-close
    // The close button for the Sokobox window.
    await page.locator('.win95-close').click();
    await page.keyboard.press('Enter');
    
    // Testing #gameCanvas
    // The canvas area where the Sokobox game is rendered.
    // TODO: Implement test for: Ensure the canvas displays the game correctly.
    // TODO: Implement test for: Test responsiveness of the canvas on window resizing.
    
    // Testing .control-button.up
    // The button to move the player up in the game.
    await page.locator('.control-button.up').click();
    // TODO: Implement test for: Check that the button responds to touch events.
    
    // Testing .control-button.down
    // The button to move the player down in the game.
    await page.locator('.control-button.down').click();
    // TODO: Implement test for: Check that the button responds to touch events.
    
    // Testing .control-button.left
    // The button to move the player left in the game.
    await page.locator('.control-button.left').click();
    // TODO: Implement test for: Check that the button responds to touch events.
    
    // Testing .control-button.right
    // The button to move the player right in the game.
    await page.locator('.control-button.right').click();
    // TODO: Implement test for: Check that the button responds to touch events.
    
    // Testing #highscoreModal
    // The modal that displays the high scores and completion time.
    // TODO: Implement test for: Verify that the modal appears when the game is completed.
    await expect(page.locator('#highscoreModal')).toBeVisible();
    
    // Testing #completionTime
    // The element that displays the completion time.
    await expect(page.locator('#completionTime')).toBeVisible();
    await page.locator('#completionTime').click();
await page.waitForLoadState('networkidle');
    
    // Testing #highscoreList
    // The section that displays the high score leaderboard.
    await expect(page.locator('#highscoreList')).toBeVisible();
    // TODO: Implement test for: Check that the leaderboard updates as expected.
    
    // Testing .win95-button
    // The continue button in the high score modal.
    await page.locator('.win95-button').click();
    // TODO: Implement test for: Check that the modal does not appear again without a new game.
    
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
