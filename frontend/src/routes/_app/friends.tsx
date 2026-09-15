import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { Check, Copy, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { EmptyState } from '#/components/empty-state'
import { RelativeTime } from '#/components/relative-time'
import { Button } from '#/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '#/components/ui/dialog'
import { Input } from '#/components/ui/input'
import { Skeleton } from '#/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '#/components/ui/tabs'
import { errorKey } from '#/lib/api/errors'
import type { UserSummary } from '#/lib/api/types'
import { useSession } from '#/lib/auth/use-session'
import {
  acceptRequest,
  blocksQuery,
  blockUser,
  friendKeys,
  friendsQuery,
  removeRequest,
  requestsQuery,
  sendFriendRequest,
  unblockUser,
  unfriend,
} from '#/lib/queries/friends'
import type { RequestDirection } from '#/lib/queries/friends'

export const Route = createFileRoute('/_app/friends')({
  component: FriendsPage,
})

function FriendsPage() {
  const { t } = useTranslation()
  const user = useSession()
  if (!user) return null

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold tracking-tight">
          {t('friends.title')}
        </h1>
        <AddByCodeDialog />
      </div>

      <MyCodeCard friendCode={user.friendCode} />

      <Tabs defaultValue="friends">
        <TabsList>
          <TabsTrigger value="friends">{t('friends.tabs.friends')}</TabsTrigger>
          <TabsTrigger value="incoming">
            {t('friends.tabs.incoming')}
          </TabsTrigger>
          <TabsTrigger value="outgoing">
            {t('friends.tabs.outgoing')}
          </TabsTrigger>
          <TabsTrigger value="blocked">{t('friends.tabs.blocked')}</TabsTrigger>
        </TabsList>

        <TabsContent value="friends" className="mt-4">
          <FriendsList />
        </TabsContent>
        <TabsContent value="incoming" className="mt-4">
          <RequestsList direction="incoming" />
        </TabsContent>
        <TabsContent value="outgoing" className="mt-4">
          <RequestsList direction="outgoing" />
        </TabsContent>
        <TabsContent value="blocked" className="mt-4">
          <BlockedList />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function MyCodeCard({ friendCode }: { friendCode: string }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    await navigator.clipboard.writeText(friendCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('friends.myCode')}</CardTitle>
        <CardDescription>{t('friends.myCodeHint')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-3">
        <code className="bg-muted rounded-lg px-4 py-2 font-mono text-xl tracking-[0.3em]">
          {friendCode}
        </code>
        <Button variant="outline" size="sm" onClick={() => void copy()}>
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          {copied ? t('common.copied') : t('common.copy')}
        </Button>
      </CardContent>
    </Card>
  )
}

function AddByCodeDialog() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [code, setCode] = useState('')

  const add = useMutation({
    mutationFn: () => sendFriendRequest(code),
    onSuccess: async (relationship) => {
      setOpen(false)
      setCode('')
      await queryClient.invalidateQueries({ queryKey: friendKeys.all })
      toast.success(
        relationship.state === 'FRIENDS'
          ? t('friends.nowFriends', { name: relationship.user.userName })
          : t('friends.requestSent'),
      )
    },
    onError: (error) => toast.error(t(errorKey(error))),
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <UserPlus className="size-4" />
          {t('friends.addByCode')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('friends.addByCode')}</DialogTitle>
          <DialogDescription>{t('friends.addByCodeHint')}</DialogDescription>
        </DialogHeader>
        <Input
          value={code}
          placeholder="K7MQ-2XPA"
          className="font-mono tracking-widest uppercase"
          onChange={(event) => setCode(event.target.value)}
        />
        <DialogFooter>
          <Button
            disabled={!code.trim() || add.isPending}
            onClick={() => add.mutate()}
          >
            {t('friends.add')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** One person plus the actions that apply to them. */
function UserRow({
  user,
  meta,
  children,
}: {
  user: UserSummary
  meta?: string
  children: React.ReactNode
}) {
  return (
    <li className="border-border/60 flex flex-wrap items-center gap-3 border-b py-3 last:border-0">
      <div className="min-w-0">
        <p className="truncate font-medium">{user.userName}</p>
        {meta ? <p className="text-muted-foreground text-xs">{meta}</p> : null}
      </div>
      <div className="ml-auto flex gap-2">{children}</div>
    </li>
  )
}

function useFriendAction() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (action: () => Promise<unknown>) => action(),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: friendKeys.all }),
    onError: (error) => toast.error(t(errorKey(error))),
  })
}

function FriendsList() {
  const { t } = useTranslation()
  const friends = useInfiniteQuery(friendsQuery())
  const act = useFriendAction()
  const items = friends.data?.pages.flatMap((page) => page.items) ?? []

  if (friends.isPending) return <Skeleton className="h-24 w-full" />
  if (items.length === 0) {
    return (
      <EmptyState
        title={t('friends.empty.friends')}
        description={t('friends.addNeedsCode')}
      />
    )
  }

  return (
    <ul>
      {items.map(({ user, since }) => (
        <UserRow key={user.id} user={user} meta={t('friends.since')}>
          <RelativeTime value={since} />
          <Button
            size="sm"
            variant="outline"
            onClick={() => act.mutate(() => unfriend(user.id))}
          >
            {t('friends.actions.unfriend')}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => act.mutate(() => blockUser(user.id))}
          >
            {t('friends.actions.block')}
          </Button>
        </UserRow>
      ))}
    </ul>
  )
}

function RequestsList({ direction }: { direction: RequestDirection }) {
  const { t } = useTranslation()
  const requests = useInfiniteQuery(requestsQuery(direction))
  const act = useFriendAction()
  const items = requests.data?.pages.flatMap((page) => page.items) ?? []

  if (requests.isPending) return <Skeleton className="h-24 w-full" />
  if (items.length === 0) {
    return <EmptyState title={t(`friends.empty.${direction}`)} />
  }

  return (
    <ul>
      {items.map(({ user, createdAt }) => (
        <UserRow key={user.id} user={user}>
          <RelativeTime value={createdAt} />
          {direction === 'incoming' ? (
            <Button
              size="sm"
              onClick={() => act.mutate(() => acceptRequest(user.id))}
            >
              {t('friends.actions.accept')}
            </Button>
          ) : null}
          <Button
            size="sm"
            variant="outline"
            onClick={() => act.mutate(() => removeRequest(user.id))}
          >
            {direction === 'incoming'
              ? t('friends.actions.decline')
              : t('friends.actions.cancel')}
          </Button>
        </UserRow>
      ))}
    </ul>
  )
}

function BlockedList() {
  const { t } = useTranslation()
  const blocks = useInfiniteQuery(blocksQuery())
  const act = useFriendAction()
  const items = blocks.data?.pages.flatMap((page) => page.items) ?? []

  if (blocks.isPending) return <Skeleton className="h-24 w-full" />
  if (items.length === 0) {
    return <EmptyState title={t('friends.empty.blocked')} />
  }

  return (
    <ul>
      {items.map(({ user, createdAt }) => (
        <UserRow key={user.id} user={user}>
          <RelativeTime value={createdAt} />
          <Button
            size="sm"
            variant="outline"
            onClick={() => act.mutate(() => unblockUser(user.id))}
          >
            {t('friends.actions.unblock')}
          </Button>
        </UserRow>
      ))}
    </ul>
  )
}
