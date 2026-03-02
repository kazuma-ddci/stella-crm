"use client";

import { useState, useRef, useEffect } from "react";
import { CrudTable, ColumnDef, CustomRenderers, CustomFormFields } from "@/components/crud-table";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff } from "lucide-react";
import {
  createInvoiceTemplate,
  updateInvoiceTemplate,
  deleteInvoiceTemplate,
} from "./actions";

const TEMPLATE_TYPE_OPTIONS = [
  { value: "sending", label: "送付用" },
  { value: "request", label: "発行依頼用" },
];

const VARIABLE_GROUPS = [
  {
    label: "法人・取引先",
    variables: [
      { variable: "{{法人名}}", description: "運営法人の名称", sample: "株式会社サンプル" },
      { variable: "{{取引先名}}", description: "取引先の会社名", sample: "テスト株式会社" },
      { variable: "{{担当者名}}", description: "取引先の担当者名", sample: "田中太郎" },
    ],
  },
  {
    label: "請求情報",
    variables: [
      { variable: "{{年月}}", description: "請求対象の年月", sample: "2026年3月" },
      { variable: "{{合計金額}}", description: "請求金額の合計（税込）", sample: "¥1,000,000" },
      { variable: "{{支払期限}}", description: "支払期限日", sample: "2026年4月30日" },
      { variable: "{{参照コード}}", description: "請求書ファイル名末尾に含めてもらうマッチング用コード", sample: "PG-0042" },
    ],
  },
  {
    label: "その他",
    variables: [
      { variable: "{{受信メールアドレス}}", description: "受け取り側のメールアドレス", sample: "tanaka@example.com" },
    ],
  },
];

const ALL_TEMPLATE_VARIABLES = VARIABLE_GROUPS.flatMap((g) => g.variables);

function replaceTemplateVariables(template: string): string {
  let result = template;
  for (const v of ALL_TEMPLATE_VARIABLES) {
    result = result.replaceAll(v.variable, v.sample);
  }
  return result;
}

// --- contentEditable 用ヘルパー ---

const CHIP_CLASS =
  "inline-flex items-center rounded bg-blue-100 text-blue-800 px-1.5 py-0.5 text-xs font-medium align-baseline cursor-default whitespace-nowrap";

/** 保存テキスト（{{変数}}形式）→ エディタ用HTML */
function textToHtml(text: string): string {
  if (!text) return "";
  const parts = text.split(/(\{\{.+?\}\})/g);
  // 直前が「行頭境界」（文書先頭 or 改行直後）で次がchipの場合、ZWSを付与してカーソル着地点を確保
  let atLineStart = true;
  return parts
    .map((part) => {
      if (/^\{\{.+?\}\}$/.test(part)) {
        const label = part.slice(2, -2);
        const prefix = atLineStart ? "\u200B" : "";
        atLineStart = false;
        return `${prefix}<span contenteditable="false" data-variable="${part}" class="${CHIP_CLASS}">${label}</span>\u200B`;
      }
      // 通常テキスト: 改行で終わっていれば次は行頭
      if (part) {
        atLineStart = part.endsWith("\n");
      }
      return escapeHtml(part);
    })
    .join("");
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");
}

/** エディタDOM → 保存テキスト（{{変数}}形式） */
function domToText(element: HTMLElement): string {
  let result = "";
  for (const node of Array.from(element.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      // ZWS（カーソル着地点用）を除去して保存テキストを汚さない
      result += (node.textContent || "").replace(/\u200B/g, "");
    } else if (node instanceof HTMLElement) {
      if (node.dataset.variable) {
        result += node.dataset.variable;
      } else if (node.tagName === "BR") {
        result += "\n";
      } else if (node.tagName === "DIV" || node.tagName === "P") {
        // ブラウザがEnterで<div>を作る場合の対応
        if (result && !result.endsWith("\n")) result += "\n";
        const inner = domToText(node);
        // <div><br></div> は改行1つ。DIV自体の改行で既にカウント済みなのでBRのみの内容はスキップ
        if (inner === "\n") {
          // DIV/Pの改行で既にカウント済み → 内容の改行は不要
        } else {
          result += inner;
        }
      } else {
        result += domToText(node);
      }
    }
  }
  return result;
}

// --- コンポーネント ---

type CompanyOption = {
  value: string;
  label: string;
};

type Props = {
  data: Record<string, unknown>[];
  companyOptions: CompanyOption[];
};

function TemplateField({
  value,
  onChange,
  label,
  rows,
}: {
  value: unknown;
  onChange: (val: unknown) => void;
  label: string;
  rows: number;
}) {
  const [showPreview, setShowPreview] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const lastValueRef = useRef<string>("");
  const isFocusedRef = useRef(false);
  const justComposedRef = useRef(false);
  const text = String(value ?? "");

  // 外部からの値変更 → DOM更新（フォーカス中はスキップ — ユーザー入力を壊さない）
  useEffect(() => {
    if (editorRef.current && !isFocusedRef.current) {
      editorRef.current.innerHTML = textToHtml(text);
      lastValueRef.current = text;
    }
  }, [text, showPreview]);

  function syncToState() {
    if (!editorRef.current) return;
    const newText = domToText(editorRef.current);
    lastValueRef.current = newText;
    onChange(newText);
  }

  // --- chip をアトミックに扱うカーソル操作ヘルパー ---

  /** ノードがチップ(contenteditable=false の span[data-variable])かどうか */
  function isChip(node: Node | null): node is HTMLElement {
    return !!node && node.nodeType === Node.ELEMENT_NODE && !!(node as HTMLElement).dataset?.variable;
  }

  /** テキストノードがZWSのみかどうか */
  function isZwsOnly(node: Node | null): boolean {
    return !!node && node.nodeType === Node.TEXT_NODE && /^\u200B+$/.test(node.textContent || "");
  }

  /** カーソルをテキストノードの指定オフセットに置く */
  function setCaret(node: Node, offset: number) {
    const sel = window.getSelection();
    if (!sel) return;
    const range = document.createRange();
    range.setStart(node, offset);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
  }

  /** chip直前にカーソルを置く（DOM変更なし、element-levelフォールバック） */
  function setCaretBefore(node: Node) {
    const sel = window.getSelection();
    if (!sel) return;
    const r = document.createRange();
    r.setStartBefore(node);
    r.collapse(true);
    sel.removeAllRanges();
    sel.addRange(r);
  }

  /** chip直後にカーソルを置く（DOM変更なし、element-levelフォールバック） */
  function setCaretAfter(node: Node) {
    const sel = window.getSelection();
    if (!sel) return;
    const r = document.createRange();
    r.setStartAfter(node);
    r.collapse(true);
    sel.removeAllRanges();
    sel.addRange(r);
  }

  /** テキストノードの先頭ZWSをスキップした着地位置を返す */
  function landingOffset(textNode: Node): number {
    const txt = textNode.textContent || "";
    let pos = 0;
    while (pos < txt.length && txt[pos] === "\u200B") pos++;
    return pos; // ZWSのみなら末尾(=length)
  }

  /**
   * カーソルを論理的に1ステップ移動する。chipは1回で飛び越える。
   * DOM変更は一切行わない。テキストノードがない場合のみ setCaretBefore/After で element-level 着地。
   * @returns true=実際に移動した（callerはpreventDefaultすべき）, false=処理不能 or 位置不変（browserに委譲）
   */
  function moveCaret(direction: "forward" | "backward"): boolean {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return false;
    const editor = editorRef.current;
    if (!editor) return false;

    const origNode = sel.focusNode;
    const origOffset = sel.focusOffset;
    if (!origNode) return false;

    /** setCaret 後に実際にカーソルが動いたか判定 */
    const didMove = (): boolean =>
      sel.focusNode !== origNode || sel.focusOffset !== origOffset;

    /** chip越え後、chip直後に着地（テキストノード優先、なければ element-level） */
    const afterChip = (chip: Node): boolean => {
      const next = chip.nextSibling;
      if (next && next.nodeType === Node.TEXT_NODE) {
        setCaret(next, landingOffset(next));
      } else {
        setCaretAfter(chip);
      }
      return didMove();
    };
    /** chip越え前、chip直前に着地（常に末尾=chip隣接側） */
    const beforeChip = (chip: Node): boolean => {
      const prev = chip.previousSibling;
      if (prev && prev.nodeType === Node.TEXT_NODE) {
        setCaret(prev, (prev.textContent || "").length);
      } else {
        setCaretBefore(chip);
      }
      return didMove();
    };

    // --- ケース1: focusNode が Element（editor直下、DIV等） ---
    if (origNode.nodeType === Node.ELEMENT_NODE) {
      const el = origNode as HTMLElement;
      if (direction === "forward") {
        for (let i = origOffset; i < el.childNodes.length; i++) {
          const child = el.childNodes[i];
          if (isChip(child)) return afterChip(child);
          if (child.nodeType === Node.TEXT_NODE) {
            if (isZwsOnly(child)) continue;
            setCaret(child, landingOffset(child));
            return didMove();
          }
          return false; // BR等 → ブラウザに委譲
        }
      } else {
        for (let i = origOffset - 1; i >= 0; i--) {
          const child = el.childNodes[i];
          if (isChip(child)) return beforeChip(child);
          if (child.nodeType === Node.TEXT_NODE) {
            if (isZwsOnly(child)) continue;
            setCaret(child, (child.textContent || "").length);
            return didMove();
          }
          return false;
        }
      }
      return false;
    }

    // --- ケース2: focusNode がテキストノード ---
    if (origNode.nodeType === Node.TEXT_NODE) {
      const txt = origNode.textContent || "";

      // ZWS-only ノードは透過: ノード内 offset 移動せず直接兄弟探索
      if (isZwsOnly(origNode)) {
        if (direction === "forward") {
          const sib = origNode.nextSibling;
          if (isChip(sib)) return afterChip(sib);
          if (sib && isZwsOnly(sib) && isChip(sib.nextSibling)) return afterChip(sib.nextSibling!);
        } else {
          const sib = origNode.previousSibling;
          if (isChip(sib)) return beforeChip(sib);
          if (sib && isZwsOnly(sib) && isChip(sib.previousSibling)) return beforeChip(sib.previousSibling!);
        }
        return false;
      }

      if (direction === "forward") {
        // 同一テキストノード内のZWSスキップ（実文字がある混合ノード用）
        if (origOffset < txt.length && txt[origOffset] === "\u200B") {
          let p = origOffset;
          while (p < txt.length && txt[p] === "\u200B") p++;
          if (p < txt.length) { setCaret(origNode, p); return didMove(); }
          // 残りが全てZWS → 次兄弟へ（fall through）
        }
        // テキスト末尾 or 残りZWSのみ → 次兄弟を探す
        if (origOffset >= txt.length || /^\u200B*$/.test(txt.slice(origOffset))) {
          const sib = origNode.nextSibling;
          if (isChip(sib)) return afterChip(sib);
          if (sib && isZwsOnly(sib) && isChip(sib.nextSibling)) return afterChip(sib.nextSibling!);
        }
        return false;
      } else {
        if (origOffset > 0 && txt[origOffset - 1] === "\u200B") {
          let p = origOffset;
          while (p > 0 && txt[p - 1] === "\u200B") p--;
          if (p > 0) { setCaret(origNode, p); return didMove(); }
        }
        if (origOffset <= 0 || /^\u200B*$/.test(txt.slice(0, origOffset))) {
          const sib = origNode.previousSibling;
          if (isChip(sib)) return beforeChip(sib);
          if (sib && isZwsOnly(sib) && isChip(sib.previousSibling)) return beforeChip(sib.previousSibling!);
        }
        return false;
      }
    }

    return false;
  }

  /** Backspace/Delete でチップを原子的に削除する。ZWSだけ先に消えるのを防ぐ */
  function handleDelete(direction: "forward" | "backward"): boolean {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return false;
    const editor = editorRef.current;
    if (!editor) return false;

    // 選択範囲がある場合はブラウザデフォルトに任せる（ただし選択内chipも消える）
    if (!sel.isCollapsed) return false;

    const node = sel.focusNode;
    const offset = sel.focusOffset;
    if (!node) return false;

    // カーソルがeditor直下の場合
    if (node === editor) {
      const target = direction === "forward"
        ? editor.childNodes[offset]
        : editor.childNodes[offset - 1];
      if (isChip(target)) {
        removeChipAndNormalize(target);
        return true;
      }
      // ZWSのみテキストノードの場合、その先のchipを探す
      if (target && isZwsOnly(target)) {
        const beyond = direction === "forward" ? target.nextSibling : target.previousSibling;
        if (isChip(beyond)) {
          removeChipAndNormalize(beyond);
          return true;
        }
      }
      return false;
    }

    // カーソルがテキストノード内の場合
    if (node.nodeType === Node.TEXT_NODE) {
      const txt = node.textContent || "";
      if (direction === "forward") {
        // テキスト末尾 or 残りがZWSのみ → 次の兄弟chipを削除
        const remaining = txt.slice(offset);
        if (offset >= txt.length || /^\u200B*$/.test(remaining)) {
          let next: Node | null = node.nextSibling;
          // ZWSのみテキストノードをスキップ
          while (next && isZwsOnly(next)) next = next.nextSibling;
          if (isChip(next)) {
            removeChipAndNormalize(next);
            return true;
          }
        }
        // ZWS文字の上にいる場合、ZWSをスキップして次の実体を確認
        if (offset < txt.length && txt[offset] === "\u200B") {
          // ZWSだけ消すのを防ぐ：次にchipがあれば chip ごと消す
          const afterZws = txt.slice(offset).replace(/\u200B/g, "");
          if (afterZws === "" && node.nextSibling) {
            let next: Node | null = node.nextSibling;
            while (next && isZwsOnly(next)) next = next.nextSibling;
            if (isChip(next)) {
              removeChipAndNormalize(next);
              return true;
            }
          }
          // chipがなければZWSを消す（通常テキスト削除と同じ）
          return false;
        }
      } else {
        // backward: テキスト先頭 or 手前がZWSのみ → 前の兄弟chipを削除
        const before = txt.slice(0, offset);
        if (offset <= 0 || /^\u200B*$/.test(before)) {
          let prev: Node | null = node.previousSibling;
          while (prev && isZwsOnly(prev)) prev = prev.previousSibling;
          if (isChip(prev)) {
            removeChipAndNormalize(prev);
            return true;
          }
        }
        // ZWSの上にいる場合
        if (offset > 0 && txt[offset - 1] === "\u200B") {
          const beforeZws = txt.slice(0, offset).replace(/\u200B/g, "");
          if (beforeZws === "" && node.previousSibling) {
            let prev: Node | null = node.previousSibling;
            while (prev && isZwsOnly(prev)) prev = prev.previousSibling;
            if (isChip(prev)) {
              removeChipAndNormalize(prev);
              return true;
            }
          }
          return false;
        }
      }
    }

    return false;
  }

  /** chipを削除し、前後のZWSテキストノードを正規化する */
  function removeChipAndNormalize(chip: Node) {
    const editor = editorRef.current;
    if (!editor) return;

    const prev = chip.previousSibling;
    const next = chip.nextSibling;

    // chip削除
    chip.parentNode?.removeChild(chip);

    // 前後のZWSのみテキストノードを統合
    // 前がZWSのみ && 次がZWSのみ → 片方を残す
    if (isZwsOnly(prev) && isZwsOnly(next)) {
      prev.parentNode?.removeChild(prev);
      setCaret(next, 0);
    } else if (isZwsOnly(prev) && next && next.nodeType === Node.TEXT_NODE) {
      prev.parentNode?.removeChild(prev);
      setCaret(next, 0);
    } else if (isZwsOnly(next) && prev && prev.nodeType === Node.TEXT_NODE) {
      next.parentNode?.removeChild(next);
      setCaret(prev, (prev.textContent || "").length);
    } else if (next && next.nodeType === Node.TEXT_NODE) {
      setCaret(next, 0);
    } else if (prev && prev.nodeType === Node.TEXT_NODE) {
      setCaret(prev, (prev.textContent || "").length);
    } else {
      // 前後にテキストノードがない場合、ZWSを挿入してカーソル着地点を確保
      const zws = document.createTextNode("\u200B");
      if (next) {
        editor.insertBefore(zws, next);
      } else {
        editor.appendChild(zws);
      }
      setCaret(zws, 0);
    }

    syncToState();
  }

  function insertVariable(variable: string) {
    const editor = editorRef.current;
    if (!editor) return;

    const span = document.createElement("span");
    span.contentEditable = "false";
    span.dataset.variable = variable;
    span.className = CHIP_CLASS;
    span.textContent = variable.slice(2, -2);

    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      if (editor.contains(range.commonAncestorContainer)) {
        range.deleteContents();
        range.insertNode(span);
        // チップ前にテキストノードがなければ ZWS を追加（カーソル着地用）
        if (!span.previousSibling || span.previousSibling.nodeType !== Node.TEXT_NODE) {
          span.before(document.createTextNode("\u200B"));
        }
        // チップ直後に ZWS テキストノードを作成してカーソル着地点を確保
        const zwsNode = document.createTextNode("\u200B");
        span.after(zwsNode);
        const newRange = document.createRange();
        newRange.setStart(zwsNode, 1);
        newRange.collapse(true);
        selection.removeAllRanges();
        selection.addRange(newRange);
      } else {
        // チップ前にテキストノードがなければ ZWS を追加
        if (!editor.lastChild || editor.lastChild.nodeType !== Node.TEXT_NODE) {
          editor.appendChild(document.createTextNode("\u200B"));
        }
        editor.appendChild(span);
        const zwsNode = document.createTextNode("\u200B");
        editor.appendChild(zwsNode);
        editor.focus();
      }
    } else {
      // チップ前にテキストノードがなければ ZWS を追加
      if (!editor.lastChild || editor.lastChild.nodeType !== Node.TEXT_NODE) {
        editor.appendChild(document.createTextNode("\u200B"));
      }
      editor.appendChild(span);
      const zwsNode = document.createTextNode("\u200B");
      editor.appendChild(zwsNode);
      editor.focus();
    }

    syncToState();
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{label}</span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setShowPreview(!showPreview)}
          className="h-7 gap-1 text-xs"
        >
          {showPreview ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
          {showPreview ? "編集" : "プレビュー"}
        </Button>
      </div>
      {showPreview ? (
        <div className="rounded-md border bg-muted/50 p-3 text-sm whitespace-pre-wrap min-h-[60px]">
          {replaceTemplateVariables(text) || <span className="text-muted-foreground">（空）</span>}
        </div>
      ) : (
        <>
          <div className="relative">
            <div
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              onFocus={() => { isFocusedRef.current = true; }}
              onBlur={() => {
                isFocusedRef.current = false;
                if (!editorRef.current) return;
                // DOM正規化: 手入力の{{変数}}をチップに変換
                const currentText = domToText(editorRef.current);
                editorRef.current.innerHTML = textToHtml(currentText);
                lastValueRef.current = currentText;
                onChange(currentText);
              }}
              onInput={(e) => {
                // IME変換中はシリアライズしない（変換が壊れるため）
                if ((e.nativeEvent as InputEvent).isComposing) return;
                syncToState();
              }}
              onCompositionEnd={() => {
                // IME変換確定後に同期
                syncToState();
                // Safari: 確定Enterが isComposing:false で届くため追跡
                justComposedRef.current = true;
                setTimeout(() => { justComposedRef.current = false; }, 0);
              }}
              onPaste={(e) => {
                e.preventDefault();
                const pastedText = e.clipboardData.getData("text/plain");
                document.execCommand("insertText", false, pastedText);
              }}
              onKeyDown={(e) => {
                // IME変換中は全てブラウザに任せる
                if (e.nativeEvent.isComposing) return;

                // Enter キー: Range API で単一 <br> を挿入
                if (e.key === "Enter") {
                  if (justComposedRef.current) {
                    justComposedRef.current = false;
                    e.preventDefault();
                    return;
                  }
                  e.preventDefault();
                  const sel = window.getSelection();
                  if (!sel || sel.rangeCount === 0) return;
                  const range = sel.getRangeAt(0);
                  if (!range.collapsed) range.deleteContents();
                  const br = document.createElement("br");
                  range.insertNode(br);
                  // <br> 直後にカーソル着地可能なテキストノードを確保
                  let after = br.nextSibling;
                  if (!after || after.nodeType !== Node.TEXT_NODE) {
                    const zws = document.createTextNode("\u200B");
                    br.after(zws);
                    after = zws;
                  } else if (!after.textContent) {
                    after.textContent = "\u200B";
                  }
                  const newRange = document.createRange();
                  newRange.setStart(after, 0);
                  newRange.collapse(true);
                  sel.removeAllRanges();
                  sel.addRange(newRange);
                  syncToState();
                  return;
                }

                // 矢印キー: moveCaret が処理した場合のみ preventDefault
                if ((e.key === "ArrowLeft" || e.key === "ArrowRight") && !e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey) {
                  const direction = e.key === "ArrowLeft" ? "backward" : "forward";
                  if (moveCaret(direction)) {
                    e.preventDefault();
                  }
                  return;
                }

                // Backspace / Delete: chipを原子的に削除
                if (e.key === "Backspace" || e.key === "Delete") {
                  const direction = e.key === "Backspace" ? "backward" : "forward";
                  if (handleDelete(direction)) {
                    e.preventDefault();
                  }
                  return;
                }
              }}
              className="border-input focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] md:text-sm whitespace-pre-wrap break-words"
              style={{ minHeight: `${rows * 1.5 + 1}rem` }}
              role="textbox"
              aria-label={label}
            />
            {!text && (
              <div className="absolute top-2 left-3 text-muted-foreground pointer-events-none md:text-sm">
                {label}を入力
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            {VARIABLE_GROUPS.map((group) => (
              <div key={group.label} className="flex flex-wrap items-center gap-1">
                <span className="text-xs text-muted-foreground mr-1">{group.label}:</span>
                {group.variables.map((v) => (
                  <button
                    key={v.variable}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => insertVariable(v.variable)}
                    title={v.description}
                    className="inline-flex items-center rounded-md border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs text-gray-700 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-colors cursor-pointer"
                  >
                    {v.variable.slice(2, -2)}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function EmailTemplatesTable({ data, companyOptions }: Props) {
  const columns: ColumnDef[] = [
    { key: "id", header: "ID", editable: false, hidden: true },
    {
      key: "operatingCompanyId",
      header: "運営法人",
      type: "select",
      options: companyOptions,
      required: true,
      filterable: true,
    },
    {
      key: "name",
      header: "テンプレート名",
      type: "text",
      required: true,
      filterable: true,
    },
    {
      key: "templateType",
      header: "種別",
      type: "select",
      options: TEMPLATE_TYPE_OPTIONS,
      required: true,
      filterable: true,
    },
    {
      key: "emailSubjectTemplate",
      header: "メール件名",
      type: "textarea",
      required: true,
    },
    {
      key: "emailBodyTemplate",
      header: "メール本文",
      type: "textarea",
      required: true,
    },
    {
      key: "isDefault",
      header: "デフォルト",
      type: "boolean",
      defaultValue: false,
    },
  ];

  const customRenderers: CustomRenderers = {
    operatingCompanyId: (value, item) => {
      if (!value) return "（なし）";
      const option = companyOptions.find((o) => o.value === String(value));
      if (option) return option.label;
      const label = item?.operatingCompanyLabel as string | undefined;
      return label ? `${label}（無効）` : "（なし）";
    },
    templateType: (value) => {
      const option = TEMPLATE_TYPE_OPTIONS.find((o) => o.value === value);
      return option ? option.label : String(value);
    },
  };

  const customFormFields: CustomFormFields = {
    emailSubjectTemplate: {
      render: (value, onChange) => (
        <TemplateField
          value={value}
          onChange={onChange}
          label="メール件名テンプレート"
          rows={2}
        />
      ),
    },
    emailBodyTemplate: {
      render: (value, onChange) => (
        <TemplateField
          value={value}
          onChange={onChange}
          label="メール本文テンプレート"
          rows={8}
        />
      ),
    },
  };

  return (
    <CrudTable
      data={data}
      columns={columns}
      title="テンプレート"
      onAdd={createInvoiceTemplate}
      onUpdate={updateInvoiceTemplate}
      onDelete={deleteInvoiceTemplate}
      emptyMessage="メールテンプレートが登録されていません"
      customRenderers={customRenderers}
      customFormFields={customFormFields}
    />
  );
}
