import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link, createFileRoute } from '@tanstack/react-router'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { z } from 'zod'

import { TagInput } from '#/components/tag-input'
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
import { emailField, passwordField, tagField, userNameField } from '#/lib/forms'
import { tagAvailableQuery, useDebounced } from '#/lib/queries/tags'
import { FieldError } from './login'

const schema = z
  .object({
    userName: userNameField,
    tag: tagField,
    email: emailField,
    password: passwordField,
    confirmPassword: z.string().min(1, 'errors.required'),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'errors.passwordsDontMatch',
  })
type Values = z.infer<typeof schema>

export const Route = createFileRoute('/register')({ component: RegisterPage })

function RegisterPage() {
  const { t } = useTranslation()
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      userName: '',
      tag: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  })

  // Checked once typing pauses, so the tag box doesn't fire a request per key.
  const tag = useDebounced(form.watch('tag'))
  const availability = useQuery(tagAvailableQuery(tag))
  const taken = availability.data?.available === false

  const register = useMutation({
    // The confirmation never leaves the browser.
    mutationFn: ({ confirmPassword: _, ...values }: Values) =>
      api.post('/auth/register', values),
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
            <Label htmlFor="tag">{t('auth.register.tag')}</Label>
            <Controller
              control={form.control}
              name="tag"
              render={({ field }) => (
                <TagInput
                  id="tag"
                  autoComplete="username"
                  placeholder="andrei_m"
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                />
              )}
            />
            {form.formState.errors.tag ? (
              <FieldError message={form.formState.errors.tag.message} />
            ) : (
              <TagAvailability
                pending={availability.isFetching}
                taken={taken}
                available={availability.data?.available === true}
              />
            )}
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

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">{t('auth.confirmPassword')}</Label>
            <Input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              {...form.register('confirmPassword')}
            />
            <FieldError
              message={form.formState.errors.confirmPassword?.message}
            />
          </div>
        </CardContent>

        <CardFooter className="mt-6 flex-col items-stretch gap-3">
          <Button type="submit" disabled={register.isPending || taken}>
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

/** The line under the tag box: a hint, then taken or free. */
function TagAvailability({
  pending,
  taken,
  available,
}: {
  pending: boolean
  taken: boolean
  available: boolean
}) {
  const { t } = useTranslation()

  if (taken) {
    return <p className="text-destructive text-sm">{t('errors.tagTaken')}</p>
  }
  if (available && !pending) {
    return (
      <p className="text-sm text-emerald-600 dark:text-emerald-400">
        {t('auth.register.tagFree')}
      </p>
    )
  }
  return (
    <p className="text-muted-foreground text-sm">
      {t('auth.register.tagHint')}
    </p>
  )
}
