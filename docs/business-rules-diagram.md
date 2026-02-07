# ビジネスルール関係図（Mermaid）

このドキュメントはstella-crmのテーブル間・機能間の影響関係をMermaid図で整理したものです。

**最終更新日**: 2026-02-07

**凡例**:
- 実線矢印（`-->`, `==>`)：FK / onDelete: Cascade
- 破線矢印（`-.->`)：コード上のビジネスロジック（自動更新・計算連動等）
- 太線矢印（`==>`)：特にリスクの高いカスケード連鎖

---

## 目次

1. [全体俯瞰図](#1-全体俯瞰図)
2. [Stella企業 カスケード削除チェーン](#2-stella企業-カスケード削除チェーン)
3. [STP企業 カスケード削除チェーン](#3-stp企業-カスケード削除チェーン)
4. [代理店 カスケード削除チェーン](#4-代理店-カスケード削除チェーン)
5. [ステージ管理フロー](#5-ステージ管理フロー)
6. [財務自動生成フロー](#6-財務自動生成フロー)
7. [請求書・消込フロー](#7-請求書消込フロー)
8. [月次締めフロー](#8-月次締めフロー)
9. [外部ユーザー登録フロー](#9-外部ユーザー登録フロー)
10. [リード獲得フォームフロー](#10-リード獲得フォームフロー)
11. [会計システムフロー](#11-会計システムフロー)
12. [認証・権限フロー](#12-認証権限フロー)

---

## 1. 全体俯瞰図

```mermaid
graph TB
    subgraph "Stella 全顧客マスタ"
        MSC[MasterStellaCompany]
        SCL[StellaCompanyLocation]
        SCC[StellaCompanyContact]
        SCBA[StellaCompanyBankAccount]
    end

    subgraph "STP プロジェクト"
        SC[StpCompany]
        SS[StpStage]
        SSH[StpStageHistory]
        SCH[StpContractHistory]
        SCCON[StpCompanyContract]
        CAND[StpCandidate]
        PROP[StpProposal]
        KPI[StpKpiSheet]
    end

    subgraph "代理店"
        SA[StpAgent]
        SAC[StpAgentContract]
        SACH[StpAgentContractHistory]
        SACO[StpAgentCommissionOverride]
        LFT[StpLeadFormToken]
        LFS[StpLeadFormSubmission]
    end

    subgraph "財務"
        SRR[StpRevenueRecord]
        SER[StpExpenseRecord]
        INV[StpInvoice]
        INVLI[StpInvoiceLineItem]
        PT[StpPaymentTransaction]
        PA[StpPaymentAllocation]
        MC[StpMonthlyClose]
        FEL[StpFinanceEditLog]
    end

    subgraph "会計（横断）"
        AIB[AccountingImportBatch]
        AT[AccountingTransaction]
        AR[AccountingReconciliation]
        AV[AccountingVerification]
        AMC[AccountingMonthlyClose]
    end

    subgraph "認証・外部ユーザー"
        MS[MasterStaff]
        EU[ExternalUser]
        DV[DisplayView]
        RT[RegistrationToken]
    end

    subgraph "マスタ"
        MP[MasterProject]
        OC[OperatingCompany]
        MCS[MasterContractStatus]
        MCON[MasterContract]
    end

    MSC --> SCL
    MSC --> SCC
    MSC --> SCBA
    MSC --> SC
    MSC --> SCH
    MSC --> SA
    MSC --> MCON
    MSC --> EU
    MSC --> RT

    SC --> SSH
    SC --> SCCON
    SC --> CAND
    SC --> PROP
    SC --> KPI
    SC --> SRR
    SC --> SER
    SC --> SACO
    SC --> INV

    SA --> SAC
    SA --> SACH
    SA --> LFT
    SA --> SER
    SA --> INV

    SACH --> SACO
    SACH --> SER

    SCH --> SRR
    SCH --> SER

    SRR --> PA
    SER --> PA
    PT --> PA

    INV --> INVLI
    INV --> SRR
    INV --> SER

    AT --> AR
    AT --> AV
    AIB --> AT

    LFT --> LFS
    LFS --> PROP

    MP --> MCON
    MP --> AMC
    OC --> MP
```

---

## 2. Stella企業 カスケード削除チェーン

```mermaid
graph TD
    MSC["MasterStellaCompany<br/>(Stella企業)"]

    MSC ==>|"onDelete: Cascade"| SCL["StellaCompanyLocation<br/>(拠点)"]
    MSC ==>|"onDelete: Cascade"| SCC["StellaCompanyContact<br/>(担当者)"]
    MSC ==>|"onDelete: Cascade"| SCBA["StellaCompanyBankAccount<br/>(銀行口座)"]
    MSC ==>|"onDelete: Cascade"| CH["ContactHistory<br/>(接触履歴)"]
    MSC ==>|"onDelete: Cascade"| SC["StpCompany<br/>(STP企業)"]
    MSC ==>|"onDelete: Cascade"| SCH["StpContractHistory<br/>(契約履歴)"]

    CH ==>|"onDelete: Cascade"| CHF["ContactHistoryFile<br/>(添付ファイル)"]
    CH ==>|"onDelete: Cascade"| CHR["ContactHistoryRole<br/>(ロール)"]

    SC ==>|"onDelete: Cascade"| SSH["StpStageHistory<br/>(ステージ履歴)"]
    SC ==>|"onDelete: Cascade"| SCCON["StpCompanyContract<br/>(企業契約書)"]
    SC ==>|"onDelete: Cascade"| PROP["StpProposal<br/>(提案書)"]
    SC ==>|"onDelete: Cascade"| KPI["StpKpiSheet<br/>(KPIシート)"]
    SC ==>|"onDelete: Cascade"| SRR["StpRevenueRecord<br/>(売上)"]
    SC ==>|"onDelete: Cascade"| SER["StpExpenseRecord<br/>(経費)"]
    SC ==>|"onDelete: Cascade"| SACO["StpAgentCommissionOverride<br/>(報酬例外)"]
    SC ==>|"onDelete: Cascade"| INV["StpInvoice<br/>(請求書)"]

    KPI ==>|"onDelete: Cascade"| KPIW["StpKpiWeeklyData<br/>(週次データ)"]
    KPI ==>|"onDelete: Cascade"| KPIS["StpKpiShareLink<br/>(共有リンク)"]

    INV ==>|"onDelete: Cascade"| INVLI["StpInvoiceLineItem<br/>(明細行)"]

    style MSC fill:#ff6b6b,color:#fff
    style SC fill:#ff9999,color:#000
    style INV fill:#ffcccc,color:#000
```

**危険度**: Stella企業を1件削除すると、STP企業→売上/経費/請求書/KPI→明細行/週次データまで全て連鎖削除される。

---

## 3. STP企業 カスケード削除チェーン

```mermaid
graph TD
    SC["StpCompany<br/>(STP企業)"]

    SC ==>|"Cascade"| SSH["StpStageHistory"]
    SC ==>|"Cascade"| SCCON["StpCompanyContract"]
    SC ==>|"Cascade"| PROP["StpProposal"]
    SC ==>|"Cascade"| KPI["StpKpiSheet"]
    SC ==>|"Cascade"| SRR["StpRevenueRecord"]
    SC ==>|"Cascade"| SER["StpExpenseRecord"]
    SC ==>|"Cascade"| SACO["StpAgentCommissionOverride"]
    SC ==>|"Cascade"| INV["StpInvoice"]

    KPI ==>|"Cascade"| KPIW["StpKpiWeeklyData"]
    KPI ==>|"Cascade"| KPIS["StpKpiShareLink"]

    INV ==>|"Cascade"| INVLI["StpInvoiceLineItem"]

    SRR -.->|"FK参照（Cascadeなし）"| PA1["StpPaymentAllocation"]
    SER -.->|"FK参照（Cascadeなし）"| PA2["StpPaymentAllocation"]
    SRR -.->|"FK参照（Cascadeなし）"| AR1["AccountingReconciliation"]
    SER -.->|"FK参照（Cascadeなし）"| AR2["AccountingReconciliation"]
    SRR -.->|"FK参照（Cascadeなし）"| FEL1["StpFinanceEditLog"]
    SER -.->|"FK参照（Cascadeなし）"| FEL2["StpFinanceEditLog"]

    style SC fill:#ff6b6b,color:#fff
    style PA1 fill:#ffffcc,color:#000
    style PA2 fill:#ffffcc,color:#000
    style AR1 fill:#ffffcc,color:#000
    style AR2 fill:#ffffcc,color:#000
    style FEL1 fill:#ffffcc,color:#000
    style FEL2 fill:#ffffcc,color:#000
```

**注意**: 黄色ノードはCascade削除対象外。STP企業削除時にPaymentAllocation/AccountingReconciliation/FinanceEditLogは自動削除されず、FK制約エラーの可能性あり。

---

## 4. 代理店 カスケード削除チェーン

```mermaid
graph TD
    SA["StpAgent<br/>(代理店)"]

    SA ==>|"Cascade"| SAC["StpAgentContract<br/>(契約書)"]
    SA ==>|"Cascade"| SAS["StpAgentStaff<br/>(担当者割当)"]
    SA ==>|"Cascade"| SACH["StpAgentContractHistory<br/>(契約履歴)"]
    SA ==>|"Cascade"| LFT["StpLeadFormToken<br/>(フォームトークン)"]
    SA ==>|"Cascade"| SER["StpExpenseRecord<br/>(経費)"]
    SA ==>|"Cascade"| INV["StpInvoice<br/>(請求書)"]

    SACH ==>|"Cascade"| SACO["StpAgentCommissionOverride<br/>(報酬例外)"]

    LFT ==>|"Cascade"| LFS["StpLeadFormSubmission<br/>(フォーム回答)"]

    INV ==>|"Cascade"| INVLI["StpInvoiceLineItem<br/>(明細行)"]

    SACH -.->|"FK参照（Cascadeなし）"| SER2["StpExpenseRecord<br/>(契約経由の経費)"]

    style SA fill:#ff6b6b,color:#fff
    style SER fill:#ff9999,color:#000
    style INV fill:#ff9999,color:#000
```

---

## 5. ステージ管理フロー

```mermaid
graph LR
    subgraph "ユーザー操作"
        UI["ステージ管理モーダル"]
    end

    subgraph "イベント検出"
        ED["detectEvents()<br/>event-detector.ts"]
    end

    subgraph "アラートバリデーション"
        AV["validateAlerts()<br/>alert-validator.ts"]
    end

    subgraph "データ更新（トランザクション）"
        UH["updateStageWithHistory()"]
    end

    UI -->|"ステージ変更"| ED
    ED -->|"12種類のイベント判定"| AV
    AV -->|"ERROR: ブロック"| UI
    AV -->|"WARNING: 確認"| UI
    AV -->|"OK"| UH

    UH -.->|"StpStageHistory作成"| SSH["StpStageHistory"]
    UH -.->|"StpCompany更新"| SC["StpCompany"]

    SC -.->|"currentStageId更新"| SC
    SC -.->|"nextTargetStageId更新"| SC
    SC -.->|"nextTargetDate更新"| SC
    SC -.->|"pendingReason更新"| SC
    SC -.->|"lostReason更新"| SC

    SSH -.->|"統計計算"| STAT["achievedCount<br/>cancelCount<br/>backCount<br/>achievementRate"]
```

### イベントタイプ判定フロー

```mermaid
graph TD
    START["ステージ変更検出"]

    START --> CHK1{"stageType変化?"}

    CHK1 -->|"→ closed_won"| WON["won"]
    CHK1 -->|"→ closed_lost"| LOST["lost"]
    CHK1 -->|"→ pending"| SUSP["suspended"]
    CHK1 -->|"pending →"| RESUM["resumed"]

    CHK1 -->|"同カテゴリ"| CHK2{"displayOrder変化?"}

    CHK2 -->|"増加"| PROG["progress"]
    CHK2 -->|"減少"| BACK["back"]

    START --> CHK3{"目標到達?"}
    CHK3 -->|"newStage = target"| ACH["achieved"]
    ACH --> CHK4{"新目標設定?"}
    CHK4 -->|"あり"| COMMIT["achieved + commit"]

    START --> CHK5{"目標変更?"}
    CHK5 -->|"初回目標設定"| COM2["commit"]
    CHK5 -->|"目標更新"| RCOM["recommit"]
    RCOM --> SUBTYPE{"subType判定"}
    SUBTYPE -->|"ステージ上↑ + 日付前倒し"| POS["positive"]
    SUBTYPE -->|"ステージ下↓ + 日付延期"| NEG["negative"]
    SUBTYPE -->|"それ以外"| NEU["neutral"]

    START --> CHK6{"lost→復活?"}
    CHK6 -->|"yes"| REV["revived"]
```

---

## 6. 財務自動生成フロー

```mermaid
graph TD
    subgraph "トリガー"
        T1["企業契約作成<br/>StpContractHistory"]
        T2["求職者入社日設定<br/>StpCandidate.joinDate"]
        T3["契約金額変更"]
        T4["代理店契約変更"]
    end

    subgraph "売上自動生成"
        R1["initial 売上<br/>（initialFee > 0）"]
        R2["monthly 売上<br/>（monthlyFee > 0、最大3ヶ月先）"]
        R3["performance 売上<br/>（performanceFee > 0）"]
    end

    subgraph "経費自動生成"
        E1["agent_initial 経費<br/>（代理店直接費用）"]
        E2["agent_monthly 経費<br/>（代理店月額費用）"]
        E3["commission_initial 経費<br/>（初期費用紹介報酬）"]
        E4["commission_monthly 経費<br/>（月額紹介報酬）"]
        E5["commission_performance 経費<br/>（成果報酬紹介報酬）"]
    end

    subgraph "報酬率決定"
        CC["buildCommissionConfig()"]
        OVR["StpAgentCommissionOverride<br/>（企業別例外・優先）"]
        DEF["StpAgentContractHistory<br/>（デフォルト値）"]
    end

    subgraph "税計算"
        TAX["calcTaxAmount()<br/>内税: floor(amt * rate/(100+rate))<br/>外税: floor(amt * rate/100)"]
        WT["源泉徴収<br/>≤100万: 10.21%<br/>>100万: 102,100+超過×20.42%"]
    end

    T1 -.-> R1
    T1 -.-> R2
    T1 -.-> E1
    T1 -.-> E2
    T1 -.-> E3
    T1 -.-> E4

    T2 -.-> R3
    T2 -.-> E5

    T3 -.->|"markFinanceRecordsForContractChange()"| MARK["sourceDataChangedAt<br/>latestCalculatedAmount<br/>をマーク"]
    T4 -.->|"markExpenseRecordsForAgentChange()"| MARK

    OVR -->|"優先"| CC
    DEF -->|"フォールバック"| CC
    CC --> E3
    CC --> E4
    CC --> E5

    R1 --> TAX
    R2 --> TAX
    R3 --> TAX
    E1 --> TAX
    E2 --> TAX
    E3 --> TAX
    E4 --> TAX
    E5 --> TAX
    E3 --> WT
    E4 --> WT
    E5 --> WT
```

### 冪等性チェック

```mermaid
graph LR
    GEN["自動生成リクエスト"] --> CHK{"既存レコード<br/>チェック"}
    CHK -->|"(stpCompanyId, contractHistoryId,<br/>revenueType, targetMonth, candidateId)<br/>が一致するレコード存在"| SKIP["スキップ"]
    CHK -->|"該当なし"| CREATE["新規作成<br/>isAutoGenerated=true"]
```

---

## 7. 請求書・消込フロー

```mermaid
graph TD
    subgraph "請求書作成"
        SRR["StpRevenueRecord<br/>（売上）"]
        SER["StpExpenseRecord<br/>（経費）"]
    end

    SRR -.->|"売上→請求書生成"| INV["StpInvoice"]
    SER -.->|"経費→請求書紐付"| INV

    INV -.->|"outgoing自動採番"| NUM["INV-YYYYMM-NNNN<br/>StpInvoiceNumberSequence"]
    INV -->|"明細行"| LI["StpInvoiceLineItem"]
    INV -.->|"赤伝生成"| CN["StpInvoice<br/>(credit_note)"]
    CN -.->|"originalInvoiceId"| INV

    subgraph "消込フロー"
        PT["StpPaymentTransaction<br/>（入出金）"]
        PA["StpPaymentAllocation<br/>（配分）"]
    end

    PT --> PA
    PA -->|"revenueRecordId"| SRR
    PA -->|"expenseRecordId"| SER

    PA -.->|"配分後"| RTS["recalcTransactionStatus()<br/>unmatched→partial→matched"]
    PA -.->|"配分後"| RRS["recalcRecordPaymentStatus()<br/>null→partial→paid"]

    RTS -.-> PT
    RRS -.-> SRR
    RRS -.-> SER

    subgraph "請求書ステータス"
        OUT["outgoing:<br/>draft → issued → sent → paid"]
        IN["incoming:<br/>received → approved → paid"]
    end
```

### 税率別集計（インボイス制度）

```mermaid
graph LR
    LI1["明細行 tax=10%<br/>amount=100,000"] --> CALC["税率別集計<br/>invoice-tax.ts"]
    LI2["明細行 tax=10%<br/>amount=50,000"] --> CALC
    LI3["明細行 tax=8%<br/>amount=30,000"] --> CALC

    CALC --> JSON["subtotalByTaxRate:<br/>{10: {subtotal:150000, tax:15000},<br/> 8: {subtotal:30000, tax:2400}}"]
```

---

## 8. 月次締めフロー

```mermaid
graph TD
    subgraph "STP月次締め"
        CLOSE1["closeMonth()<br/>StpMonthlyClose"]
        REOPEN1["reopenMonth()<br/>理由入力必須"]
    end

    subgraph "会計月次締め（2段階）"
        CLOSE2["project_closed<br/>プロジェクト担当が締め"]
        CLOSE3["accounting_closed<br/>経理が最終締め"]
        REOPEN2["open<br/>再オープン"]
    end

    subgraph "編集制限"
        GUARD["ensureMonthNotClosed()"]
    end

    CLOSE1 -->|"締め済み"| GUARD
    GUARD -.->|"ブロック"| SRR["売上更新/削除"]
    GUARD -.->|"ブロック"| SER["経費更新/削除"]

    REOPEN1 -->|"再オープン"| CLOSE1

    CLOSE2 -->|"project_closed"| CLOSE3
    CLOSE3 -->|"accounting_closed"| AMC["AccountingMonthlyClose"]
    REOPEN2 -->|"再オープン"| CLOSE2

    style GUARD fill:#ff6b6b,color:#fff
```

---

## 9. 外部ユーザー登録フロー

```mermaid
graph TD
    ADMIN["管理者"] -.->|"トークン発行"| RT["RegistrationToken<br/>+ DefaultViews"]

    RT -->|"/register/[token]"| VAL{"トークン検証<br/>ステータス/期限/回数"}

    VAL -->|"失敗"| ERR["エラー表示"]
    VAL -->|"成功"| FORM["登録フォーム"]

    FORM -->|"送信"| EU["ExternalUser<br/>status=pending_email"]
    EU -.->|"useCount++"| RT
    RT -.->|"useCount >= maxUses"| EXH["status=exhausted"]

    EU -.->|"メール送信"| EVT["EmailVerificationToken<br/>（24時間有効）"]

    EVT -->|"認証リンククリック"| VER["メール認証<br/>status=pending_approval"]

    VER -->|"管理者承認"| ACT["status=active<br/>+ DisplayPermission作成"]
    VER -->|"管理者却下"| DEL["物理削除"]

    ACT -.->|"ログイン可能"| LOGIN["ログイン<br/>→ /portal/*"]

    subgraph "パスワードリセット"
        FORGOT["forgot-password"] -.->|"既存トークン全無効化"| PRT["PasswordResetToken<br/>（1時間有効）"]
        PRT -->|"リセット実行"| RESET["パスワード更新"]
    end
```

---

## 10. リード獲得フォームフロー

```mermaid
graph TD
    AGENT["代理店"] -->|"フォームURL共有"| LFT["StpLeadFormToken"]

    LFT -->|"/form/stp-lead/[token]"| FORM["ヒアリングフォーム<br/>（3ページ）"]

    FORM -->|"職種連動<br/>SPEC-STP-002"| PAGE2["ページ2<br/>採用希望職種<br/>（読取専用自動反映）"]

    FORM -->|"送信"| SUB["StpLeadFormSubmission<br/>status=pending"]
    SUB -.->|"自動生成"| PROP["StpProposal<br/>status=draft"]

    SUB -->|"処理画面"| PROC{"3パターン判定"}

    PROC -->|"新規企業"| NEW["MasterStellaCompany作成<br/>+ Location作成<br/>+ Contact作成<br/>+ StpCompany作成<br/>（currentStageId=1）"]

    PROC -->|"既存・STP未登録"| EXIST1["StpCompany新規作成<br/>+ 情報更新"]

    PROC -->|"既存・STP登録済み"| EXIST2["紐付けのみ"]

    NEW -.->|"leadSource=代理店"| SC["StpCompany"]
    EXIST1 -.->|"leadSource=代理店"| SC
```

---

## 11. 会計システムフロー

```mermaid
graph TD
    subgraph "データ取込"
        CSV["CSV/freeeインポート"]
        BATCH["AccountingImportBatch"]
    end

    CSV --> BATCH
    BATCH --> AT["AccountingTransaction<br/>重複スキップ機能あり"]

    subgraph "消込・照合"
        AT --> AR["AccountingReconciliation"]
        AR -->|"revenueRecordId"| SRR["StpRevenueRecord"]
        AR -->|"expenseRecordId"| SER["StpExpenseRecord"]
    end

    subgraph "ダブルチェック"
        AT --> AV1["AccountingVerification<br/>type=project<br/>（プロジェクト確認）"]
        AT --> AV2["AccountingVerification<br/>type=accounting<br/>（経理確認）"]
    end

    AV1 -.->|"verified/flagged"| STATUS1["プロジェクト確認完了"]
    AV2 -.->|"verified/flagged"| STATUS2["経理確認完了"]

    subgraph "月次締め（2段階）"
        AMC["AccountingMonthlyClose"]
        AMC -.->|"open → project_closed"| AMC
        AMC -.->|"project_closed → accounting_closed"| AMC
    end

    AT ==>|"onDelete: Cascade"| AR
    AT ==>|"onDelete: Cascade"| AV1
    AT ==>|"onDelete: Cascade"| AV2
```

---

## 12. 認証・権限フロー

```mermaid
graph TD
    subgraph "社内スタッフ"
        LOGIN1["メール/ログインID + パスワード"]
        AUTH1["MasterStaff検索<br/>bcrypt検証<br/>isActive=true"]
        PERM["StaffPermission<br/>projectCode × permissionLevel"]
    end

    subgraph "外部ユーザー"
        LOGIN2["メール + パスワード"]
        AUTH2["ExternalUser検索<br/>status=active<br/>bcrypt検証"]
        DISP["ExternalUserDisplayPermission<br/>× DisplayView"]
    end

    LOGIN1 --> AUTH1
    AUTH1 -->|"成功"| SESSION1["セッション<br/>userType=staff"]
    AUTH1 -->|"失敗"| AUTH2

    LOGIN2 --> AUTH2
    AUTH2 -->|"成功"| SESSION2["セッション<br/>userType=external"]

    subgraph "ミドルウェア"
        MW["middleware.ts"]
        MW -.->|"staff"| STAFF_ROUTES["/companies, /stp/*, /admin/*"]
        MW -.->|"external"| EXT_ROUTES["/portal/*"]
        MW -.->|"projectCode権限チェック"| PERM
        MW -.->|"displayView権限チェック"| DISP
    end

    SESSION1 --> MW
    SESSION2 --> MW

    subgraph "権限レベル"
        NONE["none = 0"]
        VIEW["view = 1"]
        EDIT["edit = 2"]
        ADMIN["admin = 3"]
    end
```

---

## テーブル数サマリー

| カテゴリ | テーブル数 | 主要テーブル |
|---------|-----------|-------------|
| 全顧客マスタ | 4 | MasterStellaCompany, Location, Contact, BankAccount |
| STPプロジェクト | 7 | StpCompany, StpStage, StpStageHistory, StpContractHistory, StpCompanyContract, StpCandidate, StpProposal |
| 代理店 | 6 | StpAgent, StpAgentContract, StpAgentStaff, StpAgentContractHistory, StpAgentCommissionOverride, StpLeadFormToken |
| 財務 | 8 | StpRevenueRecord, StpExpenseRecord, StpInvoice, StpInvoiceLineItem, StpPaymentTransaction, StpPaymentAllocation, StpMonthlyClose, StpFinanceEditLog |
| 会計 | 5 | AccountingImportBatch, AccountingTransaction, AccountingReconciliation, AccountingVerification, AccountingMonthlyClose |
| 認証・外部ユーザー | 8 | MasterStaff, ExternalUser, DisplayView, ExternalUserDisplayPermission, RegistrationToken, RegistrationTokenDefaultView, EmailVerificationToken, PasswordResetToken |
| マスタ | 6 | MasterProject, OperatingCompany, MasterContractStatus, MasterContract, MasterContractStatusHistory, ContactMethod |
| リード | 2 | StpLeadFormSubmission, StpProposal |
| KPI | 3 | StpKpiSheet, StpKpiWeeklyData, StpKpiShareLink |
| その他 | 5 | ContactHistory, ContactHistoryFile, ContactHistoryRole, CustomerType, ShortUrl, LoginHistory |
| **合計** | **約54** | |
