import { createRouter as createTanStackRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'

import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query'
import { getContext } from './integrations/tanstack-query/root-provider'
import { ErrorScreen, NotFoundScreen } from '#/components/error-screen'
import { session } from '#/lib/auth/session'

export function getRouter() {
  const context = getContext()

  const router = createTanStackRouter({
    routeTree,
    context: { ...context, session },
    scrollRestoration: true,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
    // Without these, a thrown route error or an unknown URL renders nothing.
    defaultErrorComponent: ({ reset }) => <ErrorScreen reset={reset} />,
    defaultNotFoundComponent: () => <NotFoundScreen />,
  })

  setupRouterSsrQueryIntegration({ router, queryClient: context.queryClient })

  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
