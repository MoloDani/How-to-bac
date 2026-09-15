import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { Link, createFileRoute } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { z } from 'zod'

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
import { api } from '#/lib/api/client'
import { errorKey } from '#/lib/api/errors'
import { passwordField } from '#/lib/forms'
import { FieldError } from './login'

const schema = z.object({ password: passwordField })
type Values = z.infer<typeof schema>

/** The link in the password-reset email: <APP_BASE_URL>/reset?token=… */
export const Route = createFileRoute('/reset')({
  validateSearch: z.object({ token: z.string().optional() }),
  component: ResetPage,
})

function ResetPage() {
  const { t } = useTranslation()
  const { token } = Route.useSearch()

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { password: '' },
  })

  const reset = useMutation({
    mutationFn: (values: Values) =>
      api.post('/auth/reset-password', { token, password: values.password }),
    onError: (error) => toast.error(t(errorKey(error))),
  })

  if (reset.isSuccess) {
    return (
      <Card className="mx-auto w-full max-w-md">
        <CardHeader>
          <CardTitle>{t('auth.reset.success')}</CardTitle>
          <CardDescription>{t('auth.reset.successBody')}</CardDescription>
        </CardHeader>
        <CardFooter>
          <Button asChild>
            <Link to="/login">{t('common.signIn')}</Link>
          </Button>
        </CardFooter>
      </Card>
    )
  }

  if (!token) {
    return (
      <Card className="mx-auto w-full max-w-md">
        <CardHeader>
          <CardTitle>{t('auth.verify.failed')}</CardTitle>
          <CardDescription>{t('errors.invalidToken')}</CardDescription>
        </CardHeader>
        <CardFooter>
          <Button asChild variant="outline">
            <Link to="/forgot-password">{t('auth.forgot.submit')}</Link>
          </Button>
        </CardFooter>
      </Card>
    )
  }

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader>
        <CardTitle>{t('auth.reset.title')}</CardTitle>
      </CardHeader>

      <form onSubmit={form.handleSubmit((values) => reset.mutate(values))}>
        <CardContent className="space-y-2">
          <Label htmlFor="password">{t('auth.reset.newPassword')}</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            {...form.register('password')}
          />
          <FieldError message={form.formState.errors.password?.message} />
        </CardContent>
        <CardFooter className="mt-6">
          <Button type="submit" disabled={reset.isPending}>
            {t('auth.reset.submit')}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
