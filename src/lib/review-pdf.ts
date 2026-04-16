import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { AttendanceScan, ReviewFilters } from "@/lib/kiosk-types";
import { formatScanTimeCentralOnly } from "@/lib/kiosk-utils";

const PAGE_W = 792;
const PAGE_H = 612;
const MARGIN = 40;
const HEADER_BAND_H = 92;
const TABLE_FONT = 7.2;
const TABLE_HEADER_FONT = 8;
const ROW_H = 15;
const HEADER_ROW_H = 20;
const BOTTOM_SAFE = 44;
const LOGO_PATH = path.join(process.cwd(), "public", "ibadge-full.png");

const COLS = [
  { w: 86, label: "Scan time", maxChars: 18 },
  { w: 58, label: "Badge", maxChars: 12 },
  { w: 122, label: "Employee", maxChars: 28 },
  { w: 150, label: "Email", maxChars: 34 },
  { w: 70, label: "Company#", maxChars: 12 },
  { w: 110, label: "Event", maxChars: 24 },
  { w: 116, label: "Device", maxChars: 25 },
] as const;

function formatCalendarDate(iso: string) {
  if (!iso) {
    return "";
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return iso;
  }
  return d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

function buildReportPeriodLine(filters: ReviewFilters): string {
  const from = filters.dateFrom?.trim();
  const to = filters.dateTo?.trim();
  if (from && to) {
    return `${formatCalendarDate(from)} - ${formatCalendarDate(to)}`;
  }
  if (from) {
    return `From ${formatCalendarDate(from)}`;
  }
  if (to) {
    return `Through ${formatCalendarDate(to)}`;
  }
  return "All dates";
}

function truncateCell(text: string, maxChars: number) {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= maxChars) {
    return t;
  }
  return `${t.slice(0, Math.max(0, maxChars - 3))}...`;
}

function colXs() {
  let x = MARGIN;
  const xs: number[] = [];
  for (const c of COLS) {
    xs.push(x);
    x += c.w;
  }
  return xs;
}

export async function buildReviewPdfBuffer(args: {
  eventDisplayName: string;
  filters: ReviewFilters;
  scans: AttendanceScan[];
}): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const logoBytes = existsSync(LOGO_PATH) ? readFileSync(LOGO_PATH) : null;
  const logo = logoBytes ? await pdfDoc.embedPng(logoBytes) : null;
  const periodLine = buildReportPeriodLine(args.filters);
  const generated = new Date();
  const generatedText = `Generated: ${generated.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })} | Scan times: US Central`;
  const xs = colXs();
  const tableRight = MARGIN + COLS.reduce((s, c) => s + c.w, 0);

  let page = pdfDoc.addPage([PAGE_W, PAGE_H]);
  let pageNum = 1;

  const drawHeaderBand = () => {
    page.drawRectangle({
      x: 0,
      y: PAGE_H - HEADER_BAND_H,
      width: PAGE_W,
      height: HEADER_BAND_H,
      color: rgb(0.09, 0.16, 0.28),
    });

    if (logo) {
      const maxLogoWidth = 180;
      const maxLogoHeight = HEADER_BAND_H - 24;
      const scale = Math.min(maxLogoWidth / logo.width, maxLogoHeight / logo.height);
      const scaled = logo.scale(scale);
      page.drawImage(logo, {
        x: PAGE_W - MARGIN - scaled.width,
        y: PAGE_H - HEADER_BAND_H + (HEADER_BAND_H - scaled.height) / 2,
        width: scaled.width,
        height: scaled.height,
      });
    }

    page.drawText("Attendance report", {
      x: MARGIN,
      y: PAGE_H - 26,
      size: 9,
      font: fontBold,
      color: rgb(0.55, 0.78, 0.95),
    });
    page.drawText(`Event: ${args.eventDisplayName}`, {
      x: MARGIN,
      y: PAGE_H - 48,
      size: 15,
      font: fontBold,
      color: rgb(1, 1, 1),
    });
    page.drawText(`Report period: ${periodLine}`, {
      x: MARGIN,
      y: PAGE_H - 68,
      size: 10.5,
      font,
      color: rgb(0.88, 0.92, 0.98),
    });
  };

  const drawFooter = () => {
    page.drawText(`Page ${pageNum}`, {
      x: MARGIN,
      y: 24,
      size: 8,
      font,
      color: rgb(0.45, 0.48, 0.52),
    });
  };

  const drawTableHeaderRow = (yTop: number) => {
    const yBottom = yTop - HEADER_ROW_H;
    page.drawRectangle({
      x: MARGIN,
      y: yBottom,
      width: tableRight - MARGIN,
      height: HEADER_ROW_H,
      color: rgb(0.91, 0.93, 0.96),
      borderColor: rgb(0.72, 0.76, 0.82),
      borderWidth: 0.6,
    });
    page.drawLine({
      start: { x: MARGIN, y: yTop },
      end: { x: tableRight, y: yTop },
      thickness: 0.8,
      color: rgb(0.55, 0.6, 0.68),
    });
    COLS.forEach((col, i) => {
      page.drawText(col.label, {
        x: xs[i] + 3,
        y: yBottom + 6,
        size: TABLE_HEADER_FONT,
        font: fontBold,
        color: rgb(0.18, 0.22, 0.3),
      });
    });
    page.drawLine({
      start: { x: MARGIN, y: yBottom },
      end: { x: tableRight, y: yBottom },
      thickness: 0.6,
      color: rgb(0.72, 0.76, 0.82),
    });
  };

  const drawRowLines = (yTop: number, yBottom: number) => {
    page.drawLine({
      start: { x: MARGIN, y: yTop },
      end: { x: tableRight, y: yTop },
      thickness: 0.35,
      color: rgb(0.88, 0.9, 0.93),
    });
    for (let i = 1; i < xs.length; i += 1) {
      page.drawLine({
        start: { x: xs[i], y: yTop },
        end: { x: xs[i], y: yBottom },
        thickness: 0.35,
        color: rgb(0.88, 0.9, 0.93),
      });
    }
    page.drawLine({
      start: { x: MARGIN, y: yBottom },
      end: { x: tableRight, y: yBottom },
      thickness: 0.35,
      color: rgb(0.88, 0.9, 0.93),
    });
    page.drawLine({
      start: { x: MARGIN, y: yTop },
      end: { x: MARGIN, y: yBottom },
      thickness: 0.35,
      color: rgb(0.88, 0.9, 0.93),
    });
    page.drawLine({
      start: { x: tableRight, y: yTop },
      end: { x: tableRight, y: yBottom },
      thickness: 0.35,
      color: rgb(0.88, 0.9, 0.93),
    });
  };

  const startNewPage = () => {
    pageNum += 1;
    page = pdfDoc.addPage([PAGE_W, PAGE_H]);
    drawHeaderBand();
    page.drawText(generatedText, {
      x: MARGIN,
      y: PAGE_H - HEADER_BAND_H - 18,
      size: 9,
      font,
      color: rgb(0.38, 0.42, 0.48),
    });
    page.drawText("(continued)", {
      x: tableRight - 64,
      y: PAGE_H - HEADER_BAND_H - 18,
      size: 9,
      font,
      color: rgb(0.38, 0.42, 0.48),
    });
    return PAGE_H - HEADER_BAND_H - 42;
  };

  drawHeaderBand();
  page.drawText(generatedText, {
    x: MARGIN,
    y: PAGE_H - HEADER_BAND_H - 18,
    size: 9,
    font,
    color: rgb(0.38, 0.42, 0.48),
  });

  let y = PAGE_H - HEADER_BAND_H - 42;

  if (args.scans.length === 0) {
    page.drawText("No attendance records match the current filters.", {
      x: MARGIN,
      y: y - 8,
      size: 11,
      font,
      color: rgb(0.35, 0.38, 0.42),
    });
    drawFooter();
    return Buffer.from(await pdfDoc.save());
  }

  drawTableHeaderRow(y);
  y -= HEADER_ROW_H;

  let rowIndex = 0;
  let i = 0;
  while (i < args.scans.length) {
    const scan = args.scans[i];
    const rowTop = y;
    const rowBottom = y - ROW_H;

    if (rowBottom < BOTTOM_SAFE) {
      drawFooter();
      y = startNewPage();
      drawTableHeaderRow(y);
      y -= HEADER_ROW_H;
      continue;
    }

    const cells = [
      formatScanTimeCentralOnly(scan.ScanUTC) || "-",
      scan.BadgeNumberRaw,
      scan.EmployeeNameSnapshot ?? "-",
      scan.Email ?? "-",
      scan.CompanyNum ?? "-",
      scan.EventNameSnapshot ?? "-",
      scan.DeviceDisplayName ?? "-",
    ];

    if (rowIndex % 2 === 1) {
      page.drawRectangle({
        x: MARGIN,
        y: rowBottom,
        width: tableRight - MARGIN,
        height: ROW_H,
        color: rgb(0.97, 0.98, 0.99),
      });
    }

    drawRowLines(rowTop, rowBottom);

    cells.forEach((cell, j) => {
      const col = COLS[j];
      page.drawText(truncateCell(cell, col.maxChars), {
        x: xs[j] + 3,
        y: rowBottom + 4,
        size: TABLE_FONT,
        font,
        color: rgb(0.12, 0.14, 0.18),
      });
    });

    y = rowBottom;
    rowIndex += 1;
    i += 1;
  }

  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: tableRight, y },
    thickness: 0.8,
    color: rgb(0.55, 0.6, 0.68),
  });

  drawFooter();
  return Buffer.from(await pdfDoc.save());
}
