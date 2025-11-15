"use client";
import PptxGenJS from "pptxgenjs";

export async function generatePPT({ story, table, fileName }: any) {
  const ppt = new PptxGenJS();
  const slide = ppt.addSlide();

  slide.addText("AI Chat Export", { x: 1, y: 0.3, fontSize: 28, bold: true });

  if (table) {
    slide.addText("Table", { x: 0.5, y: 1, fontSize: 18 });

    const rows = [
      table.columns.map((c: any) => c.header),
      ...table.rows.map((r: any) => table.columns.map((c: any) => String(r[c.key])))
    ];

    slide.addTable(rows, { x: 0.5, y: 1.4, w: 9 });
  }

  if (story) {
    slide.addText("Explanation", { x: 0.5, y: 4, fontSize: 18 });
    slide.addText(story, { x: 0.5, y: 4.5, fontSize: 14, wrap: true, w: 9 });
  }

  ppt.writeFile(`${fileName}.pptx`);
}
