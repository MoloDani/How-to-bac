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
import { emailField } from '#/lib/forms'
import { FieldError } from './login'

const schema = z.object({ email: emailField })
type Values = z.infer<typeof schema>

export const Route = createFileRoute('/forgot-password')({
  component: ForgotPasswordPage,
})

function ForgotPasswordPage() {
  const { t } = useTranslation()
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: '' },
  })

  const forgot = useMutation({
    mutationFn: (values: Values) => api.post('/auth/forgot-password', values),
    onError: (error) => toast.error(t(errorKey(error))),
  })

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader>
        <CardTitle>{t('auth.forgot.title')}</CardTitle>
        <CardDescription>
          {forgot.isSuccess ? t('auth.forgot.sent') : t('auth.forgot.subtitle')}
        </CardDescription>
      </CardHeader>

      {forgot.isSuccess ? (
        <CardFooter>
          <Button asChild variant="outline">
            <Link to="/login">{t('common.back')}</Link>
          </Button>
        </CardFooter>
      ) : (
        <form onSubmit={form.handleSubmit((values) => forgot.mutate(values))}>
          <CardContent className="space-y-2">
            <Label htmlFor="email">{t('auth.email')}</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              {...form.register('email')}
            />
            <FieldError message={form.formState.errors.email?.message} />
          </CardContent>
          <CardFooter className="mt-6">
            <Button type="submit" disabled={forgot.isPending}>
              {t('auth.forgot.submit')}
            </Button>
          </CardFooter>
        </form>
      )}
    </Card>
  )
}
