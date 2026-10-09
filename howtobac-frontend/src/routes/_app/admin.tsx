import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'

/** Admin-only. The API enforces it too; this keeps the screens out of sight. */
export const Route = createFileRoute('/_app/admin')({
  beforeLoad: async ({ context }) => {
    const user = await context.session.ensureLoaded()
    if (user?.role !== 'ADMIN') throw redirect({ to: '/profile' })
  },
  component: () => <Outlet />,
})
