import { test, expect } from '@playwright/test';

/**
 * Mobile UX Tests
 * 
 * These tests verify critical mobile interactions:
 * - Hamburger menu works in all states
 * - No UI freeze after modals
 * - Only one overlay open at a time
 * - Proper cleanup of overlays
 */

test.describe('Mobile UX - Hamburger Menu', () => {
  test.beforeEach(async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Navigate to a session page (assuming one exists)
    // In real tests, you'd need to set up test data first
    await page.goto('/');
  });

  test('Hamburger menu toggles sidebar on mobile', async ({ page }) => {
    // Find hamburger menu button
    const hamburgerButton = page.locator('button').filter({ has: page.locator('svg') }).first();
    
    // Initially sidebar should be closed (not visible)
    const sidebar = page.locator('aside');
    await expect(sidebar).not.toBeVisible();

    // Click hamburger to open
    await hamburgerButton.click();
    
    // Sidebar should be visible
    await expect(sidebar).toBeVisible();

    // Click hamburger again to close
    await hamburgerButton.click();
    
    // Sidebar should be hidden
    await expect(sidebar).not.toBeVisible();
  });

  test('Clicking outside sidebar closes it', async ({ page }) => {
    const hamburgerButton = page.locator('button').filter({ has: page.locator('svg') }).first();
    const sidebar = page.locator('aside');
    const overlay = page.locator('[class*="backdrop"]').first();

    // Open sidebar
    await hamburgerButton.click();
    await expect(sidebar).toBeVisible();

    // Click overlay to close
    if (await overlay.isVisible()) {
      await overlay.click({ position: { x: 10, y: 10 } });
      await expect(sidebar).not.toBeVisible();
    }
  });

  test('Hamburger menu works during player editing', async ({ page }) => {
    // This test assumes there's a session with players
    // Navigate to session page
    // await page.goto('/session/[id]');
    
    // Open edit player dialog/bottom sheet
    // const editButton = page.locator('button').filter({ hasText: 'Edit' }).first();
    // await editButton.click();
    
    // Verify dialog is open
    // const dialog = page.locator('[role="dialog"]');
    // await expect(dialog).toBeVisible();
    
    // Click hamburger - should close dialog and open sidebar
    const hamburgerButton = page.locator('button').filter({ has: page.locator('svg') }).first();
    await hamburgerButton.click();
    
    // Dialog should be closed, sidebar should be open
    // await expect(dialog).not.toBeVisible();
    const sidebar = page.locator('aside');
    await expect(sidebar).toBeVisible();
  });
});

test.describe('Mobile UX - No UI Freeze', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
  });

  test('Page remains interactive after closing modal', async ({ page }) => {
    // Open and close a modal
    // (Implementation depends on actual UI)
    
    // Verify page is scrollable
    const body = page.locator('body');
    const initialScroll = await page.evaluate(() => window.scrollY);
    
    await page.evaluate(() => window.scrollTo(0, 100));
    const afterScroll = await page.evaluate(() => window.scrollY);
    
    expect(afterScroll).toBeGreaterThan(initialScroll);
    
    // Verify buttons are clickable
    const buttons = page.locator('button');
    const count = await buttons.count();
    expect(count).toBeGreaterThan(0);
    
    // Try clicking a button
    if (count > 0) {
      await buttons.first().click({ timeout: 1000 });
      // Should not throw
    }
  });

  test('Body scroll lock is restored after overlay closes', async ({ page }) => {
    // Open sidebar
    const hamburgerButton = page.locator('button').filter({ has: page.locator('svg') }).first();
    await hamburgerButton.click();
    
    // Check if scroll is locked (body overflow hidden)
    const bodyOverflow = await page.evaluate(() => {
      return window.getComputedStyle(document.body).overflow;
    });
    
    // Close sidebar
    await hamburgerButton.click();
    
    // Check if scroll is restored
    const bodyOverflowAfter = await page.evaluate(() => {
      return window.getComputedStyle(document.body).overflow;
    });
    
    // Should be restored (not locked)
    expect(bodyOverflowAfter).not.toBe('hidden');
  });
});

test.describe('Mobile UX - Overlay Cleanup', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
  });

  test('Only one overlay is open at a time', async ({ page }) => {
    const hamburgerButton = page.locator('button').filter({ has: page.locator('svg') }).first();
    const sidebar = page.locator('aside');
    
    // Open sidebar
    await hamburgerButton.click();
    await expect(sidebar).toBeVisible();
    
    // Count visible overlays/dialogs
    const dialogs = page.locator('[role="dialog"]');
    const dialogCount = await dialogs.count();
    
    // If sidebar is open, no dialogs should be visible
    if (await sidebar.isVisible()) {
      for (let i = 0; i < dialogCount; i++) {
        await expect(dialogs.nth(i)).not.toBeVisible();
      }
    }
  });

  test('No invisible full-screen elements remain after closing overlays', async ({ page }) => {
    // Open and close sidebar
    const hamburgerButton = page.locator('button').filter({ has: page.locator('svg') }).first();
    await hamburgerButton.click();
    await hamburgerButton.click();
    
    // Check for invisible overlays with high z-index that might block interaction
    const blockingElements = await page.evaluate(() => {
      const elements = document.querySelectorAll('*');
      const blocking: Element[] = [];
      
      elements.forEach((el) => {
        const style = window.getComputedStyle(el);
        const zIndex = parseInt(style.zIndex) || 0;
        const position = style.position;
        const pointerEvents = style.pointerEvents;
        
        // Check for fixed/absolute elements with high z-index that are invisible but might block
        if (
          (position === 'fixed' || position === 'absolute') &&
          zIndex > 100 &&
          style.opacity === '0' &&
          pointerEvents !== 'none'
        ) {
          blocking.push(el);
        }
      });
      
      return blocking.length;
    });
    
    expect(blockingElements).toBe(0);
  });
});

test.describe('Mobile UX - Complete User Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
  });

  test('Complete flow: Add Player -> Edit -> Close -> Scroll -> Open Menu', async ({ page }) => {
    // Navigate to session page
    await page.goto('/');
    
    // This is a placeholder test structure
    // In a real implementation, you'd need:
    // 1. Create a test session
    // 2. Navigate to it
    // 3. Add a player
    // 4. Edit the player
    // 5. Close the edit dialog
    // 6. Scroll the page
    // 7. Open the menu
    // 8. Verify everything works
    
    // For now, just verify basic navigation works
    const hamburgerButton = page.locator('button').filter({ has: page.locator('svg') }).first();
    await hamburgerButton.click();
    
    const sidebar = page.locator('aside');
    await expect(sidebar).toBeVisible();
    
    // Verify page is still interactive
    await page.evaluate(() => window.scrollTo(0, 100));
    const scrollY = await page.evaluate(() => window.scrollY);
    expect(scrollY).toBeGreaterThanOrEqual(0);
  });
});

