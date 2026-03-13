"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { saveBillingRules } from "./actions";
import { Save } from "lucide-react";

type BillingRuleData = {
  feeType: string;
  invoiceBusinessDays: number | null;
  paymentBusinessDays: number | null;
  closingDay: number | null;
  paymentMonthOffset: number | null;
  paymentDay: number | null;
};

type Props = {
  initialRules: BillingRuleData[];
};

export function BillingRulesForm({ initialRules }: Props) {
  const [rules, setRules] = useState<BillingRuleData[]>(initialRules);
  const [saving, setSaving] = useState(false);

  const getRule = (feeType: string): BillingRuleData => {
    return rules.find((r) => r.feeType === feeType) || {
      feeType,
      invoiceBusinessDays: null,
      paymentBusinessDays: null,
      closingDay: null,
      paymentMonthOffset: null,
      paymentDay: null,
    };
  };

  const updateRule = (feeType: string, field: keyof BillingRuleData, value: number | null) => {
    setRules((prev) =>
      prev.map((r) => (r.feeType === feeType ? { ...r, [field]: value } : r))
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const result = await saveBillingRules(rules);
      if (result.success) {
        toast.success("請求ルールを保存しました");
      } else {
        toast.error(result.error || "保存に失敗しました");
      }
    } catch {
      toast.error("保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const initialRule = getRule("initial");
  const monthlyRule = getRule("monthly");
  const performanceRule = getRule("performance");

  const closingDayLabel = (day: number | null) => {
    if (day === null || day === 0) return "末日";
    return `${day}日`;
  };

  const closingDayOptions = [
    { value: 0, label: "末日" },
    ...Array.from({ length: 28 }, (_, i) => ({ value: i + 1, label: `${i + 1}日` })),
  ];

  const paymentMonthOptions = [
    { value: 0, label: "当月" },
    { value: 1, label: "翌月" },
    { value: 2, label: "翌々月" },
    { value: 3, label: "3ヶ月後" },
  ];

  const paymentDayOptions = [
    { value: 0, label: "末日" },
    ...Array.from({ length: 28 }, (_, i) => ({ value: i + 1, label: `${i + 1}日` })),
  ];

  return (
    <div className="space-y-6">
      {/* 初期費用 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">初期費用</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>請求書発行までの営業日数</Label>
              <p className="text-xs text-muted-foreground">契約日からN営業日後に請求書を発行</p>
              <Input
                type="number"
                min={1}
                max={30}
                value={initialRule.invoiceBusinessDays ?? ""}
                onChange={(e) =>
                  updateRule("initial", "invoiceBusinessDays", e.target.value ? Number(e.target.value) : null)
                }
                placeholder="3"
              />
            </div>
            <div className="space-y-2">
              <Label>支払期限までの営業日数</Label>
              <p className="text-xs text-muted-foreground">請求書発行からN営業日後が支払期限</p>
              <Input
                type="number"
                min={1}
                max={30}
                value={initialRule.paymentBusinessDays ?? ""}
                onChange={(e) =>
                  updateRule("initial", "paymentBusinessDays", e.target.value ? Number(e.target.value) : null)
                }
                placeholder="5"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 月額 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">月額</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-6">
            <div className="space-y-2">
              <Label>締め日</Label>
              <select
                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={monthlyRule.closingDay ?? 0}
                onChange={(e) => updateRule("monthly", "closingDay", Number(e.target.value))}
              >
                {closingDayOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>支払月</Label>
              <select
                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={monthlyRule.paymentMonthOffset ?? 1}
                onChange={(e) => updateRule("monthly", "paymentMonthOffset", Number(e.target.value))}
              >
                {paymentMonthOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>支払日</Label>
              <select
                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={monthlyRule.paymentDay ?? 15}
                onChange={(e) => updateRule("monthly", "paymentDay", Number(e.target.value))}
              >
                {paymentDayOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            例: 締め日={closingDayLabel(monthlyRule.closingDay)}、支払月={paymentMonthOptions.find((o) => o.value === (monthlyRule.paymentMonthOffset ?? 1))?.label}、支払日={paymentDayOptions.find((o) => o.value === (monthlyRule.paymentDay ?? 15))?.label}
          </p>
        </CardContent>
      </Card>

      {/* 成果報酬 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">成果報酬</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-6">
            <div className="space-y-2">
              <Label>締め日</Label>
              <select
                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={performanceRule.closingDay ?? 0}
                onChange={(e) => updateRule("performance", "closingDay", Number(e.target.value))}
              >
                {closingDayOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>支払月</Label>
              <select
                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={performanceRule.paymentMonthOffset ?? 1}
                onChange={(e) => updateRule("performance", "paymentMonthOffset", Number(e.target.value))}
              >
                {paymentMonthOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>支払日</Label>
              <select
                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={performanceRule.paymentDay ?? 15}
                onChange={(e) => updateRule("performance", "paymentDay", Number(e.target.value))}
              >
                {paymentDayOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            例: 締め日={closingDayLabel(performanceRule.closingDay)}、支払月={paymentMonthOptions.find((o) => o.value === (performanceRule.paymentMonthOffset ?? 1))?.label}、支払日={paymentDayOptions.find((o) => o.value === (performanceRule.paymentDay ?? 15))?.label}
          </p>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? "保存中..." : "保存"}
        </Button>
      </div>
    </div>
  );
}
