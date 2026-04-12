"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  Save,
  ChevronRight,
} from "lucide-react";
import {
  updateAgency,
  addAgencyContact,
  updateAgencyContact,
  deleteAgencyContact,
  createAgency,
  deleteAgency,
} from "../actions";

const UNSET = "__unset__";

type Contact = {
  id: number;
  name: string;
  role: string;
  email: string;
  phone: string;
  lineFriendId: number | null;
  lineFriendLabel: string | null;
};

type AsResolution = {
  contactId: number;
  contactName: string;
  asId: number | null;
  asName: string | null;
  chain: string[];
};

type ChildAgency = {
  id: number;
  name: string;
  notes: string;
  contacts: Contact[];
  asResolutions: AsResolution[];
};

type AgencyData = {
  id: number;
  name: string;
  corporateName: string;
  email: string;
  phone: string;
  address: string;
  contractStatusId: number | null;
  contractStatusName: string | null;
  contractStartDate: string;
  contractEndDate: string;
  notes: string;
  parentId: number | null;
  parentName: string | null;
  isIndividualBusiness: boolean;
  corporateNumber: string;
  representativeName: string;
  representativePhone: string;
  representativeEmail: string;
  contacts: Contact[];
  children: ChildAgency[];
  asResolutions: AsResolution[];
};

type Props = {
  agency: AgencyData;
  lineFriendOptions: { id: number; label: string }[];
  contractStatusOptions: { id: number; name: string }[];
};

export function AgencyDetail({
  agency,
  lineFriendOptions,
  contractStatusOptions,
}: Props) {
  const router = useRouter();

  // 基本情報フォーム
  const [name, setName] = useState(agency.name);
  const [corporateName, setCorporateName] = useState(agency.corporateName);
  const [email, setEmail] = useState(agency.email);
  const [phone, setPhone] = useState(agency.phone);
  const [address, setAddress] = useState(agency.address);
  const [contractStatusId, setContractStatusId] = useState<string>(
    agency.contractStatusId ? String(agency.contractStatusId) : UNSET
  );
  const [contractStartDate, setContractStartDate] = useState(
    agency.contractStartDate
  );
  const [contractEndDate, setContractEndDate] = useState(agency.contractEndDate);
  const [notes, setNotes] = useState(agency.notes);
  const [isIndividualBusiness, setIsIndividualBusiness] = useState(agency.isIndividualBusiness);
  const [corporateNumber, setCorporateNumber] = useState(agency.corporateNumber);
  const [representativeName, setRepresentativeName] = useState(agency.representativeName);
  const [representativePhone, setRepresentativePhone] = useState(agency.representativePhone);
  const [representativeEmail, setRepresentativeEmail] = useState(agency.representativeEmail);
  const [saving, setSaving] = useState(false);

  // 担当者ダイアログ
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [contactName, setContactName] = useState("");
  const [contactRole, setContactRole] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactLineFriendId, setContactLineFriendId] = useState<string>(UNSET);
  const [deletingContact, setDeletingContact] = useState<Contact | null>(null);

  // 子代理店
  const [creatingChild, setCreatingChild] = useState(false);
  const [deletingChild, setDeletingChild] = useState<ChildAgency | null>(null);
  const [childDialogOpen, setChildDialogOpen] = useState(false);
  const [newChildName, setNewChildName] = useState("");
  const [newChildNotes, setNewChildNotes] = useState("");

  const isChild = agency.parentId !== null;

  // 未保存変更の検出
  const currentValues = useMemo(
    () =>
      JSON.stringify({
        name,
        corporateName,
        email,
        phone,
        address,
        contractStatusId,
        contractStartDate,
        contractEndDate,
        notes,
        isIndividualBusiness,
        corporateNumber,
        representativeName,
        representativePhone,
        representativeEmail,
      }),
    [
      name,
      corporateName,
      email,
      phone,
      address,
      contractStatusId,
      contractStartDate,
      contractEndDate,
      notes,
      isIndividualBusiness,
      corporateNumber,
      representativeName,
      representativePhone,
      representativeEmail,
    ]
  );

  const [savedValues, setSavedValues] = useState(currentValues);
  const isDirty = currentValues !== savedValues;

  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  const guardNavigation = useCallback(
    (e: MouseEvent) => {
      if (!isDirty) return;
      const target = (e.target as HTMLElement).closest("a");
      if (!target) return;
      const href = target.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("javascript")) return;
      if (!confirm("編集したデータが保存されていませんがよろしいですか？")) {
        e.preventDefault();
        e.stopPropagation();
      }
    },
    [isDirty]
  );

  useEffect(() => {
    document.addEventListener("click", guardNavigation, true);
    return () => document.removeEventListener("click", guardNavigation, true);
  }, [guardNavigation]);

  const handleSaveAgency = async () => {
    setSaving(true);
    try {
      await updateAgency(agency.id, {
        name,
        corporateName,
        email,
        phone,
        address,
        contractStatusId:
          contractStatusId === UNSET ? null : parseInt(contractStatusId),
        contractStartDate: contractStartDate || null,
        contractEndDate: contractEndDate || null,
        notes,
        isIndividualBusiness,
        corporateNumber,
        representativeName,
        representativePhone,
        representativeEmail,
      });
      setSavedValues(currentValues);
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  const openContactDialog = (contact: Contact | null) => {
    setEditingContact(contact);
    setContactName(contact?.name ?? "");
    setContactRole(contact?.role ?? "");
    setContactEmail(contact?.email ?? "");
    setContactPhone(contact?.phone ?? "");
    setContactLineFriendId(
      contact?.lineFriendId ? String(contact.lineFriendId) : UNSET
    );
    setContactDialogOpen(true);
  };

  const handleSaveContact = async () => {
    if (!contactName.trim()) return;

    const payload = {
      name: contactName,
      role: contactRole,
      email: contactEmail,
      phone: contactPhone,
      lineFriendId:
        contactLineFriendId === UNSET ? null : parseInt(contactLineFriendId),
    };

    if (editingContact) {
      await updateAgencyContact(editingContact.id, payload);
    } else {
      await addAgencyContact({ ...payload, agencyId: agency.id });
    }

    setContactDialogOpen(false);
    router.refresh();
  };

  const handleDeleteContact = async () => {
    if (!deletingContact) return;
    await deleteAgencyContact(deletingContact.id);
    setDeletingContact(null);
    router.refresh();
  };

  const openChildDialog = () => {
    setNewChildName("");
    setNewChildNotes("");
    setChildDialogOpen(true);
  };

  const handleCreateChild = async () => {
    if (!newChildName.trim()) return;
    setCreatingChild(true);
    try {
      const child = await createAgency({
        name: newChildName.trim(),
        notes: newChildNotes.trim() || undefined,
        parentId: agency.id,
      });
      setChildDialogOpen(false);
      router.push(`/slp/agencies/${child.id}`);
    } finally {
      setCreatingChild(false);
    }
  };

  const handleDeleteChild = async () => {
    if (!deletingChild) return;
    await deleteAgency(deletingChild.id);
    setDeletingChild(null);
    router.refresh();
  };

  // 担当ASの表示用変換
  const renderAsForContact = (
    contact: Contact,
    resolutions: AsResolution[]
  ) => {
    const r = resolutions.find((res) => res.contactId === contact.id);
    if (!r) return null;
    if (!contact.lineFriendId) {
      return <span className="text-xs text-muted-foreground">LINE未紐付</span>;
    }
    if (r.asName) {
      return (
        <Badge variant="secondary" className="text-xs">
          {r.asName}
        </Badge>
      );
    }
    return <span className="text-xs text-muted-foreground">該当なし</span>;
  };

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href={isChild ? `/slp/agencies/${agency.parentId}` : "/slp/agencies"}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            {isChild && agency.parentName && (
              <div className="flex items-center gap-1 text-sm text-muted-foreground mb-1">
                <Link
                  href={`/slp/agencies/${agency.parentId}`}
                  className="hover:underline"
                >
                  {agency.parentName}
                </Link>
                <ChevronRight className="h-3 w-3" />
                <span>子代理店</span>
              </div>
            )}
            <h1 className="text-2xl font-bold">
              代理店ID {agency.id}: {agency.name}
              {isChild && (
                <Badge variant="outline" className="ml-2 text-xs align-middle">
                  子代理店
                </Badge>
              )}
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isDirty && (
            <span className="text-xs text-amber-600">未保存の変更があります</span>
          )}
          <Button onClick={handleSaveAgency} disabled={saving || !isDirty}>
            <Save className="h-4 w-4 mr-1" />
            {saving ? "保存中..." : "保存"}
          </Button>
        </div>
      </div>

      {/* 基本情報 */}
      <Card>
        <CardHeader>
          <CardTitle>基本情報</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>代理店ID</Label>
              <Input value={agency.id} disabled className="bg-gray-50" />
            </div>
            <div>
              <Label>代理店名 *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="代理店名"
              />
            </div>
          </div>

          {!isChild && (
            <>
              <div className="space-y-2">
                <Label>事業形態</Label>
                <RadioGroup
                  value={isIndividualBusiness ? "sole_proprietor" : "corporation"}
                  onValueChange={(v) => setIsIndividualBusiness(v === "sole_proprietor")}
                  className="flex gap-4"
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="corporation" id="biz-corp" />
                    <Label htmlFor="biz-corp" className="cursor-pointer">法人</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="sole_proprietor" id="biz-sole" />
                    <Label htmlFor="biz-sole" className="cursor-pointer">個人事業主</Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>{isIndividualBusiness ? "屋号(個人名可)" : "企業名"}</Label>
                  <Input
                    value={corporateName}
                    onChange={(e) => setCorporateName(e.target.value)}
                    placeholder={isIndividualBusiness ? "屋号または個人名" : "企業名"}
                  />
                </div>
                {!isIndividualBusiness && (
                  <div>
                    <Label>法人番号</Label>
                    <Input
                      value={corporateNumber}
                      onChange={(e) => setCorporateNumber(e.target.value)}
                      placeholder="1234567890123"
                    />
                  </div>
                )}
              </div>

              <div>
                <Label>代表者名</Label>
                <Input
                  value={representativeName}
                  onChange={(e) => setRepresentativeName(e.target.value)}
                  placeholder="代表者名"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>{isIndividualBusiness ? "事業用電話番号" : "企業電話番号"}</Label>
                  <Input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="03-0000-0000"
                  />
                </div>
                <div>
                  <Label>{isIndividualBusiness ? "事業用メールアドレス" : "企業メールアドレス"}</Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="example@example.com"
                  />
                </div>
              </div>

              {!isIndividualBusiness && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>代表者電話番号</Label>
                    <Input
                      value={representativePhone}
                      onChange={(e) => setRepresentativePhone(e.target.value)}
                      placeholder="090-0000-0000"
                    />
                  </div>
                  <div>
                    <Label>代表者メールアドレス</Label>
                    <Input
                      type="email"
                      value={representativeEmail}
                      onChange={(e) => setRepresentativeEmail(e.target.value)}
                      placeholder="representative@example.com"
                    />
                  </div>
                </div>
              )}

              <div>
                <Label>{isIndividualBusiness ? "事業用住所" : "本店所在地"}</Label>
                <Input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="東京都..."
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>契約ステータス</Label>
                  <Select
                    value={contractStatusId}
                    onValueChange={setContractStatusId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="未設定" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={UNSET}>未設定</SelectItem>
                      {contractStatusOptions.map((s) => (
                        <SelectItem key={s.id} value={String(s.id)}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>契約開始日</Label>
                  <DatePicker
                    value={contractStartDate}
                    onChange={setContractStartDate}
                  />
                </div>
                <div>
                  <Label>契約終了日</Label>
                  <DatePicker
                    value={contractEndDate}
                    onChange={setContractEndDate}
                  />
                </div>
              </div>
            </>
          )}

          <div>
            <Label>備考</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="備考"
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* 担当者管理 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>担当者</CardTitle>
          <Button size="sm" onClick={() => openContactDialog(null)}>
            <Plus className="h-4 w-4 mr-1" />
            担当者を追加
          </Button>
        </CardHeader>
        <CardContent>
          {agency.contacts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              担当者が登録されていません
            </p>
          ) : (
            <div className="space-y-2">
              {agency.contacts.map((contact) => (
                <div
                  key={contact.id}
                  className="flex items-start justify-between border rounded-lg p-3"
                >
                  <div className="flex-1 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                    <div>
                      <span className="text-muted-foreground">名前：</span>
                      <span className="font-medium">{contact.name}</span>
                      {contact.role && (
                        <span className="text-muted-foreground ml-2">
                          ({contact.role})
                        </span>
                      )}
                    </div>
                    <div>
                      <span className="text-muted-foreground">担当AS：</span>
                      {renderAsForContact(contact, agency.asResolutions)}
                    </div>
                    {contact.email && (
                      <div>
                        <span className="text-muted-foreground">Mail：</span>
                        {contact.email}
                      </div>
                    )}
                    {contact.phone && (
                      <div>
                        <span className="text-muted-foreground">TEL：</span>
                        {contact.phone}
                      </div>
                    )}
                    {contact.lineFriendLabel && (
                      <div className="col-span-2">
                        <span className="text-muted-foreground">LINE：</span>
                        {contact.lineFriendLabel}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 ml-2">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => openContactDialog(contact)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-red-500 hover:text-red-700"
                      onClick={() => setDeletingContact(contact)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 子代理店 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>子代理店</CardTitle>
          <Button size="sm" onClick={openChildDialog}>
            <Plus className="h-4 w-4 mr-1" />
            子代理店を追加
          </Button>
        </CardHeader>
        <CardContent>
          {agency.children.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              子代理店が登録されていません
            </p>
          ) : (
            <div className="space-y-2">
              {agency.children.map((child) => (
                <div
                  key={child.id}
                  className="flex items-start justify-between border rounded-lg p-3 hover:bg-gray-50"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Link
                        href={`/slp/agencies/${child.id}`}
                        className="text-blue-600 hover:underline font-medium"
                      >
                        ID {child.id}: {child.name}
                      </Link>
                      <Badge variant="outline" className="text-xs">
                        担当者{child.contacts.length}名
                      </Badge>
                    </div>
                    {child.contacts.length > 0 && (
                      <div className="text-xs text-muted-foreground">
                        {child.contacts
                          .map(
                            (c) => `${c.name}${c.role ? `(${c.role})` : ""}`
                          )
                          .join(", ")}
                      </div>
                    )}
                    {child.notes && (
                      <div className="text-xs text-muted-foreground mt-1 line-clamp-1">
                        備考: {child.notes}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 ml-2">
                    <Button size="sm" variant="outline" asChild>
                      <Link href={`/slp/agencies/${child.id}`}>編集</Link>
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-red-500 hover:text-red-700"
                      onClick={() => setDeletingChild(child)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 担当者ダイアログ */}
      <Dialog open={contactDialogOpen} onOpenChange={setContactDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingContact ? "担当者を編集" : "担当者を追加"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>名前 *</Label>
              <Input
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="山田太郎"
              />
            </div>
            <div>
              <Label>役割</Label>
              <Input
                value={contactRole}
                onChange={(e) => setContactRole(e.target.value)}
                placeholder="代表者・主担当者など"
              />
            </div>
            <div>
              <Label>メールアドレス</Label>
              <Input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
              />
            </div>
            <div>
              <Label>電話番号</Label>
              <Input
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
              />
            </div>
            <div>
              <Label>LINE番号</Label>
              <Select
                value={contactLineFriendId}
                onValueChange={setContactLineFriendId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="LINE友達を選択" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNSET}>未設定</SelectItem>
                  {lineFriendOptions.map((f) => (
                    <SelectItem key={f.id} value={String(f.id)}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setContactDialogOpen(false)}
            >
              キャンセル
            </Button>
            <Button onClick={handleSaveContact} disabled={!contactName.trim()}>
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 担当者削除確認 */}
      <AlertDialog
        open={!!deletingContact}
        onOpenChange={(open) => !open && setDeletingContact(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>担当者を削除</AlertDialogTitle>
            <AlertDialogDescription>
              「{deletingContact?.name}」を削除してよろしいですか？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteContact}
              className="bg-red-600 hover:bg-red-700"
            >
              削除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 子代理店削除確認 */}
      <AlertDialog
        open={!!deletingChild}
        onOpenChange={(open) => !open && setDeletingChild(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>子代理店を削除</AlertDialogTitle>
            <AlertDialogDescription>
              「{deletingChild?.name}」を削除してよろしいですか？孫代理店もすべて削除されます。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteChild}
              className="bg-red-600 hover:bg-red-700"
            >
              削除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 子代理店追加ダイアログ */}
      <Dialog open={childDialogOpen} onOpenChange={setChildDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>子代理店を追加</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>代理店名 *</Label>
              <Input
                value={newChildName}
                onChange={(e) => setNewChildName(e.target.value)}
                placeholder="子代理店名"
              />
            </div>
            <div>
              <Label>備考</Label>
              <Textarea
                value={newChildNotes}
                onChange={(e) => setNewChildNotes(e.target.value)}
                placeholder="備考"
                rows={3}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              ※ 担当者は作成後の詳細画面から追加できます。
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setChildDialogOpen(false)}
              disabled={creatingChild}
            >
              キャンセル
            </Button>
            <Button
              onClick={handleCreateChild}
              disabled={creatingChild || !newChildName.trim()}
            >
              {creatingChild ? "保存中..." : "保存して詳細を編集"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
