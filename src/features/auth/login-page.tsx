import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/app/auth'

const loginSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
})

type LoginValues = z.infer<typeof loginSchema>

function errorMessage(code: string | undefined, detail: string | undefined): string {
  if (code === 'ACCOUNT_LOCKED') return 'Account locked for 15 minutes after repeated failures.'
  if (code === 'UNAUTHENTICATED') return 'Invalid email or password.'
  return detail ?? 'Sign-in failed. Try again.'
}

export function LoginPage() {
  const { login, status } = useAuth()
  const navigate = useNavigate()
  const { reason } = useSearch({ strict: false }) as { reason?: string }
  const [serverError, setServerError] = useState<string | null>(null)
  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  // Already signed in (e.g. session shared from another tab) → go to the app.
  useEffect(() => {
    if (status === 'authenticated') void navigate({ to: '/' })
  }, [status, navigate])

  async function onSubmit(values: LoginValues) {
    setServerError(null)
    const result = await login(values.email, values.password)
    if (result.ok) {
      void navigate({ to: '/' })
    } else {
      setServerError(errorMessage(result.problem?.code, result.problem?.detail))
    }
  }

  return (
    <div className="bg-canvas dark:bg-canvas-dark flex min-h-screen items-center justify-center px-4">
      <Card className="shadow-brand w-full max-w-md rounded-2xl">
        <CardHeader className="space-y-1 text-center">
          <div className="bg-brand mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-2xl text-xl font-extrabold text-white">
            A
          </div>
          <CardTitle className="text-2xl font-extrabold">AllianceTrading Admin</CardTitle>
          <CardDescription>Sign in with your admin account</CardDescription>
          {reason === 'expired' ? (
            <p
              role="status"
              className="bg-brand-soft text-brand-dark dark:bg-brand/20 rounded-xl px-4 py-3 text-sm font-semibold dark:text-white"
            >
              Your session ended, please sign in again.
            </p>
          ) : null}
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="email"
                        autoComplete="username"
                        placeholder="admin@alliancetrading.local"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input {...field} type="password" autoComplete="current-password" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {serverError ? (
                <p role="alert" className="text-destructive text-sm font-semibold">
                  {serverError}
                </p>
              ) : null}
              <Button
                type="submit"
                className="bg-brand hover:bg-brand-dark w-full rounded-xl"
                disabled={form.formState.isSubmitting}
              >
                {form.formState.isSubmitting ? 'Signing in…' : 'Sign in'}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
