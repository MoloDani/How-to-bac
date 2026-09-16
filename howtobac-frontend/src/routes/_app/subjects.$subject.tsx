import { useInfiniteQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { EmptyState } from '#/components/empty-state'
import { NewThreadDialog } from '#/components/new-thread-dialog'
import { ThreadCard } from '#/components/thread-card'
import { Button } from '#/components/ui/button'
import { Skeleton } from '#/components/ui/skeleton'
import { useSession } from '#/lib/auth/use-session'
import { canOpenSubject } from '#/lib/permissions'
import { threadListQuery } from '#/lib/queries/threads'
import { SUBJECTS } from '#/lib/subjects'
import type { Subject } from '#/lib/subjects'

export const Route = createFileRoute('/_app/subjects/$subject')({
  component: SubjectThreadsPage,
})

function SubjectThreadsPage() {
  const { t } = useTranslation()
  const params = Route.useParams()
  const user = useSession()

  const subject = params.subject.toUpperCase() as Subject
  const known = (SUBJECTS as ReadonlyArray<string>).includes(subject)
  const allowed = Boolean(user && known && canOpenSubject(user, subject))

  const threads = useInfiniteQuery({
    ...threadListQuery(subject),
    enabled: allowed,
  })

  if (!user) return null

  if (!known || !allowed) {
    return (
      <EmptyState
        title={known ? t('threads.noAccess') : t('threads.unknownSubject')}
        description={known ? t('threads.noAccessBody') : undefined}
      />
    )
  }

  const items = threads.data?.pages.flatMap((page) => page.items) ?? []

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold tracking-tight">
          {t(`subjects.${subject}`)}
        </h1>
        <NewThreadDialog subject={subject} />
      </div>

      {threads.isPending ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          title={t('threads.empty')}
          description={t('threads.emptyHint')}
        />
      ) : (
        <div className="space-y-3">
          {items.map((thread) => (
            <ThreadCard key={thread.id} thread={thread} />
          ))}
        </div>
      )}

      {threads.hasNextPage ? (
        <Button
          variant="outline"
          disabled={threads.isFetchingNextPage}
          onClick={() => void threads.fetchNextPage()}
        >
          {t('threads.loadMore')}
        </Button>
      ) : null}
    </div>
  )
}
