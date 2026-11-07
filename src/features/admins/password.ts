import { z } from 'zod'

/** Same rule as the server for create, change and reset: 10–100 characters. */
export const newPasswordField = z
  .string()
  .min(10, 'At least 10 characters')
  .max(100, 'At most 100 characters')

export const PASSWORD_HINT = '10–100 characters.'

/** New password + confirmation fields; pair with `passwordsMatch` in `.refine`. */
export const newPasswordShape = { newPassword: newPasswordField, confirm: z.string() }

export const passwordsMatch = (v: { newPassword: string; confirm: string }) =>
  v.newPassword === v.confirm

export const passwordsMismatchError = { path: ['confirm'], message: 'Passwords don’t match' }
