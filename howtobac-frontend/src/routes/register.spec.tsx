import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Route as RegisterRoute } from './register'
// Side-effect import: i18next has to be initialised before anything renders.
import '#/lib/i18n'

/** Answers the availability check; `taken` lists the tags that aren't free. */
function stubApi(taken: Array<string> = []) {
  const fetchMock = vi.fn((input: RequestInfo | URL) => {
    const url = String(input)
    if (url.includes('/auth/tag-available')) {
      const tag = new URL(url, 'http://localhost').searchParams.get('tag') ?? ''
      return Promise.resolve(
        new Response(JSON.stringify({ available: !taken.includes(tag) }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    }
    return Promise.resolve(new Response('{}', { status: 202 }))
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

/**
 * The page on its own, with just enough router for the "sign in" link — the
 * real app shell would drag in devtools and the stylesheet.
 */
function renderRegisterPage() {
  const rootRoute = createRootRoute()
  const router = createRouter({
    routeTree: rootRoute.addChildren([
      createRoute({
        getParentRoute: () => rootRoute,
        path: '/register',
        component: RegisterRoute.options.component,
      }),
      createRoute({
        getParentRoute: () => rootRoute,
        path: '/login',
        component: () => null,
      }),
    ]),
    history: createMemoryHistory({ initialEntries: ['/register'] }),
    // jsdom has no scrollTo, and this harness never navigates anyway.
    scrollRestoration: false,
  })

  render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router as never} />
    </QueryClientProvider>,
  )
  return userEvent.setup()
}

const field = (name: RegExp) => screen.getByLabelText<HTMLInputElement>(name)
/** The only button the page renders on its own. */
const submitButton = () =>
  screen.getByRole<HTMLButtonElement>('button', {
    name: /creează cont|create account/i,
  })

describe('register page', () => {
  beforeEach(() => {
    stubApi()
    // jsdom doesn't implement it, and the router calls it on mount.
    vi.stubGlobal('scrollTo', () => undefined)
  })

  it('turns what you type into a tag', async () => {
    const user = renderRegisterPage()
    const tag = await waitFor(() => field(/tag/i))

    await user.type(tag, '@Andrei_M')
    expect(tag.value).toBe('andrei_m')
  })

  it('refuses to send when the passwords differ', async () => {
    const fetchMock = stubApi()
    const user = renderRegisterPage()
    await waitFor(() => field(/tag/i))

    await user.type(field(/name|nume/i), 'Andrei')
    await user.type(field(/tag/i), 'andrei_m')
    await user.type(field(/email/i), 'andrei@example.com')
    await user.type(field(/^(password|parolă)$/i), 'a-good-password')
    await user.type(field(/confirm/i), 'a-different-password')
    await user.click(submitButton())

    expect(await screen.findByText(/match|coincid/i)).toBeDefined()
    const posted = fetchMock.mock.calls.filter(([url]) =>
      String(url).includes('/auth/register'),
    )
    expect(posted).toHaveLength(0)
  })

  it('will not submit a tag someone already has', async () => {
    stubApi(['andrei_m'])
    const user = renderRegisterPage()
    await waitFor(() => field(/tag/i))

    const submit = submitButton()
    expect(submit.disabled).toBe(false)

    await user.type(field(/tag/i), 'andrei_m')
    await waitFor(() => expect(submit.disabled).toBe(true), { timeout: 3000 })
  })
})
