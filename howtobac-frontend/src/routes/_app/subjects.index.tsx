import { Link, createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { EmptyState } from '#/components/empty-state'
import { Button } from '#/components/ui/button'
import { useSession } from '#/lib/auth/use-session'
import { visibleSubjects } from '#/lib/permissions'

export const Route = createFileRoute('/_app/subjects/')({
  component: SubjectsPage,
})

function SubjectsPage() {
  const { t } = useTranslation()
  const user = useSession()
  if (!user) return null

  const subjects = visibleSubjects(user)

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">
        {t('threads.subjectsTitle')}
      </h1>

      {subjects.length === 0 ? (
        <EmptyState
          title={t('threads.subjectsEmpty')}
          description={t('threads.subjectsEmptyHint')}
          action={
            <Button asChild size="sm">
              <Link to="/profile">{t('threads.choose')}</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {subjects.map((subject) => (
            <Link
              key={subject}
              to="/subjects/$subject"
              params={{ subject: subject.toLowerCase() }}
              className="border-border/60 hover:border-primary/50 hover:bg-accent/40 rounded-xl border p-4 font-medium transition"
            >
              {t(`subjects.${subject}`)}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
