import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { EmptyState } from '#/components/empty-state'
import { Button } from '#/components/ui/button'

/** Shown by the router when a route throws, instead of a blank page. */
export function ErrorScreen({ reset }: { reset?: () => void }) {
  const { t } = useTranslation()

  return (
    <EmptyState
      title={t('errors.pageCrashed')}
      description={t('errors.pageCrashedBody')}
      action={
        <div className="flex flex-wrap justify-center gap-2">
          <Button
            size="sm"
            onClick={() => (reset ? reset() : location.reload())}
          >
            {t('common.retry')}
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link to="/">{t('common.goHome')}</Link>
          </Button>
        </div>
      }
    />
  )
}

/** Shown for a URL no route matches — a stale link, or a typo. */
export function NotFoundScreen() {
  const { t } = useTranslation()

  return (
    <EmptyState
      title={t('errors.pageMissing')}
      description={t('errors.pageMissingBody')}
      action={
        <Button asChild size="sm" variant="outline">
          <Link to="/">{t('common.goHome')}</Link>
        </Button>
      }
    />
  )
}
