import { Ellipsis, Pencil, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

type ItemActionsMenuProps = {
  /** Accessible name of the ⋯ button, e.g. "Event actions". */
  label: string
  editLabel: string
  deleteLabel: string
  onEdit: () => void
  onDelete: () => void
}

/** The ⋯ menu on detail pages for planners: edit and delete. */
export function ItemActionsMenu({
  label,
  editLabel,
  deleteLabel,
  onEdit,
  onDelete,
}: ItemActionsMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={label}>
          <Ellipsis />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48">
        <DropdownMenuItem onSelect={onEdit} className="py-2.5">
          <Pencil /> {editLabel}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onDelete} variant="destructive" className="py-2.5">
          <Trash2 /> {deleteLabel}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
