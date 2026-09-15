import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import {
  Lock,
  LockOpen,
  MoreHorizontal,
  Pencil,
  Pin,
  Trash2,
} from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { ConfirmDialog } from '#/components/confirm-dialog'
import { EmptyState } from '#/components/empty-state'
import { MessageComposer } from '#/components/message-composer'
import { MessageItem } from '#/components/message-item'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import { Input } from '#/components/ui/input'
import { Skeleton } from '#/components/ui/skeleton'
import { errorKey } from '#/lib/api/errors'
import type { Message } from '#/lib/api/types'
import { useSession } from '#/lib/auth/use-session'
import { canEditThread, canModerate, canPost } from '#/lib/permissions'
import {
  deleteMessage,
  deleteThread,
  editMessage,
  messagesQuery,
  moderateThread,
  postMessage,
  renameThread,
  threadKeys,
  threadQuery,
} from '#/lib/queries/threads'

export const Route = createFileRoute('/_app/threads/$threadId')({
  component: ThreadPage,
})

function ThreadPage() {
  const { t } = useTranslation()
  const { threadId } = Route.useParams()
  const user = useSession()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [replyTo, setReplyTo] = useState<Message | null>(null)
  const [renaming, setRenaming] = useState(false)
  const [title, setTitle] = useState('')
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const thread = useQuery(threadQuery(threadId))
  const messages = useInfiniteQuery({
    ...messagesQuery(threadId),
    enabled: thread.isSuccess,
  })

  /** Message counts and last-activity ordering change with almost every action. */
  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: threadKeys.messages(threadId),
      }),
      queryClient.invalidateQueries({ queryKey: threadKeys.detail(threadId) }),
      queryClient.invalidateQueries({ queryKey: threadKeys.all }),
    ])
  }

  const onError = (error: unknown) => toast.error(t(errorKey(error)))

  const send = useMutation({
    mutationFn: (content: string) =>
      postMessage(threadId, {
        content,
        ...(replyTo ? { replyToId: replyTo.id } : {}),
      }),
    onSuccess: async () => {
      setReplyTo(null)
      await refresh()
    },
    onError,
  })

  const edit = useMutation({
    mutationFn: (input: { id: string; content: string }) =>
      editMessage(input.id, input.content),
    onSuccess: refresh,
    onError,
  })

  const removeMessage = useMutation({
    mutationFn: (messageId: string) => deleteMessage(messageId),
    onSuccess: refresh,
    onError,
  })

  const moderate = useMutation({
    mutationFn: (body: { pinned?: boolean; locked?: boolean }) =>
      moderateThread(threadId, body),
    onSuccess: refresh,
    onError,
  })

  const rename = useMutation({
    mutationFn: (next: string) => renameThread(threadId, next),
    onSuccess: async () => {
      setRenaming(false)
      await refresh()
    },
    onError,
  })

  const destroy = useMutation({
    mutationFn: () => deleteThread(threadId),
    onSuccess: async () => {
      const subject = thread.data?.subject
      await queryClient.invalidateQueries({ queryKey: threadKeys.all })
      void navigate(
        subject
          ? {
              to: '/subjects/$subject',
              params: { subject: subject.toLowerCase() },
            }
          : { to: '/subjects' },
      )
    },
    onError,
  })

  if (!user) return null

  if (thread.isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-2/3" />
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  if (thread.isError) {
    return (
      <EmptyState
        title={t('threads.notFound')}
        description={t('threads.notFoundBody')}
        action={
          <Button asChild variant="outline" size="sm">
            <Link to="/subjects">{t('nav.subjects')}</Link>
          </Button>
        }
      />
    )
  }

  const data = thread.data
  const items = messages.data?.pages.flatMap((page) => page.items) ?? []
  const byId = new Map(items.map((message) => [message.id, message]))
  const moderator = canModerate(user, data.subject)

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Link
          to="/subjects/$subject"
          params={{ subject: data.subject.toLowerCase() }}
          className="text-muted-foreground hover:text-foreground text-sm"
        >
          ← {t(`subjects.${data.subject}`)}
        </Link>

        <div className="flex flex-wrap items-start gap-3">
          <h1 className="text-2xl font-bold tracking-tight">{data.title}</h1>
          {data.pinned ? (
            <Badge variant="secondary">{t('threads.pinned')}</Badge>
          ) : null}
          {data.locked ? (
            <Badge variant="outline">{t('threads.locked')}</Badge>
          ) : null}

          {canEditThread(user, data) ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="ml-auto"
                  aria-label={t('threads.moderation')}
                >
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onSelect={() => {
                    setTitle(data.title)
                    setRenaming(true)
                  }}
                >
                  <Pencil className="size-4" />
                  {t('threads.rename')}
                </DropdownMenuItem>

                {moderator ? (
                  <>
                    <DropdownMenuItem
                      onSelect={() => moderate.mutate({ pinned: !data.pinned })}
                    >
                      <Pin className="size-4" />
                      {data.pinned ? t('threads.unpin') : t('threads.pin')}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => moderate.mutate({ locked: !data.locked })}
                    >
                      {data.locked ? (
                        <LockOpen className="size-4" />
                      ) : (
                        <Lock className="size-4" />
                      )}
                      {data.locked ? t('threads.unlock') : t('threads.lock')}
                    </DropdownMenuItem>
                  </>
                ) : null}

                <DropdownMenuItem
                  variant="destructive"
                  onSelect={() => setConfirmingDelete(true)}
                >
                  <Trash2 className="size-4" />
                  {t('threads.deleteThread')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </div>

      <div>
        {messages.isPending ? (
          <Skeleton className="h-24 w-full" />
        ) : (
          items.map((message) => (
            <MessageItem
              key={message.id}
              message={message}
              replyTo={
                message.replyToId ? byId.get(message.replyToId) : undefined
              }
              subject={data.subject}
              user={user}
              canReply={canPost(user, data)}
              onReply={setReplyTo}
              onEdit={(id, content) => edit.mutate({ id, content })}
              onDelete={(id) => removeMessage.mutate(id)}
            />
          ))
        )}

        {messages.hasNextPage ? (
          <Button
            variant="outline"
            className="mt-4"
            disabled={messages.isFetchingNextPage}
            onClick={() => void messages.fetchNextPage()}
          >
            {t('threads.loadMore')}
          </Button>
        ) : null}
      </div>

      <MessageComposer
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
        onSend={(content) => send.mutate(content)}
        pending={send.isPending}
        disabled={!canPost(user, data)}
        disabledNotice={t('threads.lockedNotice')}
      />

      <Dialog open={renaming} onOpenChange={setRenaming}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('threads.renameTitle')}</DialogTitle>
          </DialogHeader>
          <Input
            value={title}
            maxLength={120}
            onChange={(event) => setTitle(event.target.value)}
          />
          <DialogFooter>
            <Button
              disabled={!title.trim() || rename.isPending}
              onClick={() => rename.mutate(title.trim())}
            >
              {t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmingDelete}
        onOpenChange={setConfirmingDelete}
        title={t('threads.deleteThreadTitle')}
        description={t('threads.deleteThreadBody')}
        confirmLabel={t('threads.deleteThread')}
        onConfirm={() => destroy.mutate()}
      />
    </div>
  )
}
