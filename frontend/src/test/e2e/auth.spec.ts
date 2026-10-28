import { test, expect } from '@playwright/test'

/**
 * E2E smoke test: unauthenticated user is redirected to login.
 * Requires the full stack to be running.
 */
test('unauthenticated user is redirected to /login', async ({ page }) => {
  await page.goto('/app')
  await expect(page).toHaveURL(/\/login/)
  await expect(page.getByText('Guilda')).toBeVisible()
  await expect(page.getByRole('link', { name: /continue with google/i })).toBeVisible()
})
