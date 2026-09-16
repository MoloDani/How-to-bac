import { Link, useNavigate } from '@tanstack/react-router'
import { LogOut, User } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { LanguageSwitcher } from '#/components/language-switcher'
import { ThemeToggle } from '#/components/theme-toggle'
import { Button } from '#/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import { session } from '#/lib/auth/session'
import { useSession } from '#/lib/auth/use-session'

export function SiteHeader() {
  const { t } = useTranslation()
  const user = useSession()
  const navigate = useNavigate()

  const signOut = async () => {
    await session.signOut()
    void navigate({ to: '/login' })
  }

  return (
    <header className="border-border/60 bg-background/80 sticky top-0 z-30 border-b backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-4xl items-center gap-2 px-4">
        <Link to="/" className="font-bold tracking-tight">
          {t('common.appName')}
        </Link>

        {user ? (
          <nav className="text-muted-foreground mr-auto flex items-center gap-4 text-sm">
            <Link to="/subjects" className="hover:text-foreground">
              {t('nav.subjects')}
            </Link>
            <Link to="/friends" className="hover:text-foreground">
              {t('nav.friends')}
            </Link>
          </nav>
        ) : (
          <div className="mr-auto" />
        )}

        <LanguageSwitcher />
        <ThemeToggle />

        {user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label={user.userName}>
                <User className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel className="truncate">
                {user.userName}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/profile">{t('nav.profile')}</Link>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void signOut()}>
                <LogOut className="size-4" />
                {t('common.signOut')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button asChild size="sm">
            <Link to="/login">{t('common.signIn')}</Link>
          </Button>
        )}
      </div>
    </header>
  )
}
