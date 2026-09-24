import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSyncExternalStore } from 'react'

import type { StaffRole } from '@/entities/studio'
import { STUDIO_QUERY_ROOT } from '@/shared/api/query-keys'

import { authService, userAdminService } from './index'

export const staffKeys = {
  all: [STUDIO_QUERY_ROOT, 'staff'] as const,
  users: () => [...staffKeys.all, 'users'] as const,
}

/** Current staff session (sessionStorage), reactive to sign-in/out and account changes. */
export function useStaffSession() {
  return useSyncExternalStore(authService.onChange, authService.getSession, () => null)
}

export function usersQueryOptions() {
  return queryOptions({ queryKey: staffKeys.users(), queryFn: () => userAdminService.list() })
}

function useInvalidateUsers() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: staffKeys.users() })
}

export function useCreateUser() {
  const invalidate = useInvalidateUsers()
  return useMutation({
    mutationFn: (input: { email: string; displayName: string; role: StaffRole }) =>
      userAdminService.create(input),
    onSuccess: invalidate,
  })
}

export function useResetPassword() {
  const invalidate = useInvalidateUsers()
  return useMutation({
    mutationFn: (userId: string) => userAdminService.resetPassword(userId),
    onSuccess: invalidate,
  })
}

export function useSetRole() {
  const invalidate = useInvalidateUsers()
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: StaffRole }) =>
      userAdminService.setRole(userId, role),
    onSuccess: invalidate,
  })
}

export function useSetActive() {
  const invalidate = useInvalidateUsers()
  return useMutation({
    mutationFn: ({ userId, active }: { userId: string; active: boolean }) =>
      userAdminService.setActive(userId, active),
    onSuccess: invalidate,
  })
}

export function useSignOut() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => authService.signOut(),
    // Nothing from the previous user's session may remain in memory.
    onSettled: () => queryClient.removeQueries({ queryKey: [STUDIO_QUERY_ROOT] }),
  })
}
