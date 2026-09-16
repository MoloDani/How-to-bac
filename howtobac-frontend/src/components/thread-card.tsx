import { Link } from '@tanstack/react-router'
import { Lock, MessageSquare, Pin } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { RelativeTime } from '#/components/relative-time'
import { Badge } from '#/components/ui/badge'
import type { Thread } from '#/lib/api/types'

export function ThreadCard({ thread }: { thread: Thread }) {
  const { t } = useTranslation()

  return (
    <Link
      to="/threads/$threadId"
      params={{ threadId: thread.id }}
      className="border-border/60 hover:border-primary/50 hover:bg-accent/40 block rounded-xl border p-4 transition"
    >
      <div className="flex flex-wrap items-center gap-2">
        {thread.pinned ? (
          <Badge variant="secondary">
            <Pin className="size-3" />
            {t('threads.pinned')}
          </Badge>
        ) : null}
        {thread.locked ? (
          <Badge variant="outline">
            <Lock className="size-3" />
            {t('threads.locked')}
          </Badge>
        ) : null}
        <h3 className="font-medium">{thread.title}</h3>
      </div>

      <p className="text-muted-foreground mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <span>
          {thread.author?.userName ?? t('threads.deletedAccount')}
          {thread.author ? (
            <span className="text-muted-foreground font-mono">
              {' '}
              @{thread.author.tag}
            </span>
          ) : null}
        </span>
        <span className="inline-flex items-center gap-1">
          <MessageSquare className="size-3" />
          {t('threads.messageCount', { count: thread.messageCount })}
        </span>
        <RelativeTime value={thread.lastMessageAt} />
      </p>
    </Link>
  )
}
