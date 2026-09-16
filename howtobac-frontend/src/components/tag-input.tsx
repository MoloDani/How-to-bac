import { Input } from '#/components/ui/input'
import { cn } from '#/lib/utils'
import { normalizeTag } from '#/lib/forms'

/**
 * A tag box: the "@" is part of the frame, and what you type is normalized as
 * you go, so the field always shows exactly what will be sent.
 */
export function TagInput({
  value,
  onChange,
  className,
  ...props
}: {
  value: string
  onChange: (tag: string) => void
} & Omit<React.ComponentProps<typeof Input>, 'value' | 'onChange'>) {
  return (
    <div className="relative">
      <span className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 select-none">
        @
      </span>
      <Input
        value={value}
        className={cn('pl-7 font-mono', className)}
        spellCheck={false}
        autoCapitalize="none"
        onChange={(event) => onChange(normalizeTag(event.target.value))}
        {...props}
      />
    </div>
  )
}
