import { expect, test } from '@playwright/test'
import { seedActiveInvestor } from './support/api.ts'
import { confirmDialog, loginUI } from './support/ui.ts'

test('2. super posts +1% PERCENTAGE P&L to ALL with admin as approver → admin previews → approves', async ({ browser }) => {
  // Needs at least one ACTIVE investment so the preview has rows.
  const investor = await seedActiveInvestor()

  // Maker: super admin
  const maker = await (await browser.newContext()).newPage()
  await loginUI(maker, 'super')
  await maker.goto('/pnl?tab=post')
  // "All active members" + "Profit" are the defaults.
  await maker.getByRole('radio', { name: /% of principal/ }).click()
  await maker.getByLabel('Percentage of each member’s principal').fill('1')
  // Live preview comes from the server dry run.
  await expect(maker.getByText('Total profit credit')).toBeVisible()
  await maker.getByLabel('Approver').click()
  await maker.getByRole('option', { name: /admin@alliancetrading\.local/ }).click()
  await maker.getByRole('button', { name: /Review and send profit for approval/ }).click()
  await confirmDialog(maker, 'Send for approval')
  await expect(maker.getByText('P&L batch created and sent to the approver')).toBeVisible()

  // Checker: admin — "Awaiting my approval" → Review → Preview page → Approve
  const checker = await (await browser.newContext()).newPage()
  await loginUI(checker, 'admin')
  await checker.goto('/pnl?tab=awaiting')
  await checker.getByRole('link', { name: 'Review' }).first().click()
  await expect(checker.getByText('Preview', { exact: true })).toBeVisible()
  await expect(checker.getByRole('table', { name: 'Allocations preview' }).getByText(investor.fullName)).toBeVisible()
  await checker.getByRole('button', { name: 'Approve' }).click()
  await confirmDialog(checker, 'Approve and post')
  await expect(checker.getByText('Batch approved. P&L posted to members.')).toBeVisible()
  await expect(checker).toHaveURL(/\/allocations$/)
})
