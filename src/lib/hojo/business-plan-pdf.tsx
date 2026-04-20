import React from "react";
import { Document, Page, View, Text, Font, StyleSheet } from "@react-pdf/renderer";
import path from "path";
import { BUSINESS_PLAN_SECTIONS, type BusinessPlanSectionKey } from "./business-plan-sections";

Font.register({
  family: "NotoSansJP",
  fonts: [
    {
      src: path.join(process.cwd(), "public/fonts/NotoSansJP-Regular.ttf"),
      fontWeight: "normal",
    },
    {
      src: path.join(process.cwd(), "public/fonts/NotoSansJP-Bold.ttf"),
      fontWeight: "bold",
    },
  ],
});

export type BusinessPlanPdfData = {
  tradeName: string;
  fullName: string;
  generatedAt: Date;
  sections: Record<BusinessPlanSectionKey, string>;
};

const styles = StyleSheet.create({
  page: {
    fontFamily: "NotoSansJP",
    fontSize: 10.5,
    paddingTop: 48,
    paddingBottom: 48,
    paddingHorizontal: 56,
    lineHeight: 1.7,
  },
  coverPage: {
    fontFamily: "NotoSansJP",
    paddingTop: 180,
    paddingBottom: 60,
    paddingHorizontal: 80,
    justifyContent: "space-between",
  },
  coverTitle: {
    fontSize: 30,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 40,
    letterSpacing: 2,
  },
  coverTradeName: {
    fontSize: 18,
    textAlign: "center",
    marginBottom: 12,
  },
  coverFullName: {
    fontSize: 14,
    textAlign: "center",
    color: "#4b5563",
  },
  coverFooter: {
    fontSize: 10,
    textAlign: "center",
    color: "#6b7280",
    marginTop: 120,
  },
  tocTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 16,
    textAlign: "center",
  },
  tocItem: {
    fontSize: 11,
    marginBottom: 6,
    paddingLeft: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "bold",
    marginTop: 8,
    marginBottom: 10,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#111827",
  },
  sectionBody: {
    fontSize: 10.5,
    lineHeight: 1.8,
  },
  sectionSpacer: {
    marginBottom: 20,
  },
  pageNumber: {
    position: "absolute",
    bottom: 24,
    left: 0,
    right: 0,
    textAlign: "center",
    fontSize: 9,
    color: "#6b7280",
  },
});

function CoverPage({ data }: { data: BusinessPlanPdfData }) {
  const d = data.generatedAt;
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const day = d.getDate();
  return (
    <Page size="A4" style={styles.coverPage}>
      <View>
        <Text style={styles.coverTitle}>事業計画書</Text>
        <Text style={styles.coverTradeName}>{data.tradeName || "（屋号未記入）"}</Text>
        <Text style={styles.coverFullName}>{data.fullName || ""}</Text>
      </View>
      <Text style={styles.coverFooter}>
        作成日: {year}年{month}月{day}日
      </Text>
    </Page>
  );
}

function TableOfContents() {
  return (
    <Page size="A4" style={styles.page}>
      <Text style={styles.tocTitle}>目次</Text>
      {BUSINESS_PLAN_SECTIONS.map((s) => (
        <Text key={s.key} style={styles.tocItem}>
          {s.title}
        </Text>
      ))}
      <Text
        style={styles.pageNumber}
        render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
        fixed
      />
    </Page>
  );
}

function ContentPages({ sections }: { sections: Record<BusinessPlanSectionKey, string> }) {
  return (
    <>
      {BUSINESS_PLAN_SECTIONS.map((def) => (
        <Page key={def.key} size="A4" style={styles.page}>
          <Text style={styles.sectionTitle}>{def.title}</Text>
          <Text style={styles.sectionBody}>{sections[def.key] ?? ""}</Text>
          <Text
            style={styles.pageNumber}
            render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
            fixed
          />
        </Page>
      ))}
    </>
  );
}

export function BusinessPlanPdf({ data }: { data: BusinessPlanPdfData }) {
  return (
    <Document>
      <CoverPage data={data} />
      <TableOfContents />
      <ContentPages sections={data.sections} />
    </Document>
  );
}
