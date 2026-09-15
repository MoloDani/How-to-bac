import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'

/** Everything under here needs a signed-in user. */
export const Route = createFileRoute('/_app')({
  beforeLoad: async ({ context, location }) => {
    const user = await context.session.ensureLoaded()
    if (!user) {
      throw redirect({ to: '/login', search: { redirect: location.href } })
    }
  },
  component: () => <Outlet />,
})
