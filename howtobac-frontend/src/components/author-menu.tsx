import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import { errorKey } from '#/lib/api/errors'
import type { UserSummary } from '#/lib/api/types'
import { useSession } from '#/lib/auth/use-session'
import {
  acceptRequest,
  blockUser,
  friendKeys,
  relationshipQuery,
  removeRequest,
  sendFriendRequest,
  unblockUser,
  unfriend,
} from '#/lib/queries/friends'

/**
 * An author's name, with what you can do about them. The relationship is only
 * fetched once the menu opens; their tag comes with the message, so adding
 * them is one click from here.
 */
export function AuthorMenu({ author }: { author: UserSummary | null }) {
  const { t } = useTranslation()
  const me = useSession()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)

  const isSelf = me?.id === author?.id
  const relationship = useQuery({
    ...relationshipQuery(author?.id ?? ''),
    enabled: open && Boolean(author) && !isSelf,
  })

  const act = useMutation({
    mutationFn: (action: () => Promise<unknown>) => action(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: friendKeys.all })
      setOpen(false)
    },
    onError: (error) => toast.error(t(errorKey(error))),
  })

  if (!author) {
    return (
      <span className="text-muted-foreground italic">
        {t('threads.deletedAccount')}
      </span>
    )
  }
  if (isSelf) return <span className="font-medium">{author.userName}</span>

  const state = relationship.data?.state
  const run = (action: () => Promise<unknown>) => () => act.mutate(action)

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button type="button" className="font-medium hover:underline">
          {author.userName}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60">
        <DropdownMenuLabel className="truncate">
          {author.userName}
          <span className="text-muted-foreground block font-mono text-xs font-normal">
            @{author.tag}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {relationship.isPending ? (
          <DropdownMenuLabel className="text-muted-foreground text-xs font-normal">
            {t('common.loading')}
          </DropdownMenuLabel>
        ) : null}

        {state === 'NONE' ? (
          <DropdownMenuItem onSelect={run(() => sendFriendRequest(author.tag))}>
            {t('friends.actions.add')}
          </DropdownMenuItem>
        ) : null}

        {state === 'REQUEST_RECEIVED' ? (
          <DropdownMenuItem onSelect={run(() => acceptRequest(author.id))}>
            {t('friends.actions.accept')}
          </DropdownMenuItem>
        ) : null}

        {state === 'REQUEST_SENT' ? (
          <DropdownMenuItem onSelect={run(() => removeRequest(author.id))}>
            {t('friends.actions.cancel')}
          </DropdownMenuItem>
        ) : null}

        {state === 'FRIENDS' ? (
          <DropdownMenuItem onSelect={run(() => unfriend(author.id))}>
            {t('friends.actions.unfriend')}
          </DropdownMenuItem>
        ) : null}

        {state === 'BLOCKED' ? (
          <DropdownMenuItem onSelect={run(() => unblockUser(author.id))}>
            {t('friends.actions.unblock')}
          </DropdownMenuItem>
        ) : state ? (
          <DropdownMenuItem
            variant="destructive"
            onSelect={run(() => blockUser(author.id))}
          >
            {t('friends.actions.block')}
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
