import { Pencil, Reply, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AuthorMenu } from '#/components/author-menu'
import { ConfirmDialog } from '#/components/confirm-dialog'
import { RelativeTime } from '#/components/relative-time'
import { Button } from '#/components/ui/button'
import { Textarea } from '#/components/ui/textarea'
import type { Message, PublicUser } from '#/lib/api/types'
import { canDeleteMessage, canEditMessage } from '#/lib/permissions'
import type { Subject } from '#/lib/subjects'

export function MessageItem({
  message,
  replyTo,
  subject,
  user,
  canReply,
  onReply,
  onEdit,
  onDelete,
}: {
  message: Message
  /** The message this one answers, when it's on screen. */
  replyTo?: Message
  subject: Subject
  user: PublicUser
  canReply: boolean
  onReply: (message: Message) => void
  onEdit: (messageId: string, content: string) => void
  onDelete: (messageId: string) => void
}) {
  const { t } = useTranslation()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(message.content ?? '')
  const [confirming, setConfirming] = useState(false)

  const save = () => {
    const content = draft.trim()
    if (content && content !== message.content) onEdit(message.id, content)
    setEditing(false)
  }

  return (
    <article className="group border-border/60 border-b py-4 last:border-0">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        <AuthorMenu author={message.author} />
        {message.author ? (
          <span className="text-muted-foreground font-mono text-xs">
            @{message.author.tag}
          </span>
        ) : null}
        <span className="text-muted-foreground">
          <RelativeTime value={message.createdAt} />
        </span>
        {message.edited ? (
          <span className="text-muted-foreground text-xs">
            {t('threads.edited')}
          </span>
        ) : null}

        <div className="ml-auto flex gap-1 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
          {canReply && !message.deleted ? (
            <Button
              variant="ghost"
              size="icon"
              aria-label={t('threads.reply')}
              onClick={() => onReply(message)}
            >
              <Reply className="size-4" />
            </Button>
          ) : null}
          {canEditMessage(user, message) ? (
            <Button
              variant="ghost"
              size="icon"
              aria-label={t('threads.edit')}
              onClick={() => {
                setDraft(message.content ?? '')
                setEditing(true)
              }}
            >
              <Pencil className="size-4" />
            </Button>
          ) : null}
          {canDeleteMessage(user, subject, message) ? (
            <Button
              variant="ghost"
              size="icon"
              aria-label={t('threads.delete')}
              onClick={() => setConfirming(true)}
            >
              <Trash2 className="size-4" />
            </Button>
          ) : null}
        </div>
      </div>

      {replyTo ? (
        <p className="text-muted-foreground border-border mt-2 truncate border-l-2 pl-3 text-xs">
          {t('threads.replyingTo', {
            name: replyTo.author?.userName ?? t('threads.deletedAccount'),
          })}
          : {replyTo.content ?? t('threads.deletedMessage')}
        </p>
      ) : null}

      {message.deleted ? (
        <p className="text-muted-foreground mt-2 text-sm italic">
          {t('threads.deletedMessage')}
        </p>
      ) : editing ? (
        <div className="mt-2 space-y-2">
          <Textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={3}
            autoFocus
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={save}>
              {t('common.save')}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              {t('common.cancel')}
            </Button>
          </div>
        </div>
      ) : (
        <p className="mt-2 break-words whitespace-pre-wrap">
          {message.content}
        </p>
      )}

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t('threads.deleteMessageTitle')}
        description={t('threads.deleteMessageBody')}
        confirmLabel={t('threads.delete')}
        onConfirm={() => onDelete(message.id)}
      />
    </article>
  )
}
