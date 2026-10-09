import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Check, Copy, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { z } from 'zod'

import { Badge } from '#/components/ui/badge'
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
import { api, setAccessToken } from '#/lib/api/client'
import { errorKey } from '#/lib/api/errors'
import type { PublicUser } from '#/lib/api/types'
import { session } from '#/lib/auth/session'
import { useSession } from '#/lib/auth/use-session'
import { TagInput } from '#/components/tag-input'
import { ConfirmDialog } from '#/components/confirm-dialog'
import {
  currentPasswordField,
  emailField,
  normalizeTag,
  passwordField,
  tagField,
  userNameField,
} from '#/lib/forms'
import {
  changePassword,
  deleteAccount,
  requestEmailChange,
} from '#/lib/queries/account'
import { MAX_SUBJECTS, SUBJECTS } from '#/lib/subjects'
import type { Subject } from '#/lib/subjects'
import { FieldError } from '../login'

export const Route = createFileRoute('/_app/profile')({
  component: ProfilePage,
})

const nameSchema = z.object({ userName: userNameField })
type NameValues = z.infer<typeof nameSchema>

const tagSchema = z.object({ tag: tagField })
type TagValues = z.infer<typeof tagSchema>

const passwordSchema = z
  .object({
    currentPassword: currentPasswordField,
    newPassword: passwordField,
    confirmPassword: currentPasswordField,
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'errors.passwordsDontMatch',
  })
type PasswordValues = z.infer<typeof passwordSchema>

const emailChangeSchema = z.object({
  newEmail: emailField,
  currentPassword: currentPasswordField,
})
type EmailValues = z.infer<typeof emailChangeSchema>

function ProfilePage() {
  const { t } = useTranslation()
  const user = useSession()

  if (!user) return null

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">
        {t('profile.title')}
      </h1>
      <AccountCard user={user} />
      <SubjectsCard user={user} />
      <TagCard user={user} />
      <EmailCard user={user} />
      <PasswordCard />
      <DangerZoneCard user={user} />
    </div>
  )
}

function AccountCard({ user }: { user: PublicUser }) {
  const { t } = useTranslation()
  const form = useForm<NameValues>({
    resolver: zodResolver(nameSchema),
    defaultValues: { userName: user.userName },
  })

  const rename = useMutation({
    mutationFn: (values: NameValues) => api.patch<PublicUser>('/me', values),
    onSuccess: (updated) => {
      session.set(updated)
      form.reset({ userName: updated.userName })
      toast.success(t('profile.nameSaved'))
    },
    onError: (error) => toast.error(t(errorKey(error))),
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('profile.account')}</CardTitle>
        <CardDescription className="flex flex-wrap items-center gap-2">
          <span className="font-mono">{user.email}</span>
          <Badge variant="secondary">{t(`profile.role.${user.role}`)}</Badge>
          <Badge variant={user.emailVerified ? 'default' : 'destructive'}>
            {user.emailVerified
              ? t('profile.verified')
              : t('profile.unverified')}
          </Badge>
        </CardDescription>
      </CardHeader>

      <form onSubmit={form.handleSubmit((values) => rename.mutate(values))}>
        <CardContent className="space-y-2">
          <Label htmlFor="userName">{t('profile.nameLabel')}</Label>
          <Input id="userName" {...form.register('userName')} />
          <FieldError message={form.formState.errors.userName?.message} />
        </CardContent>
        <CardFooter className="mt-6">
          <Button
            type="submit"
            disabled={rename.isPending || !form.formState.isDirty}
          >
            {rename.isPending ? t('common.saving') : t('common.save')}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}

function SubjectsCard({ user }: { user: PublicUser }) {
  const { t } = useTranslation()
  const [picked, setPicked] = useState<Array<Subject>>(user.subjects)
  // Contributors and admins get their subjects from an administrator.
  const editable = user.role === 'USER'

  const save = useMutation({
    mutationFn: (subjects: Array<Subject>) =>
      api.put<PublicUser>('/me/subjects', { subjects }),
    onSuccess: (updated) => {
      session.set(updated)
      setPicked(updated.subjects)
      toast.success(t('profile.subjects.saved'))
    },
    onError: (error) => toast.error(t(errorKey(error))),
  })

  const toggle = (subject: Subject) => {
    if (picked.includes(subject)) {
      setPicked(picked.filter((s) => s !== subject))
      return
    }
    if (picked.length >= MAX_SUBJECTS) {
      toast.info(t('profile.subjects.limitReached', { count: MAX_SUBJECTS }))
      return
    }
    setPicked([...picked, subject])
  }

  const changed =
    picked.length !== user.subjects.length ||
    picked.some((s) => !user.subjects.includes(s))

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('profile.subjects.title')}</CardTitle>
        <CardDescription>
          {editable
            ? t('profile.subjects.hint', { count: MAX_SUBJECTS })
            : t('profile.subjects.managed')}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-wrap gap-2">
        {SUBJECTS.map((subject) => {
          const selected = picked.includes(subject)
          return (
            <Button
              key={subject}
              type="button"
              size="sm"
              variant={selected ? 'default' : 'outline'}
              disabled={!editable}
              aria-pressed={selected}
              onClick={() => toggle(subject)}
            >
              {selected ? <Check className="size-4" /> : null}
              {t(`subjects.${subject}`)}
            </Button>
          )
        })}
      </CardContent>

      {editable ? (
        <CardFooter className="mt-6">
          <Button
            disabled={!changed || save.isPending}
            onClick={() => save.mutate(picked)}
          >
            {save.isPending ? t('common.saving') : t('common.save')}
          </Button>
        </CardFooter>
      ) : null}
    </Card>
  )
}

function TagCard({ user }: { user: PublicUser }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  const form = useForm<TagValues>({
    resolver: zodResolver(tagSchema),
    defaultValues: { tag: user.tag },
  })

  const rename = useMutation({
    mutationFn: (values: TagValues) => api.patch<PublicUser>('/me', values),
    onSuccess: (updated) => {
      session.set(updated)
      form.reset({ tag: updated.tag })
      toast.success(t('profile.tag.saved'))
    },
    onError: (error) => toast.error(t(errorKey(error))),
  })

  const copy = async () => {
    await navigator.clipboard.writeText(`@${user.tag}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('profile.tag.title')}</CardTitle>
        <CardDescription>{t('profile.tag.hint')}</CardDescription>
      </CardHeader>

      <form onSubmit={form.handleSubmit((values) => rename.mutate(values))}>
        <CardContent className="space-y-2">
          <Label htmlFor="tag">{t('profile.tag.label')}</Label>
          <div className="flex flex-wrap items-center gap-3">
            <Controller
              control={form.control}
              name="tag"
              render={({ field }) => (
                <TagInput
                  id="tag"
                  className="max-w-xs"
                  autoComplete="username"
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                />
              )}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void copy()}
            >
              {copied ? (
                <Check className="size-4" />
              ) : (
                <Copy className="size-4" />
              )}
              {copied ? t('common.copied') : t('common.copy')}
            </Button>
          </div>
          <FieldError message={form.formState.errors.tag?.message} />
        </CardContent>

        <CardFooter className="mt-6">
          <Button
            type="submit"
            disabled={rename.isPending || !form.formState.isDirty}
          >
            {rename.isPending ? t('common.saving') : t('common.save')}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}

function EmailCard({ user }: { user: PublicUser }) {
  const { t } = useTranslation()
  const form = useForm<EmailValues>({
    resolver: zodResolver(emailChangeSchema),
    defaultValues: { newEmail: '', currentPassword: '' },
  })

  const request = useMutation({
    mutationFn: requestEmailChange,
    onSuccess: () => {
      form.reset({ newEmail: '', currentPassword: '' })
      toast.success(t('profile.email.sent'))
    },
    onError: (error) => toast.error(t(errorKey(error))),
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('profile.email.title')}</CardTitle>
        <CardDescription>{t('profile.email.hint')}</CardDescription>
      </CardHeader>

      <form onSubmit={form.handleSubmit((values) => request.mutate(values))}>
        <CardContent className="space-y-4">
          {user.pendingEmail ? (
            <p className="bg-muted rounded-lg px-3 py-2 text-sm">
              {t('profile.email.pending', { email: user.pendingEmail })}
            </p>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="newEmail">{t('profile.email.newLabel')}</Label>
            <Input
              id="newEmail"
              type="email"
              autoComplete="email"
              {...form.register('newEmail')}
            />
            <FieldError message={form.formState.errors.newEmail?.message} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="emailPassword">
              {t('profile.currentPassword')}
            </Label>
            <Input
              id="emailPassword"
              type="password"
              autoComplete="current-password"
              {...form.register('currentPassword')}
            />
            <FieldError
              message={form.formState.errors.currentPassword?.message}
            />
          </div>
        </CardContent>

        <CardFooter className="mt-6">
          <Button type="submit" disabled={request.isPending}>
            {request.isPending ? t('common.saving') : t('profile.email.submit')}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}

function PasswordCard() {
  const { t } = useTranslation()
  const form = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  })

  const change = useMutation({
    mutationFn: (values: PasswordValues) =>
      changePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      }),
    onSuccess: () => {
      form.reset({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      })
      toast.success(t('profile.password.saved'))
    },
    onError: (error) => toast.error(t(errorKey(error))),
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('profile.password.title')}</CardTitle>
        <CardDescription>{t('profile.password.hint')}</CardDescription>
      </CardHeader>

      <form onSubmit={form.handleSubmit((values) => change.mutate(values))}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="currentPassword">
              {t('profile.currentPassword')}
            </Label>
            <Input
              id="currentPassword"
              type="password"
              autoComplete="current-password"
              {...form.register('currentPassword')}
            />
            <FieldError
              message={form.formState.errors.currentPassword?.message}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="newPassword">{t('auth.reset.newPassword')}</Label>
            <Input
              id="newPassword"
              type="password"
              autoComplete="new-password"
              {...form.register('newPassword')}
            />
            <FieldError message={form.formState.errors.newPassword?.message} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmNewPassword">
              {t('auth.confirmPassword')}
            </Label>
            <Input
              id="confirmNewPassword"
              type="password"
              autoComplete="new-password"
              {...form.register('confirmPassword')}
            />
            <FieldError
              message={form.formState.errors.confirmPassword?.message}
            />
          </div>
        </CardContent>

        <CardFooter className="mt-6">
          <Button type="submit" disabled={change.isPending}>
            {change.isPending ? t('common.saving') : t('common.save')}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}

/** Closing the account: the password, and your own tag typed out. */
function DangerZoneCard({ user }: { user: PublicUser }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [typedTag, setTypedTag] = useState('')
  const [confirming, setConfirming] = useState(false)

  const remove = useMutation({
    mutationFn: () => deleteAccount(password),
    onSuccess: () => {
      setAccessToken(null)
      session.set(null)
      toast.success(t('profile.danger.deleted'))
      void navigate({ to: '/login' })
    },
    onError: (error) => toast.error(t(errorKey(error))),
  })

  const ready = password.length > 0 && normalizeTag(typedTag) === user.tag

  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <CardTitle className="text-destructive flex items-center gap-2">
          <TriangleAlert className="size-4" />
          {t('profile.danger.title')}
        </CardTitle>
        <CardDescription>{t('profile.danger.hint')}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="deleteTag">
            {t('profile.danger.typeTag', { tag: `@${user.tag}` })}
          </Label>
          <TagInput
            id="deleteTag"
            className="max-w-xs"
            autoComplete="off"
            value={typedTag}
            onChange={setTypedTag}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="deletePassword">{t('profile.currentPassword')}</Label>
          <Input
            id="deletePassword"
            type="password"
            autoComplete="current-password"
            className="max-w-xs"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>
      </CardContent>

      <CardFooter className="mt-6">
        <Button
          type="button"
          variant="destructive"
          disabled={!ready || remove.isPending}
          onClick={() => setConfirming(true)}
        >
          {t('profile.danger.submit')}
        </Button>
      </CardFooter>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t('profile.danger.confirmTitle')}
        description={t('profile.danger.confirmBody')}
        confirmLabel={t('profile.danger.submit')}
        onConfirm={() => remove.mutate()}
      />
    </Card>
  )
}
