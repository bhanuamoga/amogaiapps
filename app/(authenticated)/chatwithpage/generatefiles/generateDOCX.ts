"use client";

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  AlignmentType,
} from "docx";
import { saveAs } from "file-saver";

interface TableData {
  columns: { key: string; header: string }[];
  rows: Record<string, any>[];
}

export async function generateDOCX({
  story,
  table,
  fileName = "ai-chat-export",
}: {
  story?: string;
  table?: TableData;
  fileName?: string;
}) {
  const children: any[] = [];

  // Title
  children.push(
    new Paragraph({
      text: "AI Chat Export",
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 300 },
    })
  );

  // Table Section
  if (table) {
    children.push(
      new Paragraph({
        text: "Table",
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 300, after: 200 },
      })
    );

    const tableRows = [
      // Header row
      new TableRow({
        children: table.columns.map(
          (c) =>
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: c.header,
                      bold: true,
                    }),
                  ],
                }),
              ],
            })
        ),
      }),

      // Data rows
      ...table.rows.map(
        (row) =>
          new TableRow({
            children: table.columns.map((c) => {
              const value = String(row[c.key] ?? "");

              return new TableCell({
                children: [new Paragraph(value)],
              });
            }),
          })
      ),
    ];

    children.push(
      new Table({
        rows: tableRows,
        width: { size: 100, type: "pct" },
      })
    );
  }

  // Story Section
  if (story) {
    children.push(
      new Paragraph({
        text: "Explanation",
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 },
      })
    );

    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: story,
            size: 24,
          }),
        ],
      })
    );
  }

  // Generate DOCX
  const doc = new Document({
    sections: [{ children }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${fileName}.docx`);
}
