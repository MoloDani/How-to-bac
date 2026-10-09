import { useMutation } from '@tanstack/react-query'
import { Link, createFileRoute } from '@tanstack/react-router'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import { Button } from '#/components/ui/button'
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
import { errorKey } from '#/lib/api/errors'
import { confirmEmailChange } from '#/lib/queries/account'

/** The link mailed to the new address: <APP_BASE_URL>/confirm-email?token=… */
export const Route = createFileRoute('/confirm-email')({
  validateSearch: z.object({ token: z.string().optional() }),
  component: ConfirmEmailPage,
})

function ConfirmEmailPage() {
  const { t } = useTranslation()
  const { token } = Route.useSearch()

  const confirm = useMutation({ mutationFn: confirmEmailChange })

  // Tokens are single-use, so this must fire exactly once, even in StrictMode.
  const started = useRef(false)
  useEffect(() => {
    if (!token || started.current) return
    started.current = true
    confirm.mutate(token)
  }, [token, confirm])

  const failed = !token || confirm.isError
  const done = confirm.isSuccess

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader>
        <CardTitle>
          {done
            ? t('auth.confirmEmail.success')
            : failed
              ? t('auth.confirmEmail.failed')
              : t('auth.confirmEmail.working')}
        </CardTitle>
        <CardDescription>
          {done
            ? t('auth.confirmEmail.successBody')
            : failed
              ? t(
                  confirm.error
                    ? errorKey(confirm.error)
                    : 'errors.invalidToken',
                )
              : null}
        </CardDescription>
      </CardHeader>
      {done || failed ? (
        <CardFooter>
          <Button asChild>
            <Link to="/login">{t('common.signIn')}</Link>
          </Button>
        </CardFooter>
      ) : null}
    </Card>
  )
}
