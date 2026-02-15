import {
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  HeadingLevel,
  convertInchesToTwip,
} from "docx";
import { TABLE_BORDER, HEADER_SHADING, GRAY_600 } from "./styles";

export function heading(
  text: string,
  level: (typeof HeadingLevel)[keyof typeof HeadingLevel] = HeadingLevel.HEADING_2,
) {
  return new Paragraph({
    heading: level,
    children: [new TextRun({ text, color: "1F2937" })],
  });
}

export function bodyText(
  text: string,
  options?: { bold?: boolean; color?: string; size?: number },
) {
  return new Paragraph({
    children: [
      new TextRun({
        text,
        bold: options?.bold,
        color: options?.color ?? "374151",
        size: options?.size ?? 20,
      }),
    ],
    spacing: { after: 120 },
  });
}

export function spacer() {
  return new Paragraph({ spacing: { after: 200 }, children: [] });
}

export function scoreText(label: string, score: number, color: string) {
  return new Paragraph({
    children: [
      new TextRun({ text: `${label}: `, color: GRAY_600, size: 20 }),
      new TextRun({
        text: `${Math.round(score)}`,
        bold: true,
        color,
        size: 24,
      }),
      new TextRun({ text: `/100`, color: GRAY_600, size: 16 }),
    ],
    spacing: { after: 80 },
  });
}

export function simpleTable(headers: string[], rows: string[][]) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: TABLE_BORDER,
    rows: [
      new TableRow({
        tableHeader: true,
        children: headers.map(
          (h) =>
            new TableCell({
              shading: HEADER_SHADING,
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: h,
                      bold: true,
                      size: 18,
                      color: "1F2937",
                    }),
                  ],
                }),
              ],
            }),
        ),
      }),
      ...rows.map(
        (row) =>
          new TableRow({
            children: row.map(
              (cell) =>
                new TableCell({
                  children: [
                    new Paragraph({
                      children: [
                        new TextRun({ text: cell, size: 18, color: "374151" }),
                      ],
                    }),
                  ],
                }),
            ),
          }),
      ),
    ],
  });
}

export function bulletList(items: { text: string; detail?: string }[]) {
  return items.flatMap((item) => [
    new Paragraph({
      bullet: { level: 0 },
      children: [new TextRun({ text: item.text, bold: true, size: 20 })],
    }),
    ...(item.detail
      ? [
          new Paragraph({
            indent: { left: convertInchesToTwip(0.5) },
            children: [
              new TextRun({ text: item.detail, color: GRAY_600, size: 18 }),
            ],
            spacing: { after: 80 },
          }),
        ]
      : []),
  ]);
}
