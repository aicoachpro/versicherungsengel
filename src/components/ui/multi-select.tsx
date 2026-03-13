"use client";

import * as React from "react";
import { ChevronsUpDown, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";

interface MultiSelectProps {
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  onCreateNew?: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function MultiSelect({
  options,
  selected,
  onChange,
  onCreateNew,
  placeholder = "Auswählen...",
  className,
}: MultiSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");

  const filtered = options.filter((opt) =>
    opt.toLowerCase().includes(search.toLowerCase())
  );

  const showCreate =
    onCreateNew &&
    search.trim() !== "" &&
    !options.some((o) => o.toLowerCase() === search.trim().toLowerCase());

  function toggleOption(opt: string) {
    if (selected.includes(opt)) {
      onChange(selected.filter((s) => s !== opt));
    } else {
      onChange([...selected, opt]);
    }
  }

  function removeOption(opt: string, e: React.MouseEvent) {
    e.stopPropagation();
    onChange(selected.filter((s) => s !== opt));
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn(
          "flex min-h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-1.5 text-sm shadow-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
      >
        <div className="flex flex-wrap gap-1 flex-1">
          {selected.length === 0 ? (
            <span className="text-muted-foreground py-0.5">{placeholder}</span>
          ) : (
            selected.map((s) => (
              <Badge key={s} variant="secondary" className="text-xs gap-1">
                {s}
                <X
                  className="h-3 w-3 cursor-pointer hover:text-destructive"
                  onClick={(e) => removeOption(s, e)}
                />
              </Badge>
            ))
          )}
        </div>
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </PopoverTrigger>
      <PopoverContent className="w-[--anchor-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Suchen..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>
              {showCreate ? null : "Keine Ergebnisse"}
            </CommandEmpty>
            <CommandGroup>
              {filtered.map((opt) => (
                <CommandItem
                  key={opt}
                  value={opt}
                  data-checked={selected.includes(opt) ? true : undefined}
                  onSelect={() => toggleOption(opt)}
                >
                  {opt}
                </CommandItem>
              ))}
            </CommandGroup>
            {showCreate && (
              <CommandGroup>
                <CommandItem
                  onSelect={() => {
                    const newVal = search.trim();
                    onCreateNew!(newVal);
                    onChange([...selected, newVal]);
                    setSearch("");
                  }}
                  className="text-primary"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Neu anlegen: &quot;{search.trim()}&quot;
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
