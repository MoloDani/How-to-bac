import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { Check, Copy, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
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
import { api } from '#/lib/api/client'
import { errorKey } from '#/lib/api/errors'
import type { PublicUser } from '#/lib/api/types'
import { session } from '#/lib/auth/session'
import { useSession } from '#/lib/auth/use-session'
import { userNameField } from '#/lib/forms'
import { MAX_SUBJECTS, SUBJECTS } from '#/lib/subjects'
import type { Subject } from '#/lib/subjects'
import { FieldError } from '../login'

export const Route = createFileRoute('/_app/profile')({
  component: ProfilePage,
})

const nameSchema = z.object({ userName: userNameField })
type NameValues = z.infer<typeof nameSchema>

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
      <FriendCodeCard user={user} />
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

function FriendCodeCard({ user }: { user: PublicUser }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)

  const rotate = useMutation({
    mutationFn: () => api.post<{ friendCode: string }>('/me/friend-code'),
    onSuccess: ({ friendCode }) => {
      session.set({ ...user, friendCode })
      toast.success(t('profile.friendCode.rotated'))
    },
    onError: (error) => toast.error(t(errorKey(error))),
  })

  const copy = async () => {
    await navigator.clipboard.writeText(user.friendCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('profile.friendCode.title')}</CardTitle>
        <CardDescription>{t('profile.friendCode.hint')}</CardDescription>
      </CardHeader>

      <CardContent className="flex flex-wrap items-center gap-3">
        <code className="bg-muted rounded-lg px-4 py-2 font-mono text-xl tracking-[0.3em]">
          {user.friendCode}
        </code>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void copy()}
        >
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          {copied ? t('common.copied') : t('common.copy')}
        </Button>
      </CardContent>

      <CardFooter className="mt-6">
        <Button
          variant="ghost"
          size="sm"
          disabled={rotate.isPending}
          onClick={() => rotate.mutate()}
        >
          <RefreshCw className="size-4" />
          {t('profile.friendCode.rotate')}
        </Button>
      </CardFooter>
    </Card>
  )
}
