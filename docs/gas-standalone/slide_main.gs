/**
 * 採用ブースト 提案スライド自動生成システム（スタンドアロン版）
 * メイン処理
 *
 * 構成: 1つのスプレッドシート + Googleフォーム
 * フォーム送信 → onFormSubmit → スライド生成 → URL書き込み
 */

/**
 * フォーム送信時のトリガー関数
 * @param {Object} e - フォーム送信イベントオブジェクト
 */
function sb_onFormSubmit(e) {
  try {
    const sheet = e.range.getSheet();

    // フォーム回答シートか確認
    if (sheet.getName() !== SB_CONFIG.HEARING_SHEET_NAME) {
      Logger.log('対象外のシート: ' + sheet.getName());
      return;
    }

    const row = e.range.getRow();
    Logger.log('フォーム送信を検知 (行 ' + row + ')');

    // ヘッダーを取得
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

    // 処理済み列・URL列のインデックスを取得（なければ追加）
    const processedColIndex = sb_getOrCreateColumn(sheet, headers, SB_CONFIG.PROCESSED_HEADER);
    const urlColIndex = sb_getOrCreateColumn(sheet, headers, SB_CONFIG.SLIDE_URL_HEADER);

    // 該当行のデータを取得
    const maxCol = Math.max(processedColIndex, urlColIndex) + 1;
    const rowValues = sheet.getRange(row, 1, 1, maxCol).getValues()[0];

    // 処理済みならスキップ
    if (rowValues[processedColIndex] === '済') {
      Logger.log('処理済みのためスキップ (行 ' + row + ')');
      return;
    }

    // 行データをヘッダー名と紐付け
    const currentHeaders = sheet.getRange(1, 1, 1, maxCol).getValues()[0];
    const rowData = {};
    currentHeaders.forEach(function(header, index) {
      rowData[header] = rowValues[index] !== undefined ? String(rowValues[index]) : '';
    });

    // フォームデータを抽出
    const formData = sb_extractFormDataFromRow(rowData);
    Logger.log('処理中: ' + (formData.companyName || '不明'));

    // シミュレーション計算
    const simulationResult = sb_calculateSimulation(formData);

    // スライド生成
    const slideInfo = sb_generateSlide(simulationResult);
    Logger.log('スライド生成完了: ' + slideInfo.url);

    // URLを書き込み
    sheet.getRange(row, urlColIndex + 1).setValue(slideInfo.url);

    // 処理済みフラグを立てる
    sheet.getRange(row, processedColIndex + 1).setValue('済');

    Logger.log('完了 (行 ' + row + '): ' + slideInfo.companyName);

  } catch (error) {
    Logger.log('エラー発生: ' + error.message);
    Logger.log(error.stack);
  }
}

/**
 * 未処理の行をまとめて処理（手動実行・リカバリ用）
 */
function sb_processAll() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SB_CONFIG.HEARING_SHEET_NAME);

  if (!sheet) {
    Logger.log('シートが見つかりません: ' + SB_CONFIG.HEARING_SHEET_NAME);
    return;
  }

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  const processedColIndex = sb_getOrCreateColumn(sheet, headers, SB_CONFIG.PROCESSED_HEADER);
  const urlColIndex = sb_getOrCreateColumn(sheet, headers, SB_CONFIG.SLIDE_URL_HEADER);

  const maxCol = Math.max(processedColIndex, urlColIndex) + 2;
  const currentHeaders = sheet.getRange(1, 1, 1, maxCol).getValues()[0];
  const allData = sheet.getRange(2, 1, lastRow - 1, maxCol).getValues();

  let processedCount = 0;

  for (let i = 0; i < allData.length; i++) {
    const rowValues = allData[i];

    // 処理済みならスキップ
    if (rowValues[processedColIndex] === '済') continue;

    // 空行ならスキップ
    if (!rowValues[0] && !rowValues[1]) continue;

    const rowData = {};
    currentHeaders.forEach(function(header, index) {
      rowData[header] = rowValues[index] !== undefined ? String(rowValues[index]) : '';
    });

    const formData = sb_extractFormDataFromRow(rowData);
    Logger.log('処理中 (行 ' + (i + 2) + '): ' + (formData.companyName || '不明'));

    try {
      const simulationResult = sb_calculateSimulation(formData);
      const slideInfo = sb_generateSlide(simulationResult);
      Logger.log('スライド生成完了: ' + slideInfo.url);

      sheet.getRange(i + 2, urlColIndex + 1).setValue(slideInfo.url);
      sheet.getRange(i + 2, processedColIndex + 1).setValue('済');
      processedCount++;
    } catch (rowError) {
      Logger.log('行 ' + (i + 2) + ' でエラー: ' + rowError.message);
    }
  }

  Logger.log('処理完了: ' + processedCount + '件');
}

/**
 * ヘッダー列のインデックスを取得（なければ追加）
 */
function sb_getOrCreateColumn(sheet, headers, headerName) {
  let colIndex = headers.indexOf(headerName);
  if (colIndex === -1) {
    colIndex = sheet.getLastColumn();
    sheet.getRange(1, colIndex + 1).setValue(headerName);
  }
  return colIndex;
}

/**
 * 行データからフォームデータを抽出
 *
 * ヘッダー名一覧（Googleフォームの質問項目）:
 * - タイムスタンプ
 * - 会社名
 * - 担当者氏名
 * - メールアドレス
 * - 今後採用を進める予定のある職種で過去にも採用を行っていた職種
 * - その職種を採用する上で、過去1年間で人材紹介会社にかけた費用（円）
 * - その職種を採用する上で、過去1年間で求人広告会社にかけた費用（円）
 *   （運用代行会社への委託費や運用に関わる人件費も含めてください）
 * - その職種を採用する上で、過去1年間でリファラルにかけた費用（円）
 * - その職種を採用する上で、過去1年間でその他かけた費用（円）
 * - 過去1年間の採用人数（人）
 * - ご希望の職種
 * - 年間採用予算（円）
 * - 年間採用希望人数（人）
 * - 採用エリア（都道府県）
 * - いつまでに採用したいか（月）
 * - 採用可能年齢幅
 * - 採用必須条件
 * - 採用希望条件
 */
function sb_extractFormDataFromRow(rowData) {
  const jobType = rowData['ご希望の職種'] || '';
  const pastJobType = rowData['今後採用を進める予定のある職種で過去にも採用を行っていた職種'] || '';

  return {
    // 基本情報
    timestamp: rowData['タイムスタンプ'] || '',
    companyName: rowData['会社名'] || '',
    contactName: rowData['担当者氏名'] || '',
    email: rowData['メールアドレス'] || '',

    // 職種・業界
    pastJobType: pastJobType,
    jobType: jobType || pastJobType,
    industry: sb_detectIndustryFromJob(jobType || pastJobType),

    // 過去1年間のコスト
    recruitmentAgencyCost: rowData['その職種を採用する上で、過去1年間で人材紹介会社にかけた費用（円）'] || 0,
    jobAdCost: rowData['その職種を採用する上で、過去1年間で求人広告会社にかけた費用（円）'] || 0,
    referralCost: rowData['その職種を採用する上で、過去1年間でリファラルにかけた費用（円）'] || 0,
    otherCost: rowData['その職種を採用する上で、過去1年間でその他かけた費用（円）'] || 0,
    annualHires: rowData['過去1年間の採用人数（人）'] || 0,

    // 今後の希望
    budget: rowData['年間採用予算（円）'] || 0,
    targetHires: rowData['年間採用希望人数（人）'] || 0,
    location: rowData['採用エリア（都道府県）'] || '',
    deadline: rowData['いつまでに採用したいか（月）'] || '',
    ageRange: rowData['採用可能年齢幅'] || '',
    requiredConditions: rowData['採用必須条件'] || '',
    preferredConditions: rowData['採用希望条件'] || '',
  };
}

/**
 * 職種から業界を推測
 */
function sb_detectIndustryFromJob(jobType) {
  if (!jobType) return '';

  const jobToIndustry = {
    '施工管理': '建築系',
    '建築': '建築系',
    '建設': '建築系',
    'ドライバー': '運送・物流',
    'タクシー': 'タクシー',
    '携帯販売': '携帯販売',
    '携帯': '携帯販売',
    '販売': '小売販売',
    'エンジニア': 'SES',
    '警備': '警備',
    'コールセンター': 'コールセンター',
    'オペレーター': 'コールセンター',
    '派遣': '人材派遣',
    '飲食': '飲食',
    'ホテル': 'ホテル',
    '清掃': '清掃',
    '引越し': '引越し',
    '不動産': '不動産',
    '製造': '製造',
    '工場': '製造',
  };

  for (const keyword in jobToIndustry) {
    if (jobType.includes(keyword)) {
      return jobToIndustry[keyword];
    }
  }

  return '';
}

/**
 * トリガーを設定する関数（初回セットアップ用）
 * フォーム送信時にsb_onFormSubmitが自動実行されるようになる
 */
function sb_setupTrigger() {
  // 既存のトリガーを削除
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function(trigger) {
    if (trigger.getHandlerFunction() === 'sb_onFormSubmit') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  if (!ss) {
    Logger.log('エラー: このスクリプトはスプレッドシートにバインドして実行してください。');
    return;
  }

  // onFormSubmitトリガーを作成
  ScriptApp.newTrigger('sb_onFormSubmit')
    .forSpreadsheet(ss)
    .onFormSubmit()
    .create();

  Logger.log('フォーム送信トリガーを設定しました: ' + ss.getName());
}
