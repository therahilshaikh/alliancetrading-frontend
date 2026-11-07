import { expect, test } from '@playwright/test'
import { loginUI } from './support/ui.ts'

/**
 * Admins may be signed in on several devices (ADMIN_WEB_CONTEXT.md §5.4), so the
 * original "log in elsewhere → first tab logged out" scenario no longer applies.
 * These cover the new rules instead. Needs no seeded members.
 */
test.describe('4. sessions', () => {
  test('signing in on a second device keeps the first device signed in', async ({ browser }) => {
    const deviceA = await (await browser.newContext()).newPage()
    const deviceB = await (await browser.newContext()).newPage()
    await loginUI(deviceA, 'admin')
    await loginUI(deviceB, 'admin')

    await deviceA.reload()
    await expect(deviceA.getByRole('heading', { name: /^Good (morning|afternoon|evening), / })).toBeVisible()
    await expect(deviceA).not.toHaveURL(/\/login/)
  })

  test('a new tab shares the session; logout in one tab signs out every tab of that browser', async ({ browser }) => {
    const ctx = await browser.newContext()
    const tab1 = await ctx.newPage()
    await loginUI(tab1, 'admin')

    const tab2 = await ctx.newPage()
    await tab2.goto('/members')
    await expect(tab2.getByRole('heading', { name: 'Members' })).toBeVisible()

    await tab1.getByRole('button', { name: 'Account menu' }).click()
    await tab1.getByRole('menuitem', { name: 'Sign out' }).click()
    await expect(tab1).toHaveURL(/\/login/)
    await expect(tab2).toHaveURL(/\/login/)
  })

  test('a revoked session (SESSION_REPLACED) returns to login with a message', async ({ page }) => {
    await loginUI(page, 'admin')
    // Simulate server-side revocation for the next API call.
    await page.route('**/api/v1/admin/**', (route) =>
      route.fulfill({
        status: 401,
        contentType: 'application/problem+json',
        body: JSON.stringify({ status: 401, code: 'SESSION_REPLACED', detail: 'Session has been revoked' }),
      }),
    )
    await page.goto('/members')
    await expect(page).toHaveURL(/\/login\?reason=expired/)
    await expect(page.getByText('Your session ended, please sign in again.')).toBeVisible()
  })
})
