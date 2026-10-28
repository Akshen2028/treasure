import { TriangleAlert } from 'lucide-react'
import { useEffect } from 'react'
import { isRouteErrorResponse, Link, useRouteError } from 'react-router'

import { paths } from '@/app/paths'
import { PageContainer } from '@/components/layout/PageContainer'
import { Button } from '@/components/ui/button'
import { reportError } from '@/lib/monitoring'

import { EmptyState } from './EmptyState'

/** Last-resort error screen for anything thrown while rendering a route. */
export function RouteError() {
  const error = useRouteError()
  useEffect(() => {
    if (!isRouteErrorResponse(error)) reportError(error)
  }, [error])
  const description = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : 'Something unexpected happened. Your data is safe. Please try again.'

  return (
    <PageContainer className="grid min-h-dvh place-items-center">
      <EmptyState
        icon={TriangleAlert}
        title="Something went wrong"
        description={description}
        action={
          <Button asChild>
            <Link viewTransition to={paths.welcome}>
              Back to the start
            </Link>
          </Button>
        }
      />
    </PageContainer>
  )
}
