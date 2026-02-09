"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle, Loader2 } from "lucide-react";
import { searchSimilarCompanies, type SimilarCompany } from "@/app/companies/actions";

type Props = {
  value: string;
  onChange: (value: string) => void;
  /** 法人番号（追加で重複チェック） */
  corporateNumber?: string;
  /** 編集時に自社を除外するID */
  excludeId?: number;
  /** 類似企業が見つかった時のコールバック */
  onSimilarFound?: (companies: SimilarCompany[]) => void;
  /** ユーザーが「新規登録する」を確認したかどうかを通知 */
  onDuplicateConfirmed?: (confirmed: boolean) => void;
  placeholder?: string;
  required?: boolean;
};

export function CompanyNameInput({
  value,
  onChange,
  corporateNumber,
  excludeId,
  onSimilarFound,
  onDuplicateConfirmed,
  placeholder = "株式会社〇〇",
  required = false,
}: Props) {
  const [similarCompanies, setSimilarCompanies] = useState<SimilarCompany[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [duplicateConfirmed, setDuplicateConfirmed] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSearch = useCallback(
    async (searchName: string) => {
      if (!searchName || searchName.trim().length < 2) {
        setSimilarCompanies([]);
        setDuplicateConfirmed(false);
        onSimilarFound?.([]);
        onDuplicateConfirmed?.(true);
        return;
      }

      setIsSearching(true);
      try {
        const results = await searchSimilarCompanies(
          searchName,
          corporateNumber,
          excludeId
        );
        setSimilarCompanies(results);
        onSimilarFound?.(results);

        if (results.length === 0) {
          setDuplicateConfirmed(true);
          onDuplicateConfirmed?.(true);
        } else {
          setDuplicateConfirmed(false);
          onDuplicateConfirmed?.(false);
        }
      } catch {
        setSimilarCompanies([]);
      } finally {
        setIsSearching(false);
      }
    },
    [corporateNumber, excludeId, onSimilarFound, onDuplicateConfirmed]
  );

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      doSearch(value);
    }, 500);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [value, doSearch]);

  const handleConfirmNew = () => {
    setDuplicateConfirmed(true);
    onDuplicateConfirmed?.(true);
  };

  const matchTypeLabel = (type: SimilarCompany["matchType"]) => {
    switch (type) {
      case "exact":
        return "一致";
      case "similar":
        return "類似";
      case "corporateNumber":
        return "法人番号一致";
    }
  };

  const matchTypeBadgeClass = (type: SimilarCompany["matchType"]) => {
    switch (type) {
      case "exact":
      case "corporateNumber":
        return "bg-destructive/10 text-destructive";
      case "similar":
        return "bg-yellow-100 text-yellow-800";
    }
  };

  return (
    <div className="space-y-2">
      <div className="relative">
        <Input
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setDuplicateConfirmed(false);
            onDuplicateConfirmed?.(false);
          }}
          placeholder={placeholder}
          required={required}
        />
        {isSearching && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {similarCompanies.length > 0 && !duplicateConfirmed && (
        <Alert className="border-yellow-300 bg-yellow-50">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          <AlertTitle className="text-yellow-800">
            類似する企業が見つかりました
          </AlertTitle>
          <AlertDescription>
            <div className="mt-2 space-y-1.5">
              {similarCompanies.map((company) => (
                <div
                  key={company.id}
                  className="flex items-center gap-2 rounded-md border bg-white px-3 py-2 text-sm"
                >
                  <span className="font-mono text-xs text-muted-foreground">
                    {company.companyCode}
                  </span>
                  <span className="font-medium">{company.name}</span>
                  {company.corporateNumber && (
                    <span className="text-xs text-muted-foreground">
                      ({company.corporateNumber})
                    </span>
                  )}
                  <span
                    className={`ml-auto rounded-full px-2 py-0.5 text-xs font-medium ${matchTypeBadgeClass(company.matchType)}`}
                  >
                    {matchTypeLabel(company.matchType)}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleConfirmNew}
              >
                重複ではない - 新規登録する
              </Button>
              <span className="text-xs text-muted-foreground">
                上記と異なる企業であれば、このまま登録できます
              </span>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {similarCompanies.length > 0 && duplicateConfirmed && (
        <div className="flex items-center gap-1.5 text-sm text-green-600">
          <CheckCircle className="h-3.5 w-3.5" />
          <span>重複でないことを確認済み</span>
        </div>
      )}
    </div>
  );
}
