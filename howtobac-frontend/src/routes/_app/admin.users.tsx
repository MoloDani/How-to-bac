import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { Check, Search } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { EmptyState } from '#/components/empty-state'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import { Input } from '#/components/ui/input'
import { Skeleton } from '#/components/ui/skeleton'
import { errorKey } from '#/lib/api/errors'
import type { PublicUser, Role } from '#/lib/api/types'
import { session } from '#/lib/auth/session'
import { useSession } from '#/lib/auth/use-session'
import { useDebounced } from '#/lib/queries/tags'
import {
  adminKeys,
  adminUsersQuery,
  setUserRole,
  setUserSubjects,
} from '#/lib/queries/admin'
import { SUBJECTS } from '#/lib/subjects'
import type { Subject } from '#/lib/subjects'

const ROLES: Array<Role> = ['USER', 'CONTRIBUTOR', 'ADMIN']

export const Route = createFileRoute('/_app/admin/users')({
  component: AdminUsersPage,
})

function AdminUsersPage() {
  const { t } = useTranslation()
  const me = useSession()
  const [search, setSearch] = useState('')
  const users = useInfiniteQuery(adminUsersQuery(useDebounced(search)))
  const [editing, setEditing] = useState<PublicUser | null>(null)

  const items = users.data?.pages.flatMap((page) => page.items) ?? []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          {t('admin.users.title')}
        </h1>
        <p className="text-muted-foreground text-sm">{t('admin.users.hint')}</p>
      </div>

      <div className="relative max-w-sm">
        <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input
          className="pl-9"
          placeholder={t('admin.users.search')}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      {users.isPending ? (
        <Skeleton className="h-40 w-full" />
      ) : items.length === 0 ? (
        <EmptyState title={t('admin.users.empty')} />
      ) : (
        <ul>
          {items.map((user) => (
            <UserRow
              key={user.id}
              user={user}
              isSelf={user.id === me?.id}
              search={search}
              onEditSubjects={() => setEditing(user)}
            />
          ))}
        </ul>
      )}

      {users.hasNextPage ? (
        <Button
          variant="outline"
          disabled={users.isFetchingNextPage}
          onClick={() => void users.fetchNextPage()}
        >
          {t('admin.users.loadMore')}
        </Button>
      ) : null}

      <SubjectsDialog
        user={editing}
        onClose={() => setEditing(null)}
        search={search}
      />
    </div>
  )
}

/** Shared by both mutations: refresh the list, and your own session if it was you. */
function useAdminAction(search: string) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const me = useSession()

  return useMutation({
    mutationFn: (action: () => Promise<PublicUser>) => action(),
    onSuccess: async (updated) => {
      if (updated.id === me?.id) session.set(updated)
      await queryClient.invalidateQueries({ queryKey: adminKeys.users(search) })
    },
    onError: (error) => toast.error(t(errorKey(error))),
  })
}

function UserRow({
  user,
  isSelf,
  search,
  onEditSubjects,
}: {
  user: PublicUser
  isSelf: boolean
  search: string
  onEditSubjects: () => void
}) {
  const { t } = useTranslation()
  const act = useAdminAction(search)

  return (
    <li className="border-border/60 flex flex-wrap items-center gap-3 border-b py-3 last:border-0">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">
          {user.userName}
          {isSelf ? (
            <span className="text-muted-foreground text-xs">
              {' '}
              · {t('admin.users.you')}
            </span>
          ) : null}
        </p>
        <p className="text-muted-foreground truncate text-xs">
          <span className="font-mono">@{user.tag}</span> · {user.email}
          {user.emailVerified ? '' : ` · ${t('profile.unverified')}`}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {user.subjects.length > 0 ? (
          <Badge variant="secondary">
            {t('admin.users.subjectCount', { count: user.subjects.length })}
          </Badge>
        ) : null}

        <Button size="sm" variant="outline" onClick={onEditSubjects}>
          {t('admin.users.subjects')}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="ghost" disabled={act.isPending}>
              {t(`profile.role.${user.role}`)}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {ROLES.map((role) => (
              <DropdownMenuItem
                key={role}
                disabled={role === user.role}
                onSelect={() => act.mutate(() => setUserRole(user.id, role))}
              >
                {role === user.role ? <Check className="size-4" /> : null}
                {t(`profile.role.${role}`)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
  )
}

/** Admins assign any number of subjects — the 3-subject cap is for self-picking. */
function SubjectsDialog({
  user,
  onClose,
  search,
}: {
  user: PublicUser | null
  onClose: () => void
  search: string
}) {
  const { t } = useTranslation()
  const act = useAdminAction(search)
  const [picked, setPicked] = useState<Array<Subject>>([])
  const [openFor, setOpenFor] = useState<string | null>(null)

  // Load the selection the first time this user's dialog opens.
  if (user && openFor !== user.id) {
    setOpenFor(user.id)
    setPicked(user.subjects)
  }

  const toggle = (subject: Subject) =>
    setPicked(
      picked.includes(subject)
        ? picked.filter((s) => s !== subject)
        : [...picked, subject],
    )

  return (
    <Dialog open={user !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('admin.users.subjects')}</DialogTitle>
          <DialogDescription>{user ? `@${user.tag}` : null}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2">
          {SUBJECTS.map((subject) => {
            const selected = picked.includes(subject)
            return (
              <Button
                key={subject}
                type="button"
                size="sm"
                variant={selected ? 'default' : 'outline'}
                aria-pressed={selected}
                onClick={() => toggle(subject)}
              >
                {selected ? <Check className="size-4" /> : null}
                {t(`subjects.${subject}`)}
              </Button>
            )
          })}
        </div>

        <DialogFooter>
          <Button
            disabled={act.isPending || !user}
            onClick={() => {
              if (!user) return
              act.mutate(() => setUserSubjects(user.id, picked), {
                onSuccess: () => {
                  toast.success(t('admin.users.subjectsSaved'))
                  onClose()
                },
              })
            }}
          >
            {t('common.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
