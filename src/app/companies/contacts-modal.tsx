"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
} from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Pencil, Trash2, Star, Building2, Users, Landmark } from "lucide-react";
import { toast } from "sonner";
import {
  addContact,
  updateContact,
  deleteContact,
  getDepartments,
} from "./contact-actions";
import {
  addLocation,
  updateLocation,
  deleteLocation,
} from "./location-actions";
import {
  addBankAccount,
  updateBankAccount,
  deleteBankAccount,
} from "./bank-account-actions";
import { Combobox } from "@/components/ui/combobox";

type Location = {
  id: number;
  companyId: number;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  isPrimary: boolean;
  note: string | null;
};

type Contact = {
  id: number;
  companyId: number;
  name: string;
  email: string | null;
  phone: string | null;
  department: string | null;
  isPrimary: boolean;
  note: string | null;
};

type BankAccount = {
  id: number;
  companyId: number;
  bankName: string;
  bankCode: string;
  branchName: string;
  branchCode: string;
  accountNumber: string;
  accountHolderName: string;
  note: string | null;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: number;
  companyName: string;
  locations: Record<string, unknown>[];
  contacts: Record<string, unknown>[];
  bankAccounts: Record<string, unknown>[];
};

export function ContactsModal({
  open,
  onOpenChange,
  companyId,
  companyName,
  locations: initialLocations,
  contacts: initialContacts,
  bankAccounts: initialBankAccounts,
}: Props) {
  const [locations, setLocations] = useState<Location[]>(
    initialLocations as unknown as Location[]
  );
  const [contacts, setContacts] = useState<Contact[]>(
    initialContacts as unknown as Contact[]
  );
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>(
    initialBankAccounts as unknown as BankAccount[]
  );
  const [activeTab, setActiveTab] = useState<string>("locations");

  // Update state when props change (e.g., when modal opens for different company)
  useEffect(() => {
    setLocations(initialLocations as unknown as Location[]);
    setContacts(initialContacts as unknown as Contact[]);
    setBankAccounts(initialBankAccounts as unknown as BankAccount[]);
    // Reset form states when modal opens
    setIsAddLocationMode(false);
    setEditLocation(null);
    setLocationFormData({});
    setIsAddContactMode(false);
    setEditContact(null);
    setContactFormData({});
    setIsAddBankAccountMode(false);
    setEditBankAccount(null);
    setBankAccountFormData({});
    setDeleteLocationConfirm(null);
    setDeleteContactConfirm(null);
    setDeleteBankAccountConfirm(null);
  }, [initialLocations, initialContacts, initialBankAccounts, open]);

  // Location state
  const [isAddLocationMode, setIsAddLocationMode] = useState(false);
  const [editLocation, setEditLocation] = useState<Location | null>(null);
  const [deleteLocationConfirm, setDeleteLocationConfirm] = useState<Location | null>(null);
  const [locationFormData, setLocationFormData] = useState<Partial<Location>>({});

  // Contact state
  const [isAddContactMode, setIsAddContactMode] = useState(false);
  const [editContact, setEditContact] = useState<Contact | null>(null);
  const [deleteContactConfirm, setDeleteContactConfirm] = useState<Contact | null>(null);
  const [contactFormData, setContactFormData] = useState<Partial<Contact>>({});
  const [departments, setDepartments] = useState<string[]>([]);

  // Bank account state
  const [isAddBankAccountMode, setIsAddBankAccountMode] = useState(false);
  const [editBankAccount, setEditBankAccount] = useState<BankAccount | null>(null);
  const [deleteBankAccountConfirm, setDeleteBankAccountConfirm] = useState<BankAccount | null>(null);
  const [bankAccountFormData, setBankAccountFormData] = useState<Partial<BankAccount>>({});

  const [loading, setLoading] = useState(false);
  const [primaryLoading, setPrimaryLoading] = useState<number | null>(null);

  useEffect(() => {
    if (open) {
      getDepartments().then(setDepartments);
    }
  }, [open]);

  // Handler to set primary location
  const handleSetPrimaryLocation = async (location: Location) => {
    if (location.isPrimary || primaryLoading) return;
    setPrimaryLoading(location.id);
    try {
      await updateLocation(location.id, { ...location, isPrimary: true });
      setLocations(
        locations.map((l) => ({
          ...l,
          isPrimary: l.id === location.id,
        }))
      );
      toast.success(`「${location.name}」を主要拠点に設定しました`);
    } catch {
      toast.error("更新に失敗しました");
    } finally {
      setPrimaryLoading(null);
    }
  };

  // Handler to set primary contact
  const handleSetPrimaryContact = async (contact: Contact) => {
    if (contact.isPrimary || primaryLoading) return;
    setPrimaryLoading(contact.id);
    try {
      await updateContact(contact.id, { ...contact, isPrimary: true });
      setContacts(
        contacts.map((c) => ({
          ...c,
          isPrimary: c.id === contact.id,
        }))
      );
      toast.success(`「${contact.name}」を主担当者に設定しました`);
    } catch {
      toast.error("更新に失敗しました");
    } finally {
      setPrimaryLoading(null);
    }
  };

  // Location handlers
  const openAddLocationForm = () => {
    setLocationFormData({
      name: "",
      address: null,
      phone: null,
      email: null,
      isPrimary: locations.length === 0,
      note: null,
    });
    setIsAddLocationMode(true);
  };

  const openEditLocationForm = (location: Location) => {
    setLocationFormData({ ...location });
    setEditLocation(location);
  };

  const handleAddLocation = async () => {
    if (!locationFormData.name) {
      toast.error("拠点名は必須です");
      return;
    }
    setLoading(true);
    try {
      const newLocation = await addLocation(companyId, locationFormData);
      if (locationFormData.isPrimary) {
        setLocations([
          ...locations.map((l) => ({ ...l, isPrimary: false })),
          newLocation as unknown as Location,
        ]);
      } else {
        setLocations([...locations, newLocation as unknown as Location]);
      }
      toast.success("拠点を追加しました");
      setIsAddLocationMode(false);
      setLocationFormData({});
    } catch {
      toast.error("追加に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateLocation = async () => {
    if (!editLocation || !locationFormData.name) {
      toast.error("拠点名は必須です");
      return;
    }
    setLoading(true);
    try {
      const updated = await updateLocation(editLocation.id, locationFormData);
      if (locationFormData.isPrimary) {
        setLocations(
          locations.map((l) =>
            l.id === editLocation.id
              ? (updated as unknown as Location)
              : { ...l, isPrimary: false }
          )
        );
      } else {
        setLocations(
          locations.map((l) =>
            l.id === editLocation.id ? (updated as unknown as Location) : l
          )
        );
      }
      toast.success("拠点を更新しました");
      setEditLocation(null);
      setLocationFormData({});
    } catch {
      toast.error("更新に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteLocation = async () => {
    if (!deleteLocationConfirm) return;
    setLoading(true);
    try {
      await deleteLocation(deleteLocationConfirm.id);
      setLocations(locations.filter((l) => l.id !== deleteLocationConfirm.id));
      toast.success("拠点を削除しました");
      setDeleteLocationConfirm(null);
    } catch {
      toast.error("削除に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  // Contact handlers
  const openAddContactForm = () => {
    setContactFormData({
      name: "",
      email: null,
      phone: null,
      department: null,
      isPrimary: contacts.length === 0,
      note: null,
    });
    setIsAddContactMode(true);
  };

  const openEditContactForm = (contact: Contact) => {
    setContactFormData({ ...contact });
    setEditContact(contact);
  };

  const handleAddContact = async () => {
    if (!contactFormData.name) {
      toast.error("担当者名は必須です");
      return;
    }
    setLoading(true);
    try {
      const newContact = await addContact(companyId, contactFormData);
      if (contactFormData.isPrimary) {
        setContacts([
          ...contacts.map((c) => ({ ...c, isPrimary: false })),
          newContact as unknown as Contact,
        ]);
      } else {
        setContacts([...contacts, newContact as unknown as Contact]);
      }
      if (contactFormData.department && !departments.includes(contactFormData.department)) {
        setDepartments([...departments, contactFormData.department].sort());
      }
      toast.success("担当者を追加しました");
      setIsAddContactMode(false);
      setContactFormData({});
    } catch {
      toast.error("追加に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateContact = async () => {
    if (!editContact || !contactFormData.name) {
      toast.error("担当者名は必須です");
      return;
    }
    setLoading(true);
    try {
      const updated = await updateContact(editContact.id, contactFormData);
      if (contactFormData.isPrimary) {
        setContacts(
          contacts.map((c) =>
            c.id === editContact.id
              ? (updated as unknown as Contact)
              : { ...c, isPrimary: false }
          )
        );
      } else {
        setContacts(
          contacts.map((c) =>
            c.id === editContact.id ? (updated as unknown as Contact) : c
          )
        );
      }
      if (contactFormData.department && !departments.includes(contactFormData.department)) {
        setDepartments([...departments, contactFormData.department].sort());
      }
      toast.success("担当者を更新しました");
      setEditContact(null);
      setContactFormData({});
    } catch {
      toast.error("更新に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteContact = async () => {
    if (!deleteContactConfirm) return;
    setLoading(true);
    try {
      await deleteContact(deleteContactConfirm.id);
      setContacts(contacts.filter((c) => c.id !== deleteContactConfirm.id));
      toast.success("担当者を削除しました");
      setDeleteContactConfirm(null);
    } catch {
      toast.error("削除に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  // Bank account handlers
  const openAddBankAccountForm = () => {
    setBankAccountFormData({
      bankName: "",
      bankCode: "",
      branchName: "",
      branchCode: "",
      accountNumber: "",
      accountHolderName: "",
      note: null,
    });
    setIsAddBankAccountMode(true);
  };

  const openEditBankAccountForm = (bankAccount: BankAccount) => {
    setBankAccountFormData({ ...bankAccount });
    setEditBankAccount(bankAccount);
  };

  const handleAddBankAccount = async () => {
    if (!bankAccountFormData.bankName || !bankAccountFormData.bankCode ||
        !bankAccountFormData.branchName || !bankAccountFormData.branchCode ||
        !bankAccountFormData.accountNumber || !bankAccountFormData.accountHolderName) {
      toast.error("銀行名、銀行コード、支店名、支店コード、口座番号、口座名義人は必須です");
      return;
    }
    setLoading(true);
    try {
      const newBankAccount = await addBankAccount(companyId, bankAccountFormData);
      setBankAccounts([...bankAccounts, newBankAccount as unknown as BankAccount]);
      toast.success("銀行情報を追加しました");
      setIsAddBankAccountMode(false);
      setBankAccountFormData({});
    } catch {
      toast.error("追加に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateBankAccount = async () => {
    if (!editBankAccount ||
        !bankAccountFormData.bankName || !bankAccountFormData.bankCode ||
        !bankAccountFormData.branchName || !bankAccountFormData.branchCode ||
        !bankAccountFormData.accountNumber || !bankAccountFormData.accountHolderName) {
      toast.error("銀行名、銀行コード、支店名、支店コード、口座番号、口座名義人は必須です");
      return;
    }
    setLoading(true);
    try {
      const updated = await updateBankAccount(editBankAccount.id, bankAccountFormData);
      setBankAccounts(
        bankAccounts.map((b) =>
          b.id === editBankAccount.id ? (updated as unknown as BankAccount) : b
        )
      );
      toast.success("銀行情報を更新しました");
      setEditBankAccount(null);
      setBankAccountFormData({});
    } catch {
      toast.error("更新に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBankAccount = async () => {
    if (!deleteBankAccountConfirm) return;
    setLoading(true);
    try {
      await deleteBankAccount(deleteBankAccountConfirm.id);
      setBankAccounts(bankAccounts.filter((b) => b.id !== deleteBankAccountConfirm.id));
      toast.success("銀行情報を削除しました");
      setDeleteBankAccountConfirm(null);
    } catch {
      toast.error("削除に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const renderLocationForm = () => (
    <div className="space-y-4 border rounded-lg p-4 bg-muted/50">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>
            拠点名 <span className="text-destructive">*</span>
          </Label>
          <Input
            value={locationFormData.name || ""}
            onChange={(e) =>
              setLocationFormData({ ...locationFormData, name: e.target.value })
            }
            placeholder="本社、大阪支店など"
          />
        </div>
        <div className="space-y-2">
          <Label>電話番号</Label>
          <Input
            value={locationFormData.phone || ""}
            onChange={(e) =>
              setLocationFormData({ ...locationFormData, phone: e.target.value || null })
            }
            placeholder="03-1234-5678"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label>メールアドレス</Label>
        <Input
          type="email"
          value={locationFormData.email || ""}
          onChange={(e) =>
            setLocationFormData({ ...locationFormData, email: e.target.value || null })
          }
          placeholder="info@company.co.jp"
        />
      </div>
      <div className="space-y-2">
        <Label>住所</Label>
        <Input
          value={locationFormData.address || ""}
          onChange={(e) =>
            setLocationFormData({ ...locationFormData, address: e.target.value || null })
          }
          placeholder="東京都千代田区..."
        />
      </div>
      <div className="space-y-2">
        <Label>備考</Label>
        <Textarea
          value={locationFormData.note || ""}
          onChange={(e) =>
            setLocationFormData({ ...locationFormData, note: e.target.value || null })
          }
          rows={2}
        />
      </div>
      <div className="flex items-center space-x-2">
        <Checkbox
          id="locationIsPrimary"
          checked={locationFormData.isPrimary || false}
          onCheckedChange={(checked) =>
            setLocationFormData({ ...locationFormData, isPrimary: checked === true })
          }
        />
        <Label htmlFor="locationIsPrimary" className="cursor-pointer">
          主要拠点として設定
        </Label>
      </div>
      <div className="flex gap-2 justify-end">
        <Button
          variant="outline"
          onClick={() => {
            setIsAddLocationMode(false);
            setEditLocation(null);
            setLocationFormData({});
          }}
        >
          キャンセル
        </Button>
        <Button
          onClick={isAddLocationMode ? handleAddLocation : handleUpdateLocation}
          disabled={loading}
        >
          {loading ? "保存中..." : isAddLocationMode ? "追加" : "更新"}
        </Button>
      </div>
    </div>
  );

  const renderContactForm = () => (
    <div className="space-y-4 border rounded-lg p-4 bg-muted/50">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>
            担当者名 <span className="text-destructive">*</span>
          </Label>
          <Input
            value={contactFormData.name || ""}
            onChange={(e) =>
              setContactFormData({ ...contactFormData, name: e.target.value })
            }
            placeholder="山田太郎"
          />
        </div>
        <div className="space-y-2">
          <Label>担当部署</Label>
          <Combobox
            options={departments.map((d) => ({ value: d, label: d }))}
            value={contactFormData.department || ""}
            onChange={(value) =>
              setContactFormData({ ...contactFormData, department: value || null })
            }
            placeholder="部署を選択または入力"
            allowCustom
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>メールアドレス</Label>
          <Input
            type="email"
            value={contactFormData.email || ""}
            onChange={(e) =>
              setContactFormData({ ...contactFormData, email: e.target.value || null })
            }
            placeholder="example@company.co.jp"
          />
        </div>
        <div className="space-y-2">
          <Label>電話番号</Label>
          <Input
            value={contactFormData.phone || ""}
            onChange={(e) =>
              setContactFormData({ ...contactFormData, phone: e.target.value || null })
            }
            placeholder="03-1234-5678"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label>備考</Label>
        <Textarea
          value={contactFormData.note || ""}
          onChange={(e) =>
            setContactFormData({ ...contactFormData, note: e.target.value || null })
          }
          rows={2}
        />
      </div>
      <div className="flex items-center space-x-2">
        <Checkbox
          id="contactIsPrimary"
          checked={contactFormData.isPrimary || false}
          onCheckedChange={(checked) =>
            setContactFormData({ ...contactFormData, isPrimary: checked === true })
          }
        />
        <Label htmlFor="contactIsPrimary" className="cursor-pointer">
          主担当者として設定
        </Label>
      </div>
      <div className="flex gap-2 justify-end">
        <Button
          variant="outline"
          onClick={() => {
            setIsAddContactMode(false);
            setEditContact(null);
            setContactFormData({});
          }}
        >
          キャンセル
        </Button>
        <Button
          onClick={isAddContactMode ? handleAddContact : handleUpdateContact}
          disabled={loading}
        >
          {loading ? "保存中..." : isAddContactMode ? "追加" : "更新"}
        </Button>
      </div>
    </div>
  );

  const renderBankAccountForm = () => (
    <div className="space-y-4 border rounded-lg p-4 bg-muted/50">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>
            銀行名 <span className="text-destructive">*</span>
          </Label>
          <Input
            value={bankAccountFormData.bankName || ""}
            onChange={(e) =>
              setBankAccountFormData({ ...bankAccountFormData, bankName: e.target.value })
            }
            placeholder="みずほ銀行"
          />
        </div>
        <div className="space-y-2">
          <Label>
            銀行コード <span className="text-destructive">*</span>
          </Label>
          <Input
            value={bankAccountFormData.bankCode || ""}
            onChange={(e) =>
              setBankAccountFormData({ ...bankAccountFormData, bankCode: e.target.value })
            }
            placeholder="0001"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>
            支店名 <span className="text-destructive">*</span>
          </Label>
          <Input
            value={bankAccountFormData.branchName || ""}
            onChange={(e) =>
              setBankAccountFormData({ ...bankAccountFormData, branchName: e.target.value })
            }
            placeholder="東京営業部"
          />
        </div>
        <div className="space-y-2">
          <Label>
            支店コード <span className="text-destructive">*</span>
          </Label>
          <Input
            value={bankAccountFormData.branchCode || ""}
            onChange={(e) =>
              setBankAccountFormData({ ...bankAccountFormData, branchCode: e.target.value })
            }
            placeholder="001"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>
            口座番号 <span className="text-destructive">*</span>
          </Label>
          <Input
            value={bankAccountFormData.accountNumber || ""}
            onChange={(e) =>
              setBankAccountFormData({ ...bankAccountFormData, accountNumber: e.target.value })
            }
            placeholder="1234567"
          />
        </div>
        <div className="space-y-2">
          <Label>
            口座名義人 <span className="text-destructive">*</span>
          </Label>
          <Input
            value={bankAccountFormData.accountHolderName || ""}
            onChange={(e) =>
              setBankAccountFormData({ ...bankAccountFormData, accountHolderName: e.target.value })
            }
            placeholder="カ）サンプルショウジ"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label>メモ</Label>
        <Textarea
          value={bankAccountFormData.note || ""}
          onChange={(e) =>
            setBankAccountFormData({ ...bankAccountFormData, note: e.target.value || null })
          }
          rows={2}
        />
      </div>
      <div className="flex gap-2 justify-end">
        <Button
          variant="outline"
          onClick={() => {
            setIsAddBankAccountMode(false);
            setEditBankAccount(null);
            setBankAccountFormData({});
          }}
        >
          キャンセル
        </Button>
        <Button
          onClick={isAddBankAccountMode ? handleAddBankAccount : handleUpdateBankAccount}
          disabled={loading}
        >
          {loading ? "保存中..." : isAddBankAccountMode ? "追加" : "更新"}
        </Button>
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="mixed" className="overflow-y-auto">
        <DialogHeader>
          <DialogTitle>連絡先管理 - {companyName}</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="grid w-full grid-cols-3 gap-1 rounded-lg bg-gray-100 p-1">
            <button
              type="button"
              onClick={() => setActiveTab("locations")}
              className={`flex items-center justify-center gap-2 rounded-md px-4 py-2 transition-all ${
                activeTab === "locations"
                  ? "bg-white text-gray-900 shadow-md font-bold text-base"
                  : "text-gray-400 text-sm hover:text-gray-600"
              }`}
            >
              <Building2 className="h-4 w-4" />
              企業拠点 ({locations.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("contacts")}
              className={`flex items-center justify-center gap-2 rounded-md px-4 py-2 transition-all ${
                activeTab === "contacts"
                  ? "bg-white text-gray-900 shadow-md font-bold text-base"
                  : "text-gray-400 text-sm hover:text-gray-600"
              }`}
            >
              <Users className="h-4 w-4" />
              担当者 ({contacts.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("bankAccounts")}
              className={`flex items-center justify-center gap-2 rounded-md px-4 py-2 transition-all ${
                activeTab === "bankAccounts"
                  ? "bg-white text-gray-900 shadow-md font-bold text-base"
                  : "text-gray-400 text-sm hover:text-gray-600"
              }`}
            >
              <Landmark className="h-4 w-4" />
              銀行情報 ({bankAccounts.length})
            </button>
          </div>

          <TabsContent value="locations" className="space-y-4">
            {/* 追加ボタン */}
            {!isAddLocationMode && !editLocation && (
              <div className="flex justify-end">
                <Button onClick={openAddLocationForm}>
                  <Plus className="mr-2 h-4 w-4" />
                  拠点を追加
                </Button>
              </div>
            )}

            {/* 追加/編集フォーム */}
            {(isAddLocationMode || editLocation) && renderLocationForm()}

            {/* 拠点一覧 */}
            {locations.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                拠点が登録されていません
              </div>
            ) : (
              <Table
                containerClassName="border rounded-lg flex-1 min-h-0"
                containerStyle={{ overflow: 'auto' }}
              >
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px]"></TableHead>
                    <TableHead>拠点名</TableHead>
                    <TableHead>電話番号</TableHead>
                    <TableHead>メールアドレス</TableHead>
                    <TableHead>住所</TableHead>
                    <TableHead className="w-[100px] sticky right-0 z-30 bg-white shadow-[-2px_0_4px_-2px_rgba(0,0,0,0.1)]">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {locations.map((location) => (
                    <TableRow key={location.id} className="group/row">
                      <TableCell>
                        <button
                          onClick={() => handleSetPrimaryLocation(location)}
                          disabled={location.isPrimary || primaryLoading === location.id || isAddLocationMode || !!editLocation}
                          className="p-1 hover:bg-muted rounded disabled:cursor-default"
                          title={location.isPrimary ? "主要拠点" : "クリックして主要拠点に設定"}
                        >
                          <Star
                            className={`h-4 w-4 ${
                              location.isPrimary
                                ? "text-yellow-500 fill-yellow-500"
                                : "text-gray-300 hover:text-yellow-400"
                            } ${primaryLoading === location.id ? "animate-pulse" : ""}`}
                          />
                        </button>
                      </TableCell>
                      <TableCell className="font-medium">
                        {location.name}
                      </TableCell>
                      <TableCell>{location.phone || "-"}</TableCell>
                      <TableCell>
                        {location.email ? (
                          <a
                            href={`mailto:${location.email}`}
                            className="hover:underline"
                          >
                            {location.email}
                          </a>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {location.address || "-"}
                      </TableCell>
                      <TableCell className="sticky right-0 z-10 bg-white group-hover/row:bg-gray-50 shadow-[-2px_0_4px_-2px_rgba(0,0,0,0.1)]">
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditLocationForm(location)}
                            disabled={isAddLocationMode || !!editLocation}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteLocationConfirm(location)}
                            disabled={isAddLocationMode || !!editLocation}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            {/* 削除確認 */}
            {deleteLocationConfirm && (
              <div className="border rounded-lg p-4 bg-destructive/10">
                <p className="mb-4">
                  「{deleteLocationConfirm.name}」を削除しますか？
                  この操作は取り消せません。
                </p>
                <div className="flex gap-2 justify-end">
                  <Button
                    variant="outline"
                    onClick={() => setDeleteLocationConfirm(null)}
                  >
                    キャンセル
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleDeleteLocation}
                    disabled={loading}
                  >
                    {loading ? "削除中..." : "削除"}
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="contacts" className="space-y-4">
            {/* 追加ボタン */}
            {!isAddContactMode && !editContact && (
              <div className="flex justify-end">
                <Button onClick={openAddContactForm}>
                  <Plus className="mr-2 h-4 w-4" />
                  担当者を追加
                </Button>
              </div>
            )}

            {/* 追加/編集フォーム */}
            {(isAddContactMode || editContact) && renderContactForm()}

            {/* 担当者一覧 */}
            {contacts.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                担当者が登録されていません
              </div>
            ) : (
              <Table
                containerClassName="border rounded-lg flex-1 min-h-0"
                containerStyle={{ overflow: 'auto' }}
              >
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px]"></TableHead>
                    <TableHead>担当者名</TableHead>
                    <TableHead>部署</TableHead>
                    <TableHead>電話番号</TableHead>
                    <TableHead>メールアドレス</TableHead>
                    <TableHead className="w-[100px] sticky right-0 z-30 bg-white shadow-[-2px_0_4px_-2px_rgba(0,0,0,0.1)]">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contacts.map((contact) => (
                    <TableRow key={contact.id} className="group/row">
                      <TableCell>
                        <button
                          onClick={() => handleSetPrimaryContact(contact)}
                          disabled={contact.isPrimary || primaryLoading === contact.id || isAddContactMode || !!editContact}
                          className="p-1 hover:bg-muted rounded disabled:cursor-default"
                          title={contact.isPrimary ? "主担当者" : "クリックして主担当者に設定"}
                        >
                          <Star
                            className={`h-4 w-4 ${
                              contact.isPrimary
                                ? "text-yellow-500 fill-yellow-500"
                                : "text-gray-300 hover:text-yellow-400"
                            } ${primaryLoading === contact.id ? "animate-pulse" : ""}`}
                          />
                        </button>
                      </TableCell>
                      <TableCell className="font-medium">
                        {contact.name}
                      </TableCell>
                      <TableCell>{contact.department || "-"}</TableCell>
                      <TableCell>{contact.phone || "-"}</TableCell>
                      <TableCell>
                        {contact.email ? (
                          <a
                            href={`mailto:${contact.email}`}
                            className="hover:underline"
                          >
                            {contact.email}
                          </a>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell className="sticky right-0 z-10 bg-white group-hover/row:bg-gray-50 shadow-[-2px_0_4px_-2px_rgba(0,0,0,0.1)]">
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditContactForm(contact)}
                            disabled={isAddContactMode || !!editContact}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteContactConfirm(contact)}
                            disabled={isAddContactMode || !!editContact}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            {/* 削除確認 */}
            {deleteContactConfirm && (
              <div className="border rounded-lg p-4 bg-destructive/10">
                <p className="mb-4">
                  「{deleteContactConfirm.name}」を削除しますか？
                  この操作は取り消せません。
                </p>
                <div className="flex gap-2 justify-end">
                  <Button
                    variant="outline"
                    onClick={() => setDeleteContactConfirm(null)}
                  >
                    キャンセル
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleDeleteContact}
                    disabled={loading}
                  >
                    {loading ? "削除中..." : "削除"}
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="bankAccounts" className="space-y-4">
            {/* 追加ボタン */}
            {!isAddBankAccountMode && !editBankAccount && (
              <div className="flex justify-end">
                <Button onClick={openAddBankAccountForm}>
                  <Plus className="mr-2 h-4 w-4" />
                  銀行情報を追加
                </Button>
              </div>
            )}

            {/* 追加/編集フォーム */}
            {(isAddBankAccountMode || editBankAccount) && renderBankAccountForm()}

            {/* 銀行情報一覧 */}
            {bankAccounts.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                銀行情報が登録されていません
              </div>
            ) : (
              <Table
                containerClassName="border rounded-lg flex-1 min-h-0"
                containerStyle={{ overflow: 'auto' }}
              >
                <TableHeader>
                  <TableRow>
                    <TableHead>銀行名</TableHead>
                    <TableHead>銀行コード</TableHead>
                    <TableHead>支店名</TableHead>
                    <TableHead>支店コード</TableHead>
                    <TableHead>口座番号</TableHead>
                    <TableHead>口座名義人</TableHead>
                    <TableHead>メモ</TableHead>
                    <TableHead className="w-[100px] sticky right-0 z-30 bg-white shadow-[-2px_0_4px_-2px_rgba(0,0,0,0.1)]">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bankAccounts.map((bankAccount) => (
                    <TableRow key={bankAccount.id} className="group/row">
                      <TableCell className="font-medium">{bankAccount.bankName}</TableCell>
                      <TableCell className="font-mono">{bankAccount.bankCode}</TableCell>
                      <TableCell>{bankAccount.branchName}</TableCell>
                      <TableCell className="font-mono">{bankAccount.branchCode}</TableCell>
                      <TableCell className="font-mono">{bankAccount.accountNumber}</TableCell>
                      <TableCell>{bankAccount.accountHolderName}</TableCell>
                      <TableCell className="max-w-[150px] truncate">
                        {bankAccount.note || "-"}
                      </TableCell>
                      <TableCell className="sticky right-0 z-10 bg-white group-hover/row:bg-gray-50 shadow-[-2px_0_4px_-2px_rgba(0,0,0,0.1)]">
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditBankAccountForm(bankAccount)}
                            disabled={isAddBankAccountMode || !!editBankAccount}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteBankAccountConfirm(bankAccount)}
                            disabled={isAddBankAccountMode || !!editBankAccount}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            {/* 削除確認 */}
            {deleteBankAccountConfirm && (
              <div className="border rounded-lg p-4 bg-destructive/10">
                <p className="mb-4">
                  「{deleteBankAccountConfirm.bankName} {deleteBankAccountConfirm.branchName}」の銀行情報を削除しますか？
                  この操作は取り消せません。
                </p>
                <div className="flex gap-2 justify-end">
                  <Button
                    variant="outline"
                    onClick={() => setDeleteBankAccountConfirm(null)}
                  >
                    キャンセル
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleDeleteBankAccount}
                    disabled={loading}
                  >
                    {loading ? "削除中..." : "削除"}
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
