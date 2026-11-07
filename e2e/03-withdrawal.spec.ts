import { expect, test } from '@playwright/test'
import { postProfit, requestProfitWithdrawal, seedActiveInvestor, todayIST } from './support/api.ts'
import { confirmDialog, loginUI } from './support/ui.ts'

test('3. withdrawal approve → mark paid', async ({ page }) => {
  // ₹50,000 principal +2% = ₹1,000 profit; withdraw the ₹500 minimum (below the
  // ₹50,000 second-approval threshold, so no second approval is needed).
  const investor = await seedActiveInvestor()
  await postProfit(investor.investmentId, 2, todayIST())
  await requestProfitWithdrawal(investor, 500)

  await loginUI(page, 'admin')
  await page.goto('/withdrawals?status=REQUESTED')
  await page.getByRole('row', { name: /₹500\.00/ }).first().click()
  await page.getByRole('button', { name: 'Approve' }).click()
  await confirmDialog(page, 'Approve')
  await expect(page.getByText('Withdrawal approved')).toBeVisible()

  await page.goto('/withdrawals?status=APPROVED')
  await page.getByRole('row', { name: /₹500\.00/ }).first().click()
  await page.getByRole('button', { name: 'Mark paid' }).click()
  const dialog = page.getByRole('dialog', { name: 'Mark as paid?' })
  await dialog.getByLabel(/UTR/).fill(`E2EUTR${Date.now()}`.slice(0, 18))
  await dialog.getByRole('button', { name: 'Mark paid' }).click()
  await expect(page.getByText('Marked as paid')).toBeVisible()
})
