import type { ReactNode } from 'react'

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="border-border/60 text-muted-foreground flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-12 text-center">
      <p className="text-foreground font-medium">{title}</p>
      {description ? <p className="max-w-sm text-sm">{description}</p> : null}
      {action}
    </div>
  )
}
