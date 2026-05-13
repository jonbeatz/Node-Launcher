import { test, expect } from '@playwright/test'

test('renderer shell shows VPE branding', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('banner')).toContainText('VPE')
})
