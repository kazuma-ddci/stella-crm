"use client";

import { useState, useEffect, useCallback, useRef, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  X,
  Send,
  Save,
  Loader2,
  Plus,
  FileText,
  PenTool,
  Type,
  CheckSquare,
  Eye,
  Edit3,
  UserCircle,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { PdfPreviewWithOverlay } from "@/components/pdf-preview-with-overlay";
import { saveDraftContract, sendContractViaCloudsign, getCloudsignSelfSigningUrl } from "@/app/stp/cloudsign-actions";

// ============================================
// Types
// ============================================

type TemplateInfo = {
  id: number;
  cloudsignTemplateId: string;
  name: string;
  description: string | null;
};

type ContractType = {
  id: number;
  name: string;
  templates: TemplateInfo[];
};

type Contact = {
  id: number;
  name: string;
  email: string | null;
  position: string | null;
};

type CSWidget = {
  id: string;
  widget_type: number;
  participant_id: string;
  file_id: string;
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
  label: string;
  required?: boolean;
};

type CSParticipant = {
  id: string;
  email: string;
  name: string;
  organization: string;
  order: number;
};

type CSFile = {
  id: string;
  name: string;
  order: number;
  total_pages: number;
  widgets: CSWidget[];
};

type DraftDocument = {
  id: string;
  title: string;
  participants: CSParticipant[];
  files: CSFile[];
};

type WidgetInfo = {
  id: string;
  fileId: string;
  fileIndex: number;
  fileName: string;
  widgetType: number;
  label: string;
  page: number;
  required: boolean;
  isSender: boolean;
  participantId: string;
};

/** participant ごとの編集状態 */
type ParticipantEdit = {
  participantId: string;
  order: number;
  email: string;
  name: string;
  isFromTemplate: boolean;
  widgets: WidgetInfo[];
};

type ResumeDraft = {
  contractId: number;
  contractNumber: string;
  cloudsignDocumentId: string;
  contractType: string;
  title: string;
  cloudsignTitle?: string | null;
  assignedTo?: string | null;
  note?: string | null;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: number;
  companyName: string;
  projectId: number;
  contractTypes: ContractType[];
  contacts: Contact[];
  operatingCompany: {
    id: number;
    companyName: string;
    cloudsignClientId: string | null;
  } | null;
  staffOptions: { value: string; label: string }[];
  onSuccess?: () => void;
  resumeDraft?: ResumeDraft;
};

// ============================================
// Hooks
// ============================================

function useMediaQuery(query: string) {
  const subscribe = useCallback(
    (cb: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", cb);
      return () => mql.removeEventListener("change", cb);
    },
    [query]
  );
  const getSnapshot = useCallback(() => window.matchMedia(query).matches, [query]);
  const getServerSnapshot = useCallback(() => false, []);
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

// ============================================
// Helpers
// ============================================

function widgetTypeIcon(type: number, className = "h-3.5 w-3.5") {
  switch (type) {
    case 0: return <PenTool className={`${className} text-purple-500`} />;
    case 1: return <Type className={`${className} text-blue-500`} />;
    case 2: return <CheckSquare className={`${className} text-green-500`} />;
    default: return null;
  }
}

function widgetTypeName(type: number) {
  switch (type) {
    case 0: return "署名";
    case 1: return "フリーテキスト";
    case 2: return "チェックボックス";
    default: return "不明";
  }
}

// ============================================
// Main Component
// ============================================

export function ContractSendModal({
  open,
  onOpenChange,
  companyId,
  companyName,
  projectId,
  contractTypes,
  contacts,
  operatingCompany,
  staffOptions,
  onSuccess,
  resumeDraft,
}: Props) {
  const router = useRouter();
  const isWide = useMediaQuery("(min-width: 1024px)");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 自社署名ダイアログの状態
  const [signingDialogOpen, setSigningDialogOpen] = useState(false);
  const [signingDialogContractId, setSigningDialogContractId] = useState<number | null>(null);
  const [signingDialogContractNumber, setSigningDialogContractNumber] = useState<string>("");
  const [signingUrl, setSigningUrl] = useState<string | null>(null);
  const [signingUrlLoading, setSigningUrlLoading] = useState(false);

  // Step 1
  const [selectedContractTypeId, setSelectedContractTypeId] = useState<string>("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [title, setTitle] = useState("");
  const [useCustomCloudsignTitle, setUseCustomCloudsignTitle] = useState(false);
  const [cloudsignTitle, setCloudsignTitle] = useState("");

  // Step 2
  const [draftDocument, setDraftDocument] = useState<DraftDocument | null>(null);
  const [loadingDraft, setLoadingDraft] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);

  // Widgets
  const [senderWidgets, setSenderWidgets] = useState<WidgetInfo[]>([]);
  const [widgetValues, setWidgetValues] = useState<Record<string, string>>({});

  // PDF
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);

  // Participants (participant-based UI)
  const [senderInfo, setSenderInfo] = useState<{ name: string; email: string; widgets: WidgetInfo[] } | null>(null);
  const [participantEdits, setParticipantEdits] = useState<ParticipantEdit[]>([]);

  // その他
  const [assignedTo, setAssignedTo] = useState("");
  const [note, setNote] = useState("");

  // 下書きDB管理
  const [draftContractId, setDraftContractId] = useState<number | null>(null);
  const [draftContractNumber, setDraftContractNumber] = useState<string>("");

  // Widget refs for scroll
  const widgetRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Tab for narrow layout
  const [activeTab, setActiveTab] = useState<string>("preview");

  // All widgets flat (for PDF overlay)
  const [allWidgets, setAllWidgets] = useState<CSWidget[]>([]);
  const [senderParticipantId, setSenderParticipantId] = useState<string>("");

  // Reset
  useEffect(() => {
    if (open) {
      setSelectedContractTypeId("");
      setSelectedTemplateId("");
      setTitle("");
      setUseCustomCloudsignTitle(false);
      setCloudsignTitle("");
      setDraftDocument(null);
      setLoadingDraft(false);
      setDraftError(null);
      setSenderWidgets([]);
      setWidgetValues({});
      setPdfBlobUrl(null);
      setSenderInfo(null);
      setParticipantEdits([]);
      setAssignedTo("");
      setNote("");
      setActiveTab("preview");
      setAllWidgets([]);
      setSenderParticipantId("");
      setDraftContractId(null);
      setDraftContractNumber("");

      // 下書き再開モード
      if (resumeDraft) {
        setDraftContractId(resumeDraft.contractId);
        setDraftContractNumber(resumeDraft.contractNumber);
        setTitle(resumeDraft.title);
        if (resumeDraft.cloudsignTitle && resumeDraft.cloudsignTitle !== resumeDraft.title) {
          setUseCustomCloudsignTitle(true);
          setCloudsignTitle(resumeDraft.cloudsignTitle);
        }
        setAssignedTo(resumeDraft.assignedTo || "");
        setNote(resumeDraft.note || "");
        // 契約種別をセット
        const ct = contractTypes.find((c) => c.name === resumeDraft.contractType);
        if (ct) setSelectedContractTypeId(String(ct.id));
      }
    }
    return () => {
      if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl);
    };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedContractType = contractTypes.find(
    (c) => c.id === Number(selectedContractTypeId)
  );
  const availableTemplates = selectedContractType?.templates || [];
  const selectedTemplate = availableTemplates.find(
    (t) => String(t.id) === selectedTemplateId
  );

  useEffect(() => {
    setSelectedTemplateId("");
    setDraftDocument(null);
    setSenderWidgets([]);
    setWidgetValues({});
    setPdfBlobUrl(null);
    if (availableTemplates.length === 1) {
      setSelectedTemplateId(String(availableTemplates[0].id));
    }
  }, [selectedContractTypeId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setDraftDocument(null);
    setSenderWidgets([]);
    setWidgetValues({});
    setPdfBlobUrl(null);
  }, [selectedTemplateId]);

  // 下書き再開: CloudSignからドキュメントを再取得
  useEffect(() => {
    if (!open || !resumeDraft || !operatingCompany?.id) return;

    const loadResumeDraft = async () => {
      setLoadingDraft(true);
      setDraftError(null);
      try {
        // CloudSignからドキュメント情報を取得
        const docRes = await fetch(
          `/api/cloudsign/documents/${resumeDraft.cloudsignDocumentId}?operatingCompanyId=${operatingCompany.id}`
        );
        if (!docRes.ok) {
          throw new Error("下書きドキュメントの取得に失敗しました。CloudSign側で削除された可能性があります。");
        }

        const doc: DraftDocument = await docRes.json();
        setDraftDocument(doc);

        const senderParticipant = doc.participants.find((p) => p.order === 0);
        const senderPId = senderParticipant?.id || "";
        setSenderParticipantId(senderPId);

        const senderW: WidgetInfo[] = [];
        const defaults: Record<string, string> = {};
        const flatWidgets: CSWidget[] = [];
        const participantWidgetMap = new Map<string, WidgetInfo[]>();

        for (let fi = 0; fi < doc.files.length; fi++) {
          const file = doc.files[fi];
          for (const w of file.widgets) {
            flatWidgets.push(w);
            const wi: WidgetInfo = {
              id: w.id,
              fileId: file.id,
              fileIndex: fi,
              fileName: file.name,
              widgetType: w.widget_type,
              label: w.label || widgetTypeName(w.widget_type),
              page: w.page,
              required: w.required ?? false,
              isSender: w.participant_id === senderPId,
              participantId: w.participant_id,
            };

            if (w.participant_id === senderPId && w.widget_type !== 0) {
              senderW.push(wi);
              defaults[w.id] = w.widget_type === 2 ? (w.text === "1" ? "1" : "0") : (w.text || "");
            }

            const existing = participantWidgetMap.get(w.participant_id) || [];
            existing.push(wi);
            participantWidgetMap.set(w.participant_id, existing);
          }
        }

        setSenderWidgets(senderW);
        setWidgetValues(defaults);
        setAllWidgets(flatWidgets);

        if (senderParticipant) {
          setSenderInfo({
            name: senderParticipant.name,
            email: senderParticipant.email,
            widgets: participantWidgetMap.get(senderPId) || [],
          });
        }

        const recipientPs = doc.participants
          .filter((p) => p.order > 0)
          .sort((a, b) => a.order - b.order);

        setParticipantEdits(
          recipientPs.map((p) => ({
            participantId: p.id,
            order: p.order,
            email: p.email?.includes("@") ? p.email : "",
            name: p.email?.includes("@") ? (p.name || "") : "",
            isFromTemplate: true,
            widgets: participantWidgetMap.get(p.id) || [],
          }))
        );

        // PDF取得
        if (doc.files.length > 0) {
          const fileId = doc.files[0].id;
          const pdfRes = await fetch(
            `/api/cloudsign/documents/${doc.id}/files/${fileId}?operatingCompanyId=${operatingCompany.id}`
          );
          if (pdfRes.ok) {
            const blob = await pdfRes.blob();
            const url = URL.createObjectURL(blob);
            setPdfBlobUrl(url);
          }
        }
      } catch (err) {
        console.error("Resume draft error:", err);
        setDraftError(err instanceof Error ? err.message : "下書きの読み込みに失敗しました");
      } finally {
        setLoadingDraft(false);
      }
    };

    loadResumeDraft();
  }, [open, resumeDraft?.cloudsignDocumentId]); // eslint-disable-line react-hooks/exhaustive-deps

  const contactsWithEmail = contacts.filter((c) => c.email);

  // ドラフト作成
  const createDraft = useCallback(async () => {
    if (!selectedTemplate || !operatingCompany?.id || !title.trim()) return;

    setLoadingDraft(true);
    setDraftError(null);

    try {
      const res = await fetch("/api/cloudsign/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operatingCompanyId: operatingCompany.id,
          templateId: selectedTemplate.cloudsignTemplateId,
          title: useCustomCloudsignTitle
            ? cloudsignTitle.trim() || title.trim()
            : title.trim(),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "不明なエラー" }));
        throw new Error(err.error || "ドラフト作成に失敗しました");
      }

      const doc: DraftDocument = await res.json();
      setDraftDocument(doc);

      const senderParticipant = doc.participants.find((p) => p.order === 0);
      const senderPId = senderParticipant?.id || "";
      setSenderParticipantId(senderPId);

      // widget を participant ごとに分類
      const senderW: WidgetInfo[] = [];
      const defaults: Record<string, string> = {};
      const flatWidgets: CSWidget[] = [];
      const participantWidgetMap = new Map<string, WidgetInfo[]>();

      for (let fi = 0; fi < doc.files.length; fi++) {
        const file = doc.files[fi];
        for (const w of file.widgets) {
          flatWidgets.push(w);
          const wi: WidgetInfo = {
            id: w.id,
            fileId: file.id,
            fileIndex: fi,
            fileName: file.name,
            widgetType: w.widget_type,
            label: w.label || widgetTypeName(w.widget_type),
            page: w.page,
            required: w.required ?? false,
            isSender: w.participant_id === senderPId,
            participantId: w.participant_id,
          };

          if (w.participant_id === senderPId && w.widget_type !== 0) {
            senderW.push(wi);
            defaults[w.id] = w.widget_type === 2 ? "0" : "";
          }

          // participantごとにwidgetを集計
          const existing = participantWidgetMap.get(w.participant_id) || [];
          existing.push(wi);
          participantWidgetMap.set(w.participant_id, existing);
        }
      }

      setSenderWidgets(senderW);
      setWidgetValues(defaults);
      setAllWidgets(flatWidgets);

      // 送信元情報
      if (senderParticipant) {
        setSenderInfo({
          name: senderParticipant.name,
          email: senderParticipant.email,
          widgets: participantWidgetMap.get(senderPId) || [],
        });
      }

      // 受信者 participant の編集状態を構築
      const recipientPs = doc.participants
        .filter((p) => p.order > 0)
        .sort((a, b) => a.order - b.order);

      setParticipantEdits(
        recipientPs.map((p) => ({
          participantId: p.id,
          order: p.order,
          email: p.email?.includes("@") ? p.email : "",
          name: p.email?.includes("@") ? (p.name || "") : "",
          isFromTemplate: true,
          widgets: participantWidgetMap.get(p.id) || [],
        }))
      );

      // PDF取得
      if (doc.files.length > 0) {
        const fileId = doc.files[0].id;
        const pdfRes = await fetch(
          `/api/cloudsign/documents/${doc.id}/files/${fileId}?operatingCompanyId=${operatingCompany.id}`
        );
        if (pdfRes.ok) {
          const blob = await pdfRes.blob();
          const url = URL.createObjectURL(blob);
          setPdfBlobUrl(url);
        }
      }

      // ドラフトをDBに保存
      const saved = await saveDraftContract({
        companyId,
        projectId,
        contractType: selectedContractType?.name || "",
        title: title.trim(),
        cloudsignTitle: useCustomCloudsignTitle ? cloudsignTitle.trim() : undefined,
        cloudsignDocumentId: doc.id,
        assignedTo: assignedTo || undefined,
        note: note.trim() || undefined,
      });
      setDraftContractId(saved.id);
      setDraftContractNumber(saved.contractNumber);
    } catch (err) {
      console.error("Draft creation error:", err);
      setDraftError(err instanceof Error ? err.message : "ドラフト作成に失敗しました");
    } finally {
      setLoadingDraft(false);
    }
  }, [selectedTemplate, operatingCompany?.id, title, useCustomCloudsignTitle, cloudsignTitle]);

  // Participant 編集
  const updateParticipantField = (
    participantId: string,
    field: "email" | "name",
    value: string
  ) => {
    setParticipantEdits((prev) =>
      prev.map((p) =>
        p.participantId === participantId ? { ...p, [field]: value } : p
      )
    );
  };

  const fillParticipantFromContact = (participantId: string, contact: Contact) => {
    if (!contact.email) return;
    setParticipantEdits((prev) =>
      prev.map((p) =>
        p.participantId === participantId
          ? { ...p, email: contact.email!, name: contact.name }
          : p
      )
    );
  };

  const addNewParticipant = () => {
    const maxOrder = participantEdits.reduce((max, p) => Math.max(max, p.order), 0);
    setParticipantEdits((prev) => [
      ...prev,
      {
        participantId: `new-${Date.now()}`,
        order: maxOrder + 1,
        email: "",
        name: "",
        isFromTemplate: false,
        widgets: [],
      },
    ]);
  };

  const removeParticipant = (participantId: string) => {
    setParticipantEdits((prev) => prev.filter((p) => p.participantId !== participantId));
  };

  // Widget click → scroll to input
  const handleWidgetClick = useCallback((widgetId: string) => {
    if (!isWide) {
      setActiveTab("form");
    }
    setTimeout(() => {
      widgetRefs.current[widgetId]?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
  }, [isWide]);

  // バリデーション
  const hasSenderSignature = draftDocument
    ? draftDocument.files.some((f) =>
        f.widgets.some((w) => {
          const senderP = draftDocument.participants.find((p) => p.order === 0);
          return w.participant_id === senderP?.id && w.widget_type === 0;
        })
      )
    : false;

  const requiredWidgetsFilled = senderWidgets
    .filter((w) => w.required)
    .every((w) => {
      const val = widgetValues[w.id];
      if (w.widgetType === 2) return true;
      return val && val.trim() !== "";
    });

  const allRecipientsValid =
    participantEdits.length > 0 &&
    participantEdits.every((p) => {
      const email = p.email.trim();
      const name = p.name.trim();
      return email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && name;
    });

  const canSubmit =
    !!draftDocument &&
    !!selectedTemplate &&
    !!title.trim() &&
    allRecipientsValid &&
    requiredWidgetsFilled;

  // 送信処理
  const handleSubmit = async (sendImmediately: boolean) => {
    if (!canSubmit || !draftDocument || !selectedContractType) return;

    if (hasSenderSignature && sendImmediately) {
      toast.error(
        "送信元に署名欄があるため、直接送付できません。下書き保存してクラウドサインで署名後に送信してください。"
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const recipients = participantEdits
        .filter((p) => p.isFromTemplate)
        .map((p) => ({
          participantId: p.participantId,
          email: p.email.trim(),
          name: p.name.trim(),
        }));

      const newParticipants = participantEdits
        .filter((p) => !p.isFromTemplate)
        .map((p) => ({
          email: p.email.trim(),
          name: p.name.trim(),
        }));

      const widgetUpdates = senderWidgets
        .filter((w) => {
          const val = widgetValues[w.id];
          return val && val.trim() !== "";
        })
        .map((w) => ({
          fileId: w.fileId,
          widgetId: w.id,
          widgetType: w.widgetType,
          value: widgetValues[w.id],
        }));

      const result = await sendContractViaCloudsign({
        companyId,
        projectId,
        contractType: selectedContractType.name,
        title: title.trim(),
        cloudsignTitle: useCustomCloudsignTitle ? cloudsignTitle.trim() : undefined,
        cloudsignDocumentId: draftDocument.id,
        recipients,
        newParticipants: newParticipants.length > 0 ? newParticipants : undefined,
        widgetUpdates,
        assignedTo: assignedTo || undefined,
        note: note.trim() || undefined,
        sendImmediately,
        existingContractId: draftContractId || undefined,
      });

      if (sendImmediately && result.selfSigningRequired) {
        toast.success(`契約書「${result.contractNumber}」を送付しました`);
        // 自社署名ダイアログを表示
        setSigningDialogContractId(result.id);
        setSigningDialogContractNumber(result.contractNumber ?? "");
        setSigningUrl(null);
        setSigningUrlLoading(true);
        setSigningDialogOpen(true);
        // ポーリング開始
        pollSigningUrl(result.id);
      } else {
        toast.success(
          sendImmediately
            ? `契約書「${result.contractNumber}」を送付しました`
            : `契約書「${result.contractNumber}」を下書き保存しました`
        );
        onOpenChange(false);
        onSuccess?.();
        router.refresh();
      }
    } catch (error) {
      console.error("Error sending contract:", error);
      toast.error(error instanceof Error ? error.message : "送付に失敗しました");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ============================================
  // 署名URLポーリング
  // ============================================
  const pollSigningUrl = useCallback(async (contractId: number) => {
    const maxAttempts = 30; // 最大30回（約60秒）
    const interval = 2000; // 2秒間隔

    for (let i = 0; i < maxAttempts; i++) {
      try {
        const result = await getCloudsignSelfSigningUrl(contractId);
        if (result.status === "ready" && result.url) {
          setSigningUrl(result.url);
          setSigningUrlLoading(false);
          return;
        }
        if (result.status === "not_required") {
          setSigningUrlLoading(false);
          return;
        }
      } catch {
        // エラー時は続行
      }
      await new Promise((resolve) => setTimeout(resolve, interval));
    }
    // タイムアウト
    setSigningUrlLoading(false);
  }, []);

  const handleCloseSigningDialog = () => {
    setSigningDialogOpen(false);
    onOpenChange(false);
    onSuccess?.();
    router.refresh();
  };

  // ============================================
  // Shared: フォーム部分（Step2の右パネル / タブ）
  // ============================================
  const formContent = (
    <div className="space-y-4">
      {/* 送信元（表示のみ） */}
      {senderInfo && (
        <div className="p-3 bg-gray-50 rounded-lg border">
          <div className="flex items-center gap-1.5 mb-1">
            <UserCircle className="h-3.5 w-3.5 text-gray-500" />
            <span className="text-xs font-medium text-gray-700">送信元</span>
          </div>
          <p className="text-sm text-gray-600">
            {senderInfo.name || "（未設定）"}
            {senderInfo.email && (
              <span className="text-xs text-gray-400 ml-1">&lt;{senderInfo.email}&gt;</span>
            )}
          </p>
          {senderInfo.widgets.length > 0 && (
            <p className="text-[10px] text-gray-400 mt-1">
              入力項目: {senderInfo.widgets.map((w) => widgetTypeName(w.widgetType)).join("、")}
            </p>
          )}
        </div>
      )}

      {/* 受信者セクション */}
      {participantEdits.map((participant) => (
        <div key={participant.participantId} className="border rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-blue-500" />
              <span className="text-xs font-medium text-gray-700">
                受信者{participant.order}
              </span>
              {participant.widgets.length > 0 ? (
                <span className="text-[10px] text-gray-400">
                  ({participant.widgets.map((w) => widgetTypeName(w.widgetType)).join("、")})
                </span>
              ) : (
                <span className="text-[10px] text-orange-500">同意のみ</span>
              )}
            </div>
            {!participant.isFromTemplate && (
              <button
                onClick={() => removeParticipant(participant.participantId)}
                className="text-gray-400 hover:text-red-500"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="space-y-1.5">
            <div>
              <Label className="text-[10px] text-gray-500">名前 <span className="text-red-500">*</span></Label>
              <Input
                value={participant.name}
                onChange={(e) =>
                  updateParticipantField(participant.participantId, "name", e.target.value)
                }
                placeholder="名前を入力"
                className="h-8 text-sm"
              />
            </div>
            <div>
              <Label className="text-[10px] text-gray-500">メール <span className="text-red-500">*</span></Label>
              <Input
                value={participant.email}
                onChange={(e) =>
                  updateParticipantField(participant.participantId, "email", e.target.value)
                }
                placeholder="メールアドレスを入力"
                className="h-8 text-sm"
              />
            </div>
          </div>

          {/* 担当者から選択 */}
          {contactsWithEmail.length > 0 && (
            <div className="mt-2">
              <p className="text-[10px] text-gray-500 mb-1">担当者から選択</p>
              <div className="flex flex-wrap gap-1">
                {contactsWithEmail.map((c) => (
                  <Button
                    key={c.id}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs h-6 px-2"
                    onClick={() => fillParticipantFromContact(participant.participantId, c)}
                  >
                    {c.name}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}

      {/* 受信者を追加 */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full text-xs"
        onClick={addNewParticipant}
      >
        <Plus className="h-3.5 w-3.5 mr-1" />
        受信者を追加（同意のみ）
      </Button>

      {/* 区切り線 */}
      <div className="border-t" />

      {/* 送信元の入力項目 */}
      {senderWidgets.length > 0 ? (
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">
            入力項目（送信元） — {senderWidgets.length}件
          </h3>
          <div className="space-y-2">
            {senderWidgets.map((widget, idx) => (
              <div
                key={widget.id}
                ref={(el) => { widgetRefs.current[widget.id] = el; }}
                className="border rounded-lg p-2.5"
              >
                <div className="flex items-center gap-1.5 mb-1">
                  {widgetTypeIcon(widget.widgetType, "h-3 w-3")}
                  <span className="text-xs font-medium">
                    {widget.label || `入力項目 ${idx + 1}`}
                  </span>
                  {widget.required && (
                    <span className="text-red-500 text-xs">*</span>
                  )}
                  <span className="text-[10px] text-gray-400 ml-auto">
                    P{widget.page + 1}
                  </span>
                </div>

                {widget.widgetType === 2 ? (
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={widgetValues[widget.id] === "1"}
                      onCheckedChange={(checked) =>
                        setWidgetValues({
                          ...widgetValues,
                          [widget.id]: checked ? "1" : "0",
                        })
                      }
                    />
                    <span className="text-xs text-gray-600">チェック</span>
                  </div>
                ) : (
                  <Input
                    value={widgetValues[widget.id] || ""}
                    onChange={(e) =>
                      setWidgetValues({
                        ...widgetValues,
                        [widget.id]: e.target.value,
                      })
                    }
                    placeholder={widget.label || "入力してください"}
                    className="h-8 text-sm"
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="p-3 bg-green-50 rounded-lg border border-green-200">
          <p className="text-sm text-green-700">
            送信元の入力項目はありません
          </p>
        </div>
      )}

      {/* 署名の注意 */}
      {hasSenderSignature && (
        <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
          <p className="text-xs text-amber-700">
            <PenTool className="h-3 w-3 inline mr-1" />
            送信元に署名欄があります。下書き保存後、クラウドサインの管理画面で署名してから送信してください。
          </p>
        </div>
      )}

      {/* 担当者・備考 */}
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-2">その他</h3>
        <div className="space-y-2">
          <div>
            <Label className="text-xs">担当者</Label>
            <Select value={assignedTo} onValueChange={setAssignedTo}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="選択" />
              </SelectTrigger>
              <SelectContent>
                {staffOptions.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">備考</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="備考"
              rows={2}
              className="text-sm"
            />
          </div>
        </div>
      </div>
    </div>
  );

  // ============================================
  // Shared: PDFプレビュー部分
  // ============================================
  const pdfContent = (
    <>
      {pdfBlobUrl ? (
        <PdfPreviewWithOverlay
          pdfUrl={pdfBlobUrl}
          widgets={allWidgets}
          widgetValues={widgetValues}
          senderParticipantId={senderParticipantId}
          onWidgetClick={handleWidgetClick}
        />
      ) : (
        <div className="flex items-center justify-center h-full text-gray-400">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          PDF読み込み中...
        </div>
      )}
    </>
  );

  // ============================================
  // Shared: フッター
  // ============================================
  const footer = (
    <div className="px-4 py-3 border-t shrink-0 flex justify-end gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => onOpenChange(false)}
        disabled={isSubmitting}
      >
        キャンセル
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => handleSubmit(false)}
        disabled={isSubmitting || !canSubmit}
      >
        {isSubmitting ? (
          <Loader2 className="h-4 w-4 animate-spin mr-1" />
        ) : (
          <Save className="h-4 w-4 mr-1" />
        )}
        下書き保存
      </Button>
      {!hasSenderSignature && (
        <Button
          size="sm"
          onClick={() => handleSubmit(true)}
          disabled={isSubmitting || !canSubmit}
        >
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 animate-spin mr-1" />
          ) : (
            <Send className="h-4 w-4 mr-1" />
          )}
          送付する
        </Button>
      )}
    </div>
  );

  // ============================================
  // Shared: 自社署名ダイアログ
  // ============================================
  const signingDialog = (
    <Dialog open={signingDialogOpen} onOpenChange={(o) => { if (!o) handleCloseSigningDialog(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PenTool className="h-5 w-5 text-blue-600" />
            契約書の署名
          </DialogTitle>
        </DialogHeader>

        <div className="py-4">
          <p className="text-sm text-gray-700 mb-4">
            契約書「<span className="font-medium">{signingDialogContractNumber}</span>」を送付しました。
          </p>

          {signingUrlLoading ? (
            <div className="flex flex-col items-center gap-3 py-6 px-4 bg-gray-50 rounded-lg border">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
              <div className="text-center">
                <p className="text-sm font-medium text-gray-700">
                  署名用リンクを取得しています...
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  クラウドサインからメールが届くまでしばらくお待ちください
                </p>
              </div>
            </div>
          ) : signingUrl ? (
            <div className="flex flex-col items-center gap-3 py-6 px-4 bg-green-50 rounded-lg border border-green-200">
              <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                <PenTool className="h-5 w-5 text-green-600" />
              </div>
              <p className="text-sm font-medium text-green-800">
                署名の準備ができました
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 py-6 px-4 bg-amber-50 rounded-lg border border-amber-200">
              <p className="text-sm text-amber-700 text-center">
                署名用リンクの取得に時間がかかっています。<br />
                後ほどメールをご確認ください。
              </p>
            </div>
          )}
        </div>

        <div className="flex gap-2 justify-end">
          <Button
            variant="outline"
            onClick={handleCloseSigningDialog}
          >
            今は署名しない
          </Button>
          {signingUrl ? (
            <Button
              onClick={() => {
                window.open(signingUrl, "_blank", "noopener,noreferrer");
                handleCloseSigningDialog();
              }}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <PenTool className="h-4 w-4 mr-2" />
              署名に進む
            </Button>
          ) : (
            <Button disabled className="bg-blue-600">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              署名に進む
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );

  // ============================================
  // Render: クラウドサイン未設定
  // ============================================
  if (!operatingCompany?.cloudsignClientId) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent size="form" className="p-0 overflow-hidden flex flex-col">
          <DialogHeader className="px-4 sm:px-6 py-4 border-b shrink-0">
            <DialogTitle>契約書を送付</DialogTitle>
          </DialogHeader>
          <div className="px-6 py-8 text-center">
            <p className="text-gray-500 mb-4">クラウドサイン連携が設定されていません。</p>
            <p className="text-sm text-gray-400">
              運営法人の設定画面でクラウドサインのクライアントIDを登録してください。
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // ============================================
  // Render: ドラフト作成後（PDFプレビュー + 入力フォーム）
  // ============================================
  if (draftDocument) {
    return (
      <>
        <Dialog open={open} onOpenChange={onOpenChange}>
          <DialogContent size="cloudsign" className="overflow-hidden flex flex-col h-[95dvh] lg:h-[88dvh]">
            <DialogHeader className="px-4 sm:px-6 py-3 border-b shrink-0">
              <DialogTitle className="text-base">
                契約書を送付 - {companyName}
              </DialogTitle>
            </DialogHeader>

            {isWide ? (
              <div className="flex-1 flex min-h-0">
                <div className="flex-1 min-w-0 border-r bg-gray-100">
                  {pdfContent}
                </div>
                <div className="w-[380px] shrink-0 flex flex-col min-h-0">
                  <div className="flex-1 overflow-y-auto px-4 py-3">
                    {formContent}
                  </div>
                  {footer}
                </div>
              </div>
            ) : (
              <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
                <TabsList className="mx-4 mt-2 shrink-0 h-9 bg-gray-100 rounded-md">
                  <TabsTrigger value="preview" className="text-xs data-[state=active]:text-sm px-3 py-1">
                    <Eye className="h-3.5 w-3.5 mr-1" />
                    プレビュー
                  </TabsTrigger>
                  <TabsTrigger value="form" className="text-xs data-[state=active]:text-sm px-3 py-1">
                    <Edit3 className="h-3.5 w-3.5 mr-1" />
                    入力項目
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="preview" className="flex-1 min-h-0 mt-0 bg-gray-100">
                  {pdfContent}
                </TabsContent>
                <TabsContent value="form" className="flex-1 min-h-0 mt-0 overflow-y-auto px-4 py-3">
                  {formContent}
                </TabsContent>
                {footer}
              </Tabs>
            )}
          </DialogContent>
        </Dialog>
        {signingDialog}
      </>
    );
  }

  // ============================================
  // Render: 下書き再開時のローディング
  // ============================================
  if (resumeDraft && !draftDocument) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent size="form" className="p-0 overflow-hidden flex flex-col">
          <DialogHeader className="px-4 sm:px-6 py-4 border-b shrink-0">
            <DialogTitle>下書きを再開 - {companyName}</DialogTitle>
          </DialogHeader>
          <div className="px-6 py-8 text-center">
            {loadingDraft ? (
              <div className="flex items-center justify-center gap-2 text-gray-500">
                <Loader2 className="h-5 w-5 animate-spin" />
                <p>下書きを読み込み中...</p>
              </div>
            ) : draftError ? (
              <div>
                <p className="text-red-500 mb-4">{draftError}</p>
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  閉じる
                </Button>
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // ============================================
  // Render: Step 1 — 基本情報入力
  // ============================================
  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="form" className="p-0 overflow-hidden flex flex-col max-h-[90vh]">
        <DialogHeader className="px-4 sm:px-6 py-4 border-b shrink-0">
          <DialogTitle>契約書を送付 - {companyName}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0 px-4 sm:px-6 py-4">
          <div className="space-y-5">
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-3">基本情報</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>契約種別 <span className="text-red-500">*</span></Label>
                  <Select
                    value={selectedContractTypeId}
                    onValueChange={setSelectedContractTypeId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="選択してください" />
                    </SelectTrigger>
                    <SelectContent>
                      {contractTypes.map((ct) => (
                        <SelectItem key={ct.id} value={String(ct.id)}>
                          {ct.name}
                          {ct.templates.length > 0 && (
                            <span className="text-xs text-gray-400 ml-1">
                              ({ct.templates.length}テンプレート)
                            </span>
                          )}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>テンプレート <span className="text-red-500">*</span></Label>
                  {availableTemplates.length === 0 && selectedContractTypeId ? (
                    <p className="text-sm text-gray-400 mt-2">
                      テンプレートが紐づいていません
                    </p>
                  ) : availableTemplates.length === 1 ? (
                    <div className="flex items-center h-10 px-3 border rounded-md bg-gray-50 text-sm">
                      {availableTemplates[0].name}
                    </div>
                  ) : (
                    <Select
                      value={selectedTemplateId}
                      onValueChange={setSelectedTemplateId}
                      disabled={!selectedContractTypeId || availableTemplates.length === 0}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="テンプレートを選択" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableTemplates.map((t) => (
                          <SelectItem key={t.id} value={String(t.id)}>
                            {t.name}
                            {t.description && (
                              <span className="text-xs text-gray-400 ml-1">
                                - {t.description}
                              </span>
                            )}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                <div className="col-span-2">
                  <Label>管理タイトル <span className="text-red-500">*</span></Label>
                  <Input
                    value={title}
                    onChange={(e) => {
                      setTitle(e.target.value);
                      if (!useCustomCloudsignTitle) setCloudsignTitle(e.target.value);
                    }}
                    placeholder={`${companyName} 業務委託契約書`}
                  />
                </div>
              </div>

              <div className="mt-3">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="customTitle"
                    checked={useCustomCloudsignTitle}
                    onCheckedChange={(checked) => {
                      setUseCustomCloudsignTitle(!!checked);
                      if (!checked) setCloudsignTitle(title);
                    }}
                  />
                  <Label htmlFor="customTitle" className="text-sm text-gray-600 cursor-pointer">
                    クラウドサインで別タイトルを使用する
                  </Label>
                </div>
                {useCustomCloudsignTitle && (
                  <div className="mt-2">
                    <Input
                      value={cloudsignTitle}
                      onChange={(e) => setCloudsignTitle(e.target.value)}
                      placeholder="クラウドサインで表示されるタイトル"
                    />
                    <p className="text-xs text-gray-400 mt-1">相手先に表示されるタイトルです</p>
                  </div>
                )}
              </div>

              {selectedTemplate && title.trim() && (
                <div className="mt-4">
                  <Button onClick={createDraft} disabled={loadingDraft} className="w-full">
                    {loadingDraft ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        テンプレートを読み込み中...
                      </>
                    ) : (
                      <>
                        <FileText className="h-4 w-4 mr-2" />
                        テンプレートを読み込む
                      </>
                    )}
                  </Button>
                  {draftError && (
                    <p className="text-sm text-red-500 mt-2">{draftError}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="px-4 sm:px-6 py-4 border-t shrink-0 flex justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            キャンセル
          </Button>
        </div>
      </DialogContent>
    </Dialog>
    {signingDialog}
    </>
  );
}
