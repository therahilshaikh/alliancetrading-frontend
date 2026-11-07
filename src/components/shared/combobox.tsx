import { useState, type ReactNode } from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

export interface ComboboxOption {
  value: string
  label: string
  /** Secondary line (e.g. UPI ID, email). */
  hint?: string
  /** Extra text to match when searching. */
  keywords?: string[]
  disabled?: boolean
}

/** Searchable dropdown (shadcn Combobox = Popover + cmdk). */
export function Combobox({
  options,
  value,
  onChange,
  placeholder = 'Select…',
  searchPlaceholder = 'Search…',
  emptyText = 'No matches.',
  loading,
  disabled,
  id,
  'aria-invalid': ariaInvalid,
  renderOption,
  className,
  /** Server-side search: called as the user types; disables cmdk's own filter. */
  onSearch,
}: {
  options: ComboboxOption[]
  value: string | undefined
  onChange: (value: string | undefined) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  loading?: boolean
  disabled?: boolean
  id?: string
  'aria-invalid'?: boolean
  renderOption?: (o: ComboboxOption) => ReactNode
  className?: string
  onSearch?: (q: string) => void
}) {
  const [open, setOpen] = useState(false)
  const selected = options.find((o) => o.value === value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-invalid={ariaInvalid}
          disabled={disabled}
          className={cn('h-auto min-h-10 w-full justify-between rounded-xl px-3 py-2 text-left font-normal', className)}
        >
          {selected ? (
            <span className="min-w-0">
              <span className="block truncate font-semibold">{selected.label}</span>
              {selected.hint ? <span className="block truncate text-xs text-muted-foreground">{selected.hint}</span> : null}
            </span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) min-w-72 p-0" align="start">
        <Command shouldFilter={!onSearch}>
          <CommandInput placeholder={searchPlaceholder} onValueChange={onSearch} />
          <CommandList>
            <CommandEmpty>{loading ? 'Loading…' : emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((o) => (
                <CommandItem
                  key={o.value}
                  value={o.value}
                  keywords={[o.label, o.hint ?? '', ...(o.keywords ?? [])]}
                  disabled={o.disabled}
                  onSelect={() => {
                    onChange(o.value === value ? undefined : o.value)
                    setOpen(false)
                  }}
                >
                  <Check className={cn('size-4', o.value === value ? 'opacity-100' : 'opacity-0')} aria-hidden />
                  {renderOption ? (
                    renderOption(o)
                  ) : (
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{o.label}</span>
                      {o.hint ? <span className="block truncate text-xs text-muted-foreground">{o.hint}</span> : null}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
