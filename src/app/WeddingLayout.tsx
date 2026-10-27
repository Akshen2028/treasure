import { useEffect, useMemo } from 'react'
import { Navigate, Outlet, useLocation, useParams, useSearchParams } from 'react-router'

import { legacyRedirect } from './paths'
import { isShareKey, readShareKey, saveShareKey } from './shareKeys'
import { WeddingContext, type WeddingRoute } from './WeddingContext'

/** Layout route for `/w/:slug/...`: tells every screen below which wedding it shows. */
export function WeddingLayout() {
  const { slug = '' } = useParams()
  const [searchParams] = useSearchParams()
  const linkKey = searchParams.get('k')

  const route = useMemo<WeddingRoute>(
    () => ({ slug, shareKey: isShareKey(linkKey) ? linkKey : readShareKey(slug) }),
    [slug, linkKey],
  )

  // Remember a key from the link so other screens, and reloads, stay open.
  useEffect(() => {
    if (isShareKey(linkKey)) saveShareKey(slug, linkKey)
  }, [slug, linkKey])

  return (
    <WeddingContext value={route}>
      <Outlet />
    </WeddingContext>
  )
}

/** Sends a URL from before per-wedding routes (`/home`, `/events/…`) to the same screen. */
export function LegacyRedirect() {
  const { pathname, search, hash } = useLocation()
  return <Navigate to={legacyRedirect(pathname, search, hash) ?? '/'} replace />
}
