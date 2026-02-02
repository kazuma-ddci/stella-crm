"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { updateCompany } from "./[id]/actions";
import { createCompany } from "./actions";

type Company = {
  id: number;
  companyCode: string;
  name: string;
  websiteUrl: string | null;
  industry: string | null;
  revenueScale: string | null;
  note: string | null;
};

type Props = {
  company?: Company;
};

export function CompanyForm({ company }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const isEdit = !!company;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get("name") as string,
      websiteUrl: (formData.get("websiteUrl") as string) || undefined,
      industry: (formData.get("industry") as string) || undefined,
      revenueScale: (formData.get("revenueScale") as string) || undefined,
      note: (formData.get("note") as string) || undefined,
    };

    try {
      if (isEdit) {
        await updateCompany(company.id, data);
        toast.success("顧客情報を更新しました");
        router.push(`/companies/${company.id}`);
      } else {
        const newCompany = await createCompany(data);
        toast.success("顧客を登録しました");
        router.push(`/companies/${newCompany.id}`);
      }
    } catch (error) {
      toast.error(isEdit ? "更新に失敗しました" : "登録に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {isEdit && (
          <div className="space-y-2">
            <Label>企業ID</Label>
            <Input value={company.companyCode} disabled className="bg-muted" />
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="name">企業名 *</Label>
          <Input
            id="name"
            name="name"
            defaultValue={company?.name}
            required
            placeholder="株式会社〇〇"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="industry">業界</Label>
          <Input
            id="industry"
            name="industry"
            defaultValue={company?.industry || ""}
            placeholder="IT・通信"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="revenueScale">売上規模</Label>
          <Input
            id="revenueScale"
            name="revenueScale"
            defaultValue={company?.revenueScale || ""}
            placeholder="10億〜50億"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="websiteUrl">企業HP</Label>
          <Input
            id="websiteUrl"
            name="websiteUrl"
            type="url"
            defaultValue={company?.websiteUrl || ""}
            placeholder="https://example.co.jp"
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="note">メモ</Label>
          <Textarea
            id="note"
            name="note"
            defaultValue={company?.note || ""}
            placeholder="メモや備考を入力..."
            rows={4}
          />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
        >
          キャンセル
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? "保存中..." : isEdit ? "更新" : "登録"}
        </Button>
      </div>
    </form>
  );
}
