import { LoaderCircle, TriangleAlert } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'

import { paths as appPaths } from '@/app/paths'
import { useWeddingPaths, useWeddingRoute } from '@/app/WeddingContext'
import { useAccess } from '@/auth/AccessContext'
import { deleteConfirmationMatches } from '@/auth/accountDeletion'
import { FormField } from '@/components/forms/FormField'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

/**
 * "Delete wedding and account": permanent, so the planner types the web address to confirm.
 * The dialog stays open while deleting, and on failure, so the planner can try again.
 */
export function DeleteAccountCard() {
  const { slug } = useWeddingRoute()
  const paths = useWeddingPaths()
  const { deleteAccount } = useAccess()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState('')
  const [error, setError] = useState<string>()
  const [deleting, setDeleting] = useState(false)
  const confirmed = deleteConfirmationMatches(typed, slug)

  function changeOpen(next: boolean) {
    if (deleting) return
    setOpen(next)
    setTyped('')
    setError(undefined)
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!confirmed || deleting) return
    setDeleting(true)
    const result = await deleteAccount(slug)
    if (!result.ok) {
      setDeleting(false)
      setError(result.message)
      return
    }
    void navigate(appPaths.welcome, { replace: true, viewTransition: true })
    toast.success('Your wedding and account were deleted')
  }

  return (
    <div className="flex flex-col gap-4 p-5">
      <div className="flex items-start gap-4">
        <TriangleAlert className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden="true" />
        <div>
          <p className="font-medium">Delete wedding and account</p>
          <p className="text-sm text-muted-foreground">
            Permanently deletes this wedding, its photos and your sign-in. Guests’ links stop
            working. This can’t be undone.
          </p>
        </div>
      </div>
      <Button variant="destructive" className="self-start" onClick={() => changeOpen(true)}>
        Delete wedding and account
      </Button>

      <AlertDialog open={open} onOpenChange={changeOpen}>
        <AlertDialogContent>
          <form onSubmit={(e) => void handleSubmit(e)} noValidate className="grid gap-6">
            <AlertDialogHeader>
              <AlertDialogTitle>Delete everything?</AlertDialogTitle>
              <AlertDialogDescription>
                Your events, categories, activities, payments, links and photos are deleted for
                good, and so is your account. Recently Deleted can’t bring them back.{' '}
                <Link viewTransition to={paths.aiExport} className="text-foreground underline">
                  Download a copy first
                </Link>
                .
              </AlertDialogDescription>
            </AlertDialogHeader>
            <FormField label={`Type ${slug} to confirm`} error={error}>
              <Input
                value={typed}
                onChange={(e) => {
                  setTyped(e.target.value)
                  setError(undefined)
                }}
                disabled={deleting}
                autoCapitalize="none"
                autoCorrect="off"
                autoComplete="off"
                spellCheck={false}
              />
            </FormField>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
              <Button
                type="submit"
                className="bg-destructive text-white hover:bg-destructive/90"
                disabled={!confirmed || deleting}
              >
                {deleting && <LoaderCircle data-icon="inline-start" className="animate-spin" />}
                {deleting ? 'Deleting…' : 'Delete forever'}
              </Button>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
