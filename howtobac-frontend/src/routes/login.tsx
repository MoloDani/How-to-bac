import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import {
  Link,
  createFileRoute,
  useNavigate,
  useRouter,
} from '@tanstack/react-router'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { z } from 'zod'

import { Alert, AlertDescription, AlertTitle } from '#/components/ui/alert'
import { Button } from '#/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { ApiError, api, setAccessToken } from '#/lib/api/client'
import { errorKey } from '#/lib/api/errors'
import type { LoginResponse } from '#/lib/api/types'
import { session } from '#/lib/auth/session'
import { currentPasswordField, emailField } from '#/lib/forms'

const schema = z.object({ email: emailField, password: currentPasswordField })
type Values = z.infer<typeof schema>

export const Route = createFileRoute('/login')({
  validateSearch: z.object({ redirect: z.string().optional() }),
  component: LoginPage,
})

function LoginPage() {
  const { t } = useTranslation()
  const router = useRouter()
  const navigate = useNavigate()
  const { redirect } = Route.useSearch()
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null)

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  })

  const login = useMutation({
    mutationFn: (values: Values) =>
      api.post<LoginResponse>('/auth/login', values),
    onSuccess: (data) => {
      setAccessToken(data.accessToken)
      session.set(data.user)
      if (redirect) router.history.push(redirect)
      else void navigate({ to: '/profile' })
    },
    onError: (error) => {
      // Not a failure to shout about: the account exists, it just isn't confirmed.
      if (error instanceof ApiError && error.code === 'email_not_verified') {
        setUnverifiedEmail(form.getValues('email'))
        return
      }
      toast.error(t(errorKey(error)))
    },
  })

  const resend = useMutation({
    mutationFn: (email: string) =>
      api.post('/auth/resend-verification', { email }),
    onSuccess: () => toast.success(t('auth.login.resent')),
    onError: (error) => toast.error(t(errorKey(error))),
  })

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader>
        <CardTitle>{t('auth.login.title')}</CardTitle>
        <CardDescription>{t('auth.login.subtitle')}</CardDescription>
      </CardHeader>

      <form onSubmit={form.handleSubmit((values) => login.mutate(values))}>
        <CardContent className="space-y-4">
          {unverifiedEmail ? (
            <Alert>
              <AlertTitle>{t('auth.login.unverified')}</AlertTitle>
              <AlertDescription>
                <Button
                  type="button"
                  variant="link"
                  className="h-auto p-0"
                  disabled={resend.isPending}
                  onClick={() => resend.mutate(unverifiedEmail)}
                >
                  {t('auth.login.resend')}
                </Button>
              </AlertDescription>
            </Alert>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="email">{t('auth.email')}</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              {...form.register('email')}
            />
            <FieldError message={form.formState.errors.email?.message} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">{t('auth.password')}</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              {...form.register('password')}
            />
            <FieldError message={form.formState.errors.password?.message} />
          </div>
        </CardContent>

        <CardFooter className="mt-6 flex-col items-stretch gap-3">
          <Button type="submit" disabled={login.isPending}>
            {t('auth.login.submit')}
          </Button>
          <div className="text-muted-foreground flex justify-between text-sm">
            <Link to="/forgot-password" className="hover:text-foreground">
              {t('auth.login.forgot')}
            </Link>
            <span>
              {t('auth.login.noAccount')}{' '}
              <Link to="/register" className="text-primary font-medium">
                {t('auth.login.register')}
              </Link>
            </span>
          </div>
        </CardFooter>
      </form>
    </Card>
  )
}

export function FieldError({ message }: { message?: string }) {
  const { t } = useTranslation()
  if (!message) return null
  return <p className="text-destructive text-sm">{t(message)}</p>
}
