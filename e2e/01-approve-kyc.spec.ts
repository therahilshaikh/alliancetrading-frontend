import { expect, test } from '@playwright/test'
import { seedKycSubmittedMember } from './support/api.ts'
import { confirmDialog, loginUI } from './support/ui.ts'

test('1. login → approve a KYC with a saved payment account', async ({ page }) => {
  const member = await seedKycSubmittedMember()

  await loginUI(page, 'admin')
  await page.getByRole('link', { name: /Account approvals/ }).first().click()
  await page.getByRole('row', { name: new RegExp(member.fullName) }).click()

  const sheet = page.getByRole('dialog', { name: member.fullName })
  await expect(sheet).toBeVisible()
  await sheet.getByRole('button', { name: 'Approve' }).click()

  const approve = page.getByRole('dialog', { name: `Approve ${member.fullName}` })
  await approve.getByRole('combobox').click()
  await page.getByRole('option').first().click()
  // Amount is pre-filled from /payment-accounts/defaults.
  await expect(approve.getByLabel('Amount')).not.toHaveValue('')
  await approve.getByRole('button', { name: 'Approve' }).click()

  await confirmDialog(page, 'Approve')
  await expect(page.getByText('Account approved and payment assigned')).toBeVisible()
  await expect(page.getByRole('row', { name: new RegExp(member.fullName) })).toHaveCount(0)
})
