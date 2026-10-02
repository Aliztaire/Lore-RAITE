'use client'

import { useAuth } from '@/components/auth-provider'
import { auth } from '@/lib/firebase'
import { signOut } from 'firebase/auth'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ChevronsUpDown, LogOut } from 'lucide-react'

export function UserProfile() {
  const { user } = useAuth()

  if (!user) return null

  const getInitials = (name: string | null) => {
    if (!name) return 'U'
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase()
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="group w-full flex items-center gap-3 rounded-full px-2 py-2 text-left transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring/30 hover:text-highlight-strong">
        <Avatar className="h-8 w-8 border border-border">
          <AvatarImage src={user.photoURL || undefined} alt="" />
          <AvatarFallback className="bg-muted text-muted-foreground text-xs font-medium">
            {getInitials(user.displayName)}
          </AvatarFallback>
        </Avatar>
        <span className="flex-1 min-w-0">
          <span className="block text-sm text-foreground truncate group-hover:text-highlight-strong transition-colors duration-150">{user.displayName || 'User'}</span>
          {user.email && <span className="block text-xs text-subtle-foreground truncate">{user.email}</span>}
        </span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 text-subtle-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" className="w-56">
        <DropdownMenuLabel>
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium leading-none">{user.displayName || 'User'}</p>
            <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => { if (auth) signOut(auth) }} disabled={!auth} variant="destructive" className="cursor-pointer">
          <LogOut className="mr-2 h-4 w-4" />
          <span>Sign out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
