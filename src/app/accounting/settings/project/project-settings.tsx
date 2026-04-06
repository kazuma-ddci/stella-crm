"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Mail, Landmark, Star } from "lucide-react";
import { updateProjectBasicInfo, updateOperatingCompanyInfo } from "./actions";
import { ProjectEmailsModal } from "@/app/settings/projects/project-emails-modal";
import { ProjectBankAccountsModal } from "@/app/settings/projects/project-bank-accounts-modal";

type ProjectData = {
  id: number;
  name: string;
  description: string | null;
  defaultApproverStaffId: number | null;
};

type OperatingCompanyData = {
  id: number;
  companyName: string;
  registrationNumber: string | null;
  postalCode: string | null;
  address: string | null;
  address2: string | null;
  representativeName: string | null;
  phone: string | null;
} | null;

type EmailItem = {
  email: string;
  label: string | null;
  isDefault: boolean;
};

type BankAccountItem = {
  bankName: string;
  branchName: string;
  accountType: string;
  accountNumber: string;
  accountHolderName: string;
  isDefault: boolean;
};

type ApproverOption = { id: number; name: string };

type Props = {
  project: ProjectData;
  operatingCompany: OperatingCompanyData;
  isSystemAdmin: boolean;
  emails: EmailItem[];
  bankAccounts: BankAccountItem[];
  canEdit: boolean;
  approverOptions: ApproverOption[];
};

export function ProjectSettings({ project, operatingCompany, isSystemAdmin, emails, bankAccounts, canEdit, approverOptions }: Props) {
  // プロジェクト基本情報
  const [projectName, setProjectName] = useState(project.name);
  const [projectDescription, setProjectDescription] = useState(
    project.description ?? ""
  );
  const [defaultApproverStaffId, setDefaultApproverStaffId] = useState<number | null>(
    project.defaultApproverStaffId
  );
  const [projectSaving, setProjectSaving] = useState(false);
  const [projectSuccess, setProjectSuccess] = useState(false);

  // 運営法人情報
  const [companyName, setCompanyName] = useState(
    operatingCompany?.companyName ?? ""
  );
  const [registrationNumber, setRegistrationNumber] = useState(
    operatingCompany?.registrationNumber ?? ""
  );
  const [postalCode, setPostalCode] = useState(
    operatingCompany?.postalCode ?? ""
  );
  const [address, setAddress] = useState(operatingCompany?.address ?? "");
  const [address2, setAddress2] = useState(operatingCompany?.address2 ?? "");
  const [representativeName, setRepresentativeName] = useState(
    operatingCompany?.representativeName ?? ""
  );
  const [phone, setPhone] = useState(operatingCompany?.phone ?? "");
  const [companySaving, setCompanySaving] = useState(false);
  const [companySuccess, setCompanySuccess] = useState(false);

  // モーダル
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [bankModalOpen, setBankModalOpen] = useState(false);

  const handleSaveProject = async () => {
    setProjectSaving(true);
    setProjectSuccess(false);
    try {
      await updateProjectBasicInfo(project.id, {
        name: projectName,
        description: projectDescription,
        defaultApproverStaffId,
      });
      setProjectSuccess(true);
      setTimeout(() => setProjectSuccess(false), 3000);
    } finally {
      setProjectSaving(false);
    }
  };

  const handleSaveCompany = async () => {
    if (!operatingCompany) return;
    setCompanySaving(true);
    setCompanySuccess(false);
    try {
      await updateOperatingCompanyInfo(operatingCompany.id, {
        companyName,
        registrationNumber,
        postalCode,
        address,
        address2,
        representativeName,
        phone,
      });
      setCompanySuccess(true);
      setTimeout(() => setCompanySuccess(false), 3000);
    } finally {
      setCompanySaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* プロジェクト基本情報 */}
      <Card>
        <CardHeader>
          <CardTitle>基本情報</CardTitle>
          <CardDescription>プロジェクトの名前と説明を管理します</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="project-name">プロジェクト名</Label>
            <Input
              id="project-name"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="プロジェクト名"
              disabled={!canEdit}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="project-description">説明</Label>
            <Textarea
              id="project-description"
              value={projectDescription}
              onChange={(e) => setProjectDescription(e.target.value)}
              placeholder="プロジェクトの説明"
              rows={3}
              disabled={!canEdit}
            />
          </div>
          <div className="space-y-2">
            <Label>デフォルト承認者</Label>
            <Select
              value={defaultApproverStaffId?.toString() ?? "__none__"}
              onValueChange={(v) => setDefaultApproverStaffId(v === "__none__" ? null : Number(v))}
              disabled={!canEdit}
            >
              <SelectTrigger className="w-64">
                <SelectValue placeholder="（未設定）" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">（未設定）</SelectItem>
                {approverOptions.map((s) => (
                  <SelectItem key={s.id} value={s.id.toString()}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              経費申請時に承認者の初期値として自動セットされます。承認権限を持つスタッフのみ選択可能です。
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={handleSaveProject}
              disabled={projectSaving || !projectName.trim() || !canEdit}
            >
              {projectSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  保存中...
                </>
              ) : (
                "保存"
              )}
            </Button>
            {projectSuccess && (
              <span className="text-sm text-green-600">保存しました</span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 運営法人情報 */}
      <Card>
        <CardHeader>
          <CardTitle>運営法人情報</CardTitle>
          <CardDescription>
            このプロジェクトの運営法人の基本情報を管理します
          </CardDescription>
        </CardHeader>
        <CardContent>
          {operatingCompany ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="company-name">法人名</Label>
                  <Input
                    id="company-name"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="法人名"
                    disabled={!canEdit}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="registration-number">
                    適格請求書発行事業者登録番号
                  </Label>
                  <Input
                    id="registration-number"
                    value={registrationNumber}
                    onChange={(e) => setRegistrationNumber(e.target.value)}
                    placeholder="T1234567890123"
                    disabled={!canEdit}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="postal-code">郵便番号</Label>
                  <Input
                    id="postal-code"
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                    placeholder="123-4567"
                    disabled={!canEdit}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">電話番号</Label>
                  <Input
                    id="phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="03-1234-5678"
                    disabled={!canEdit}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">住所1</Label>
                <Input
                  id="address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="住所1"
                  disabled={!canEdit}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address2">住所2</Label>
                <Input
                  id="address2"
                  value={address2}
                  onChange={(e) => setAddress2(e.target.value)}
                  placeholder="住所2（建物名・階数など）"
                  disabled={!canEdit}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="representative-name">代表者名</Label>
                <Input
                  id="representative-name"
                  value={representativeName}
                  onChange={(e) => setRepresentativeName(e.target.value)}
                  placeholder="代表者名"
                  disabled={!canEdit}
                />
              </div>
              <div className="flex items-center gap-3">
                <Button
                  onClick={handleSaveCompany}
                  disabled={companySaving || !companyName.trim() || !canEdit}
                >
                  {companySaving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      保存中...
                    </>
                  ) : (
                    "保存"
                  )}
                </Button>
                {companySuccess && (
                  <span className="text-sm text-green-600">保存しました</span>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              運営法人が設定されていません。管理者に設定を依頼してください。
            </p>
          )}
        </CardContent>
      </Card>

      {/* メール管理 */}
      <Card>
        <CardHeader>
          <CardTitle>メール管理</CardTitle>
          <CardDescription>
            プロジェクトで使用するメールアドレスを管理します
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {emails.length > 0 ? (
            <div className="space-y-2">
              {emails.map((item, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
                >
                  <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className={item.isDefault ? "font-semibold" : ""}>
                    {item.email}
                  </span>
                  {item.label && (
                    <span className="text-muted-foreground">({item.label})</span>
                  )}
                  {item.isDefault && (
                    <Badge variant="secondary" className="ml-auto shrink-0">
                      <Star className="h-3 w-3 mr-1" />
                      デフォルト
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              メールアドレスが登録されていません
            </p>
          )}
          <Button variant="outline" onClick={() => setEmailModalOpen(true)} disabled={!canEdit}>
            <Mail className="h-4 w-4 mr-2" />
            メールアドレスを管理
          </Button>
        </CardContent>
      </Card>

      {/* 口座管理 */}
      <Card>
        <CardHeader>
          <CardTitle>口座管理</CardTitle>
          <CardDescription>
            プロジェクトで使用する銀行口座を管理します
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {bankAccounts.length > 0 ? (
            <div className="space-y-2">
              {bankAccounts.map((item, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
                >
                  <Landmark className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className={item.isDefault ? "font-semibold" : ""}>
                    {item.bankName} {item.branchName} {item.accountType} {item.accountNumber} ({item.accountHolderName})
                  </span>
                  {item.isDefault && (
                    <Badge variant="secondary" className="ml-auto shrink-0">
                      <Star className="h-3 w-3 mr-1" />
                      デフォルト
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              銀行口座が登録されていません
            </p>
          )}
          <Button variant="outline" onClick={() => setBankModalOpen(true)} disabled={!canEdit}>
            <Landmark className="h-4 w-4 mr-2" />
            銀行口座を管理
          </Button>
        </CardContent>
      </Card>

      {/* モーダル */}
      <ProjectEmailsModal
        open={emailModalOpen}
        onOpenChange={setEmailModalOpen}
        projectId={project.id}
        projectName={project.name}
        isSystemAdmin={isSystemAdmin}
      />
      <ProjectBankAccountsModal
        open={bankModalOpen}
        onOpenChange={setBankModalOpen}
        projectId={project.id}
        projectName={project.name}
      />
    </div>
  );
}
