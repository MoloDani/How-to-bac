import { SendHorizonal, X } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '#/components/ui/button'
import { Textarea } from '#/components/ui/textarea'
import type { Message } from '#/lib/api/types'

const MAX_LENGTH = 4000

export function MessageComposer({
  replyTo,
  onCancelReply,
  onSend,
  disabled,
  disabledNotice,
  pending,
}: {
  replyTo: Message | null
  onCancelReply: () => void
  onSend: (content: string) => void
  disabled?: boolean
  disabledNotice?: string
  pending?: boolean
}) {
  const { t } = useTranslation()
  const [content, setContent] = useState('')

  if (disabled) {
    return (
      <p className="text-muted-foreground border-border/60 rounded-xl border border-dashed px-4 py-3 text-sm">
        {disabledNotice}
      </p>
    )
  }

  const send = () => {
    const text = content.trim()
    if (!text) return
    onSend(text)
    setContent('')
  }

  return (
    <div className="space-y-2">
      {replyTo ? (
        <div className="text-muted-foreground flex items-center gap-2 text-xs">
          <span className="truncate">
            {t('threads.replyingTo', {
              name: replyTo.author?.userName ?? t('threads.deletedAccount'),
            })}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="size-6"
            aria-label={t('common.cancel')}
            onClick={onCancelReply}
          >
            <X className="size-3" />
          </Button>
        </div>
      ) : null}

      <Textarea
        value={content}
        maxLength={MAX_LENGTH}
        rows={3}
        placeholder={t('threads.placeholder')}
        onChange={(event) => setContent(event.target.value)}
        // Enter sends, Shift+Enter starts a new line.
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault()
            send()
          }
        }}
      />

      <div className="flex items-center justify-between">
        <span className="text-muted-foreground text-xs">
          {t('threads.sendHint')}
        </span>
        <Button size="sm" disabled={pending || !content.trim()} onClick={send}>
          <SendHorizonal className="size-4" />
          {t('threads.send')}
        </Button>
      </div>
    </div>
  )
}
