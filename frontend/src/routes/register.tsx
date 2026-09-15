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
import { emailField, passwordField, userNameField } from '#/lib/forms'
import { FieldError } from './login'

const schema = z.object({
  userName: userNameField,
  email: emailField,
  password: passwordField,
})
type Values = z.infer<typeof schema>

export const Route = createFileRoute('/register')({ component: RegisterPage })

function RegisterPage() {
  const { t } = useTranslation()
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { userName: '', email: '', password: '' },
  })

  const register = useMutation({
    mutationFn: (values: Values) => api.post('/auth/register', values),
    onError: (error) => toast.error(t(errorKey(error))),
  })

  // The API answers the same way whether or not the address is taken, so the
  // screen can't reveal it either.
  if (register.isSuccess) {
    return (
      <Card className="mx-auto w-full max-w-md">
        <CardHeader>
          <CardTitle>{t('auth.register.checkInbox')}</CardTitle>
          <CardDescription>{t('auth.register.checkInboxBody')}</CardDescription>
        </CardHeader>
        <CardFooter>
          <Button asChild variant="outline">
            <Link to="/login">{t('common.signIn')}</Link>
          </Button>
        </CardFooter>
      </Card>
    )
  }

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader>
        <CardTitle>{t('auth.register.title')}</CardTitle>
        <CardDescription>{t('auth.register.subtitle')}</CardDescription>
      </CardHeader>

      <form onSubmit={form.handleSubmit((values) => register.mutate(values))}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="userName">{t('auth.register.userName')}</Label>
            <Input
              id="userName"
              autoComplete="name"
              {...form.register('userName')}
            />
            <FieldError message={form.formState.errors.userName?.message} />
          </div>

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
              autoComplete="new-password"
              {...form.register('password')}
            />
            <FieldError message={form.formState.errors.password?.message} />
          </div>
        </CardContent>

        <CardFooter className="mt-6 flex-col items-stretch gap-3">
          <Button type="submit" disabled={register.isPending}>
            {t('auth.register.submit')}
          </Button>
          <p className="text-muted-foreground text-sm">
            {t('auth.register.haveAccount')}{' '}
            <Link to="/login" className="text-primary font-medium">
              {t('common.signIn')}
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  )
}
