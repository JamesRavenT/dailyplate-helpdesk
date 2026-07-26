import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { Lock, LockOpen, Pencil, Trash2, UserPlus, UsersRound } from 'lucide-react'
import { Skeleton } from '../components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import CreateUserDialog from '../components/CreateUserDialog'
import EditUserDialog from '../components/EditUserDialog'
import DeleteUserDialog from '../components/DeleteUserDialog'
import LockUserDialog from '../components/LockUserDialog'

type AgentStatus = 'ONLINE' | 'AWAY' | 'MEETING' | 'OFFLINE'

type User = {
  id: string
  name: string
  email: string
  role: 'ADMIN' | 'AGENT'
  is_active: boolean
  online_status: AgentStatus
  createdAt: string
}

function onlineDot(status: AgentStatus) {
  switch (status) {
    case 'ONLINE':  return 'bg-status-resolved'
    case 'AWAY':    return 'bg-status-inprogress'
    case 'MEETING': return 'bg-status-danger'
    default:        return 'bg-muted-foreground/45'
  }
}

function onlineLabel(status: AgentStatus) {
  switch (status) {
    case 'ONLINE':  return 'Online'
    case 'AWAY':    return 'Away'
    case 'MEETING': return 'Meeting'
    default:        return 'Offline'
  }
}

async function fetchUsers(): Promise<User[]> {
  const { data } = await axios.get<User[]>('/api/users')
  return data
}

export default function Users() {
  const { data: users, isPending, error, refetch } = useQuery({ queryKey: ['users'], queryFn: fetchUsers })
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [deletingUser, setDeletingUser] = useState<User | null>(null)
  const [lockingUser, setLockingUser] = useState<User | null>(null)

  return (
    <div>
      <div className="mx-auto max-w-7xl">
        <header className="mb-5 flex items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-h1 font-semibold tracking-tight text-foreground">Users</h1>
              {users && !error ? (
                <span className="tabular rounded-full bg-muted px-2.5 py-1 text-caption font-medium text-muted-foreground">
                  {users.length} {users.length === 1 ? 'user' : 'users'}
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-body text-muted-foreground">Manage support access, roles, and account security.</p>
          </div>
          <Button onClick={() => setDialogOpen(true)}>
            <UserPlus aria-hidden="true" />
            Create User
          </Button>
        </header>
        <CreateUserDialog open={dialogOpen} onOpenChange={setDialogOpen} />
        <EditUserDialog
          user={editingUser}
          open={editingUser !== null}
          onOpenChange={(open) => { if (!open) setEditingUser(null) }}
        />
        <DeleteUserDialog
          user={deletingUser}
          open={deletingUser !== null}
          onOpenChange={(open) => { if (!open) setDeletingUser(null) }}
        />
        <LockUserDialog
          user={lockingUser}
          open={lockingUser !== null}
          onOpenChange={(open) => { if (!open) setLockingUser(null) }}
        />

        {isPending && (
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-e1">
            <div className="overflow-x-auto">
            <table aria-label="Users" className="w-full min-w-[900px] text-body">
              <thead className="bg-muted/95">
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-left text-caption font-semibold text-muted-foreground">Name</th>
                  <th className="px-4 py-3 text-left text-caption font-semibold text-muted-foreground">Email</th>
                  <th className="px-4 py-3 text-left text-caption font-semibold text-muted-foreground">Role</th>
                  <th className="px-4 py-3 text-left text-caption font-semibold text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-left text-caption font-semibold text-muted-foreground">Availability</th>
                  <th className="px-4 py-3 text-left text-caption font-semibold text-muted-foreground">Member Since</th>
                  <th aria-label="Actions" className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-border/70 last:border-b-0">
                    <td className="px-4 py-3.5"><Skeleton className="h-8 w-32" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-48" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-5 w-14 rounded-full" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-5 w-14 rounded-full" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-5 w-20 rounded-full" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                    <td className="px-4 py-3"><div className="flex justify-end gap-1"><Skeleton className="h-7 w-7 rounded-md" /><Skeleton className="h-7 w-7 rounded-md" /><Skeleton className="h-7 w-7 rounded-md" /></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        )}

        {error ? (
          <ErrorState
            title="User directory unavailable"
            description={error.message}
            action={<Button variant="outline" size="sm" onClick={() => void refetch()}>Try again</Button>}
          />
        ) : null}

        {users && (
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-e1">
            <div className="overflow-x-auto">
            <table aria-label="Users" className="w-full min-w-[900px] text-body">
              <thead className="sticky top-0 z-10 bg-muted/95 backdrop-blur-sm">
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-left text-caption font-semibold text-muted-foreground">Name</th>
                  <th className="px-4 py-3 text-left text-caption font-semibold text-muted-foreground">Email</th>
                  <th className="px-4 py-3 text-left text-caption font-semibold text-muted-foreground">Role</th>
                  <th className="px-4 py-3 text-left text-caption font-semibold text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-left text-caption font-semibold text-muted-foreground">Availability</th>
                  <th className="px-4 py-3 text-left text-caption font-semibold text-muted-foreground">Member Since</th>
                  <th aria-label="Actions" className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-4">
                      <EmptyState
                        className="min-h-52 border-0 bg-transparent"
                        title="No users found."
                        description="Create a user to add them to the support workspace."
                        icon={<UsersRound aria-hidden="true" className="size-5" />}
                      />
                    </td>
                  </tr>
                ) : (
                  users.map(user => (
                    <tr
                      key={user.id}
                      className="border-b border-border/70 transition-colors hover:bg-muted/45 last:border-b-0 motion-reduce:transition-none"
                    >
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-caption font-semibold text-foreground">
                            {user.name.trim().charAt(0).toUpperCase()}
                          </span>
                          <span className="font-semibold text-foreground">{user.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-label text-muted-foreground">{user.email}</td>
                      <td className="px-4 py-3.5">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-caption font-medium ${
                          user.role === 'ADMIN'
                            ? 'bg-primary/10 text-primary'
                            : 'bg-muted text-muted-foreground'
                        }`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-caption font-medium ${
                          user.is_active
                            ? 'bg-status-resolved-soft text-status-resolved'
                            : 'bg-status-danger-soft text-status-danger'
                        }`}>
                          <span aria-hidden="true" className={`size-1.5 rounded-full ${user.is_active ? 'bg-status-resolved' : 'bg-status-danger'}`} />
                          {user.is_active ? 'Active' : 'Locked'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        {user.role === 'AGENT' ? (
                          <div className="flex items-center gap-1.5">
                            <span aria-hidden="true" className={`size-2 rounded-full ${onlineDot(user.online_status)}`} />
                            <span className="text-caption text-muted-foreground">{onlineLabel(user.online_status)}</span>
                          </div>
                        ) : (
                          <span className="text-caption text-muted-foreground/55">—</span>
                        )}
                      </td>
                      <td className="tabular whitespace-nowrap px-4 py-3.5 text-caption text-muted-foreground">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => setEditingUser(user)}
                            aria-label={`Edit ${user.name}`}
                          >
                            <Pencil aria-hidden="true" />
                          </Button>
                          {user.role === 'AGENT' ? (
                            <>
                              <Button variant="ghost" size="icon-sm" onClick={() => setLockingUser(user)} aria-label={user.is_active ? `Lock ${user.name}` : `Unlock ${user.name}`}>
                                {user.is_active ? <Lock aria-hidden="true" /> : <LockOpen aria-hidden="true" />}
                              </Button>
                              <Button variant="ghost" size="icon-sm" onClick={() => setDeletingUser(user)} aria-label={`Delete ${user.name}`} className="text-destructive hover:text-destructive">
                                <Trash2 aria-hidden="true" />
                              </Button>
                            </>
                          ) : (
                            <span aria-hidden="true" className="inline-block w-[68px]" />
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
