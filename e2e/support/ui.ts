import { expect, type Page } from '@playwright/test'
import { ADMINS } from './api.ts'

export async function loginUI(page: Page, who: keyof typeof ADMINS) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(ADMINS[who].email)
  await page.getByLabel('Password').fill(ADMINS[who].password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('heading', { name: /^Good (morning|afternoon|evening), / })).toBeVisible()
}

/** Click the confirm button of the open useConfirm() AlertDialog. */
export async function confirmDialog(page: Page, label: string) {
  const dialog = page.getByRole('alertdialog')
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: label, exact: true }).click()
  await expect(dialog).toBeHidden()
}
