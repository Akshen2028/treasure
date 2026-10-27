import { Compass } from 'lucide-react'
import { Link } from 'react-router'

import { paths } from '@/app/paths'
import { EmptyState } from '@/components/feedback/EmptyState'
import { PageContainer } from '@/components/layout/PageContainer'
import { Button } from '@/components/ui/button'

export function NotFoundPage() {
  return (
    <PageContainer className="grid min-h-dvh place-items-center">
      <EmptyState
        headingLevel="h1"
        icon={Compass}
        title="Page not found"
        description="This page doesn't exist or may have been moved."
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
