"use client";

import * as React from "react";
import { ChevronsUpDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
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

interface ComboboxProps {
  options: string[];
  value: string;
  onChange: (value: string) => void;
  onCreateNew?: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function Combobox({
  options,
  value,
  onChange,
  onCreateNew,
  placeholder = "Auswählen...",
  className,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");

  const filtered = options.filter((opt) =>
    opt.toLowerCase().includes(search.toLowerCase())
  );

  const showCreate =
    onCreateNew &&
    search.trim() !== "" &&
    !options.some((o) => o.toLowerCase() === search.trim().toLowerCase());

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn(
          "flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
      >
        <span className={value ? "" : "text-muted-foreground"}>
          {value || placeholder}
        </span>
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
                  data-checked={value === opt ? true : undefined}
                  onSelect={() => {
                    onChange(opt);
                    setOpen(false);
                    setSearch("");
                  }}
                >
                  {opt}
                </CommandItem>
              ))}
            </CommandGroup>
            {showCreate && (
              <CommandGroup>
                <CommandItem
                  onSelect={() => {
                    onCreateNew!(search.trim());
                    onChange(search.trim());
                    setOpen(false);
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
