/**
 * Googleスライドテンプレートの全内容をダンプ
 */

import { google } from "googleapis";
import fs from "fs";
import path from "path";

const KEY_PATH = path.join(process.cwd(), "credentials/google-service-account.json");
const TEMPLATE_ID = "1aMcXAgbtJeYMAW0_9Af5oAMQtjDicgx3TKBGuz9fwUc";

async function main() {
  const keyFile = JSON.parse(fs.readFileSync(KEY_PATH, "utf-8"));

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: keyFile.client_email,
      private_key: keyFile.private_key,
    },
    scopes: [
      "https://www.googleapis.com/auth/presentations.readonly",
      "https://www.googleapis.com/auth/drive.readonly",
    ],
  });

  const authClient = await auth.getClient();
  const slides = google.slides({ version: "v1", auth: authClient });

  const presentation = await slides.presentations.get({
    presentationId: TEMPLATE_ID,
  });

  console.log("タイトル:", presentation.data.title);
  console.log("スライド数:", presentation.data.slides?.length);

  const slidesList = presentation.data.slides || [];
  for (let i = 0; i < slidesList.length; i++) {
    const slide = slidesList[i];
    console.log(`\n${"=".repeat(60)}`);
    console.log(`スライド ${i + 1} (ID: ${slide.objectId})`);
    console.log(`${"=".repeat(60)}`);

    const elements = slide.pageElements || [];
    console.log(`要素数: ${elements.length}`);

    for (let j = 0; j < elements.length; j++) {
      const el = elements[j];
      console.log(`\n--- 要素 ${j + 1} (${el.objectId}) ---`);

      // サイズ・位置
      if (el.transform) {
        const t = el.transform;
        console.log(`  位置: translateX=${Math.round((t.translateX || 0) / 914400 * 100) / 100}inch, translateY=${Math.round((t.translateY || 0) / 914400 * 100) / 100}inch`);
      }
      if (el.size) {
        const w = el.size.width;
        const h = el.size.height;
        console.log(`  サイズ: ${Math.round((w?.magnitude || 0) / 914400 * 100) / 100}inch x ${Math.round((h?.magnitude || 0) / 914400 * 100) / 100}inch`);
      }

      dumpElement(el, "  ");
    }
  }
}

function dumpElement(el, indent) {
  // Shape
  if (el.shape) {
    const shapeType = el.shape.shapeType;
    console.log(`${indent}[SHAPE type=${shapeType}]`);

    // 背景色
    if (el.shape.shapeProperties?.solidFill) {
      console.log(`${indent}  fill: ${JSON.stringify(el.shape.shapeProperties.solidFill)}`);
    }

    // テキスト
    if (el.shape.text) {
      const textElements = el.shape.text.textElements || [];
      let allText = "";
      for (const te of textElements) {
        if (te.textRun) {
          allText += te.textRun.content;
        }
      }
      allText = allText.replace(/\n$/, "");
      if (allText) {
        console.log(`${indent}  text: "${allText}"`);
      }
    }
  }

  // Image
  if (el.image) {
    console.log(`${indent}[IMAGE] src: ${el.image.sourceUrl || el.image.contentUrl || "(embedded)"}`);
  }

  // Table
  if (el.table) {
    console.log(`${indent}[TABLE ${el.table.rows}x${el.table.columns}]`);
    for (let r = 0; r < el.table.rows; r++) {
      const row = el.table.tableRows[r];
      for (let c = 0; c < el.table.columns; c++) {
        const cell = row.tableCells[c];
        if (cell.text) {
          let cellText = "";
          for (const te of (cell.text.textElements || [])) {
            if (te.textRun) cellText += te.textRun.content;
          }
          cellText = cellText.replace(/\n$/, "");
          if (cellText) console.log(`${indent}  [${r},${c}] "${cellText}"`);
        }
      }
    }
  }

  // Group
  if (el.group) {
    console.log(`${indent}[GROUP] children: ${(el.group.children || []).length}`);
    for (const child of (el.group.children || [])) {
      dumpElement(child, indent + "  ");
    }
  }

  // Line
  if (el.line) {
    console.log(`${indent}[LINE]`);
  }
}

main().catch((err) => {
  console.error("エラー:", err.message);
  if (err.response?.data) console.error(JSON.stringify(err.response.data, null, 2));
});
