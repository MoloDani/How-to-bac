import {
  HeadContent,
  Scripts,
  createRootRouteWithContext,
} from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import { ThemeProvider } from 'next-themes'

import TanStackQueryDevtools from '../integrations/tanstack-query/devtools'

import { SiteHeader } from '#/components/site-header'
import { Toaster } from '#/components/ui/sonner'
// Side-effect import: sets up i18next before anything renders.
import '#/lib/i18n'

import appCss from '../styles.css?url'

import type { QueryClient } from '@tanstack/react-query'
import type { session } from '#/lib/auth/session'

interface MyRouterContext {
  queryClient: QueryClient
  /** Lets route guards await the session before deciding to redirect. */
  session: typeof session
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'How to Bac' },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ro" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          storageKey="howtobac.theme"
          disableTransitionOnChange
        >
          <div className="flex min-h-svh flex-col">
            <SiteHeader />
            <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10">
              {children}
            </main>
          </div>
          <Toaster richColors position="top-center" />
        </ThemeProvider>

        <TanStackDevtools
          config={{ position: 'bottom-right' }}
          plugins={[
            {
              name: 'Tanstack Router',
              render: <TanStackRouterDevtoolsPanel />,
            },
            TanStackQueryDevtools,
          ]}
        />
        <Scripts />
      </body>
    </html>
  )
}
