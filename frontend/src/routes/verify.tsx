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
import { api } from '#/lib/api/client'

/** The link in the verification email: <APP_BASE_URL>/verify?token=… */
export const Route = createFileRoute('/verify')({
  validateSearch: z.object({ token: z.string().optional() }),
  component: VerifyPage,
})

function VerifyPage() {
  const { t } = useTranslation()
  const { token } = Route.useSearch()

  const verify = useMutation({
    mutationFn: (value: string) =>
      api.post('/auth/verify-email', { token: value }),
  })

  // Tokens are single-use, so this must fire exactly once, even in StrictMode.
  const started = useRef(false)
  useEffect(() => {
    if (!token || started.current) return
    started.current = true
    verify.mutate(token)
  }, [token, verify])

  const failed = !token || verify.isError
  const done = verify.isSuccess

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader>
        <CardTitle>
          {done
            ? t('auth.verify.success')
            : failed
              ? t('auth.verify.failed')
              : t('auth.verify.working')}
        </CardTitle>
        <CardDescription>
          {done
            ? t('auth.verify.successBody')
            : failed
              ? t('auth.verify.failedBody')
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
