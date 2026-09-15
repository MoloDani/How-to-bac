import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { z } from 'zod'
import { Button } from '#/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '#/components/ui/dialog'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Textarea } from '#/components/ui/textarea'
import { errorKey } from '#/lib/api/errors'
import { createThread } from '#/lib/queries/threads'
import type { Subject } from '#/lib/subjects'

// Same limits the API enforces.
const schema = z.object({
  title: z.string().trim().min(1, 'errors.required').max(120, 'errors.tooLong'),
  content: z
    .string()
    .trim()
    .min(1, 'errors.required')
    .max(4000, 'errors.tooLong'),
})
type Values = z.infer<typeof schema>

export function NewThreadDialog({ subject }: { subject: Subject }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { title: '', content: '' },
  })

  const create = useMutation({
    mutationFn: (values: Values) => createThread(subject, values),
    onSuccess: (thread) => {
      setOpen(false)
      form.reset()
      void navigate({
        to: '/threads/$threadId',
        params: { threadId: thread.id },
      })
    },
    onError: (error) => toast.error(t(errorKey(error))),
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-4" />
          {t('threads.new')}
        </Button>
      </DialogTrigger>

      <DialogContent>
        <form onSubmit={form.handleSubmit((values) => create.mutate(values))}>
          <DialogHeader>
            <DialogTitle>{t('threads.new')}</DialogTitle>
            <DialogDescription>{t('subjects.' + subject)}</DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="thread-title">{t('threads.titleLabel')}</Label>
              <Input id="thread-title" {...form.register('title')} />
              {form.formState.errors.title ? (
                <p className="text-destructive text-sm">
                  {t(form.formState.errors.title.message ?? '')}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="thread-content">
                {t('threads.firstMessage')}
              </Label>
              <Textarea
                id="thread-content"
                rows={5}
                {...form.register('content')}
              />
              {form.formState.errors.content ? (
                <p className="text-destructive text-sm">
                  {t(form.formState.errors.content.message ?? '')}
                </p>
              ) : null}
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button type="submit" disabled={create.isPending}>
              {t('threads.publish')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
