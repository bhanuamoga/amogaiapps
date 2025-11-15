/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import pdfMake from "pdfmake/build/pdfmake";
// @ts-ignore
import pdfFonts from "pdfmake/build/vfs_fonts";

pdfMake.vfs = pdfFonts.vfs;

export async function downloadPDFFormatted({
  storyText,
  tableData,
  chartCanvas,
  fileName = "ai-chat-export",
}: {
  storyText?: string;
  tableData?: { rows: any[]; columns: any[] };
  chartCanvas?: HTMLCanvasElement | null;
  fileName?: string;
}) {
  const pdfContent: any[] = [];

  // TITLE
  pdfContent.push({
    text: "AI Chat Export",
    style: "header",
    alignment: "center",
    margin: [0, 0, 0, 18],
  });

  // TABLE
  if (tableData?.columns && tableData?.rows) {
    const headers = tableData.columns.map((c) => c.header);
    const rows = tableData.rows.map((r) =>
      tableData.columns.map((c) => String(r[c.key] ?? ""))
    );

    pdfContent.push({
      text: "Table",
      style: "subheader",
      margin: [0, 10, 0, 8],
    });

    pdfContent.push({
      table: {
        headerRows: 1,
        widths: Array(headers.length).fill("*"),
        body: [headers, ...rows],
      },
      layout: "lightHorizontalLines",
      margin: [0, 0, 0, 18],
    });
  }

  // CHART
  if (chartCanvas && typeof chartCanvas.toDataURL === "function") {
    const chartImg = chartCanvas.toDataURL("image/png", 1.0);

    pdfContent.push({
      text: "Chart",
      style: "subheader",
      margin: [0, 10, 0, 8],
    });

    pdfContent.push({
      image: chartImg,
      width: 450,
      margin: [0, 0, 0, 18],
    });
  }

  // STORY
  if (storyText) {
    pdfContent.push({
      text: "Explanation",
      style: "subheader",
      margin: [0, 10, 0, 8],
    });

    pdfContent.push({
      text: storyText,
      style: "story",
    });
  }

  const docDefinition = {
    content: pdfContent,
    styles: {
      header: { fontSize: 22, bold: true },
      subheader: { fontSize: 16, bold: true },
      story: { fontSize: 12, lineHeight: 1.4 },
    },
    defaultStyle: {
      font: "Helvetica",
    },
    pageMargins: [25, 25, 25, 25],
  };

  pdfMake.createPdf(docDefinition).download(`${fileName}.pdf`);
}
