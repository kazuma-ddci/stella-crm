/**
 * 採用ブースト 提案スライド自動生成システム（スタンドアロン版）
 * スライド生成処理
 */

/**
 * テンプレートからスライドを生成
 * @param {Object} simulationResult - sb_calculateSimulation() の結果
 * @returns {Object} 生成されたスライドの情報
 */
function sb_generateSlide(simulationResult) {
  const templateId = SB_CONFIG.SLIDE_TEMPLATE_ID;
  const outputFolderId = SB_CONFIG.OUTPUT_FOLDER_ID;

  if (!templateId || templateId === 'YOUR_TEMPLATE_ID_HERE') {
    throw new Error('テンプレートIDが設定されていません。slide_config.gsのSLIDE_TEMPLATE_IDを設定してください。');
  }

  const timestamp = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyyMMdd_HHmmss');
  const safeName = (simulationResult.companyName || '御社').replace(/[\/\\:*?"<>|]/g, '_');
  const fileName = safeName + '_提案資料_' + timestamp;

  const templateFile = DriveApp.getFileById(templateId);
  let newFile;

  if (outputFolderId && outputFolderId !== 'YOUR_FOLDER_ID_HERE') {
    const folder = DriveApp.getFolderById(outputFolderId);
    newFile = templateFile.makeCopy(fileName, folder);
  } else {
    newFile = templateFile.makeCopy(fileName);
  }

  const newSlideId = newFile.getId();

  sb_replacePlaceholders(newSlideId, simulationResult);

  const slideUrl = 'https://docs.google.com/presentation/d/' + newSlideId + '/edit';

  return {
    fileId: newSlideId,
    fileName: fileName,
    url: slideUrl,
    companyName: simulationResult.companyName,
  };
}

/**
 * スライド内のプレースホルダーを置換
 */
function sb_replacePlaceholders(slideId, data) {
  const presentation = SlidesApp.openById(slideId);
  const slides = presentation.getSlides();

  const replacements = sb_buildReplacementMap(data);

  slides.forEach(function(slide) {
    const pageElements = slide.getPageElements();

    pageElements.forEach(function(element) {
      sb_replaceInElement(element, replacements);
    });

    const tables = slide.getTables();
    tables.forEach(function(table) {
      const numRows = table.getNumRows();
      const numCols = table.getNumColumns();

      for (let row = 0; row < numRows; row++) {
        for (let col = 0; col < numCols; col++) {
          const cell = table.getCell(row, col);
          const textRange = cell.getText();
          const text = textRange.asString();

          for (const placeholder in replacements) {
            if (text.includes(placeholder)) {
              textRange.replaceAllText(placeholder, replacements[placeholder]);
            }
          }
        }
      }
    });
  });

  presentation.saveAndClose();
}

/**
 * 数字にカンマを追加
 */
function sb_formatWithComma(num) {
  return num.toLocaleString('ja-JP');
}

/**
 * 要素内のテキストを置換（グループも再帰的に処理）
 */
function sb_replaceInElement(element, replacements) {
  const type = element.getPageElementType();

  if (type === SlidesApp.PageElementType.GROUP) {
    const group = element.asGroup();
    const children = group.getChildren();
    children.forEach(function(child) {
      sb_replaceInElement(child, replacements);
    });
    return;
  }

  if (type === SlidesApp.PageElementType.SHAPE) {
    try {
      const shape = element.asShape();
      const textRange = shape.getText();
      if (textRange) {
        const text = textRange.asString();
        for (const placeholder in replacements) {
          if (text.includes(placeholder)) {
            textRange.replaceAllText(placeholder, replacements[placeholder]);
          }
        }
      }
    } catch (e) {
      // テキストを持たないシェイプはスキップ
    }
  }
}

/**
 * 置換マッピングを作成
 */
function sb_buildReplacementMap(data) {
  const parsedCompany = sb_parseCompanyName(data.companyName);

  const toMan = (val) => sb_formatWithComma(Math.round(val / 10000));

  return {
    // 表紙
    '{{会社名}}': data.companyName + '様',
    '{{会社名_上}}': parsedCompany.line1,
    '{{会社名_下}}': parsedCompany.line2 || '',
    '{{会社名_フル}}': data.companyName + '様',
    '{{タイトル会社名}}': '【' + data.companyName + '様】',

    // Before（現状）- 両スライド共通
    '{{年間採用コスト_before}}': toMan(data.before.annualCost),
    '{{採用人数_before}}': String(data.before.annualHires),
    '{{採用単価_before}}': toMan(data.before.costPerHire),
    '{{目標採用人数}}': String(data.targetHires),
    '{{合計採用コスト_before}}': toMan(data.before.totalCostForTarget),
    '{{職種}}': data.jobType,

    // 成果報酬型スライド
    '{{合計採用コスト_成果10}}': toMan(data.scenario10.successFeeCost),
    '{{削減率_成果10}}': String(data.scenario10.reductionSuccess),
    '{{予想期間_成果10}}': String(data.scenario10.months),
    '{{合計採用コスト_成果20}}': toMan(data.scenario20.successFeeCost),
    '{{削減率_成果20}}': String(data.scenario20.reductionSuccess),
    '{{予想期間_成果20}}': String(data.scenario20.months),

    // 月額固定型スライド
    '{{合計採用コスト_固定10}}': toMan(data.scenario10.monthlyFeeCost),
    '{{削減率_固定10}}': String(data.scenario10.reductionMonthly),
    '{{予想期間_固定10}}': String(data.scenario10.months),
    '{{合計採用コスト_固定20}}': toMan(data.scenario20.monthlyFeeCost),
    '{{削減率_固定20}}': String(data.scenario20.reductionMonthly),
    '{{予想期間_固定20}}': String(data.scenario20.months),
  };
}

/**
 * GoogleスライドをPDFとしてエクスポート
 */
function sb_exportSlideToPdf(slideId, fileName) {
  const file = DriveApp.getFileById(slideId);
  const pdfBlob = file.getAs(MimeType.PDF);
  pdfBlob.setName(fileName + '.pdf');
  return pdfBlob;
}

/**
 * テスト用：サンプルデータでスライドを生成
 */
function sb_testGenerateSlide() {
  const testFormData = {
    companyName: 'テスト株式会社',
    industry: '建築系',
    jobType: '施工管理',
    location: '東京',
    recruitmentAgencyCost: 10000000,
    jobAdCost: 5000000,
    referralCost: 1000000,
    otherCost: 500000,
    annualHires: 24,
    targetHires: 24,
  };

  const result = sb_calculateSimulation(testFormData);
  Logger.log('シミュレーション結果:');
  Logger.log(JSON.stringify(result, null, 2));

  if (SB_CONFIG.SLIDE_TEMPLATE_ID !== 'YOUR_TEMPLATE_ID_HERE') {
    const slideInfo = sb_generateSlide(result);
    Logger.log('生成されたスライド:');
    Logger.log(slideInfo.url);
  } else {
    Logger.log('テンプレートIDが未設定のため、スライド生成はスキップしました。');
  }
}
