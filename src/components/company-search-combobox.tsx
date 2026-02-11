"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn, matchesWithWordBoundary } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface Company {
  id: number;
  companyCode: string;
  name: string;
  industry?: string | null;
}

interface CompanySearchComboboxProps {
  value: number | null;
  onChange: (companyId: number | null, company: Company | null) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function CompanySearchCombobox({
  value,
  onChange,
  placeholder = "企業を選択...",
  disabled = false,
  className,
}: CompanySearchComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);

  // 選択中の企業情報を取得
  useEffect(() => {
    if (value && !selectedCompany) {
      fetch(`/api/companies/${value}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.company) {
            setSelectedCompany(data.company);
          }
        })
        .catch(console.error);
    } else if (!value) {
      setSelectedCompany(null);
    }
  }, [value, selectedCompany]);

  // 企業一覧を取得
  const fetchCompanies = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/companies/search?limit=500");
      const data = await response.json();
      // 降順（ID大きい順）でソート
      const sorted = (data.companies || []).sort((a: Company, b: Company) => b.id - a.id);
      setCompanies(sorted);
    } catch (error) {
      console.error("Failed to fetch companies:", error);
      setCompanies([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Popoverを開いた時に企業一覧を取得
  useEffect(() => {
    if (open && companies.length === 0) {
      fetchCompanies();
    }
  }, [open, companies.length, fetchCompanies]);

  // 検索フィルター
  const filteredCompanies = useMemo(() => {
    if (!search) return companies;
    return companies.filter(
      (c) =>
        matchesWithWordBoundary(c.name, search) ||
        matchesWithWordBoundary(c.companyCode, search) ||
        (c.industry && matchesWithWordBoundary(c.industry, search))
    );
  }, [companies, search]);

  const handleSelect = (company: Company) => {
    setSelectedCompany(company);
    onChange(company.id, company);
    setOpen(false);
    setSearch("");
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedCompany(null);
    onChange(null, null);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between font-normal",
            !selectedCompany && "text-muted-foreground",
            className
          )}
        >
          {selectedCompany ? (
            <span className="truncate">
              <span className="font-mono text-xs text-muted-foreground mr-2">
                {selectedCompany.companyCode}
              </span>
              {selectedCompany.name}
            </span>
          ) : (
            placeholder
          )}
          <div className="flex items-center gap-1 ml-2">
            {selectedCompany && (
              <X
                className="h-4 w-4 opacity-50 hover:opacity-100"
                onClick={handleClear}
              />
            )}
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
        style={{ minWidth: "300px" }}
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="企業名・コードで検索..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList maxHeight={300}>
            {loading ? (
              <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
                読み込み中...
              </div>
            ) : (
              <>
                <CommandEmpty>該当する企業がありません</CommandEmpty>
                <CommandGroup>
                  {filteredCompanies.map((company) => (
                    <CommandItem
                      key={company.id}
                      value={`${company.companyCode}-${company.name}`}
                      onSelect={() => handleSelect(company)}
                      className="cursor-pointer"
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          value === company.id ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-muted-foreground">
                            {company.companyCode}
                          </span>
                          <span className="font-medium">{company.name}</span>
                        </div>
                        {company.industry && (
                          <span className="text-xs text-muted-foreground">
                            {company.industry}
                          </span>
                        )}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
