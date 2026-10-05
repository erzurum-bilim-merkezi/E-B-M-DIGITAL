import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'

import { catalogQueryOptions, needsAppUpdate } from '@/features/kit-catalog'
import { readStorage, writeStorage } from '@/shared/lib/storage'

const UPDATE_RELOAD_KEY = 'kasif:app-update-reload'

const reloadPage = () => window.location.reload()

/**
 * Published content that needs a newer app (a new card type, ADR 0019/0023) reloads this one:
 * the service worker (autoUpdate) has the new build by then. Once per required version and
 * session, so an app that is still old after the reload shows its error pages instead of looping.
 */
export function useAppUpdateReload(reload = reloadPage) {
  const catalog = useQuery(catalogQueryOptions())
  const required =
    catalog.data && needsAppUpdate(catalog.data) ? String(catalog.data.minAppVersion) : null
  useEffect(() => {
    if (required === null || readStorage(UPDATE_RELOAD_KEY, 'session') === required) return
    // Without a session store the guard cannot hold: never reload (it could loop).
    if (!writeStorage(UPDATE_RELOAD_KEY, required, 'session')) return
    reload()
  }, [required, reload])
}
