import ExcelJS from "exceljs";
import type { FastifyReply } from "fastify";

export interface HojaExcel {
  nombre: string;
  columnas: { header: string; key: string; width?: number }[];
  filas: Record<string, unknown>[];
}

export async function generarExcel(hojas: HojaExcel[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  for (const hoja of hojas) {
    const sheet = workbook.addWorksheet(hoja.nombre);
    sheet.columns = hoja.columnas.map((c) => ({ header: c.header, key: c.key, width: c.width ?? 22 }));
    sheet.getRow(1).font = { bold: true };
    sheet.addRows(hoja.filas);
  }
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export function enviarExcel(reply: FastifyReply, buffer: Buffer, filename: string): void {
  const safeFilename = filename.replace(/[^\w.-]/g, "_");
  reply.header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  reply.header("Content-Disposition", `attachment; filename="${safeFilename}"`);
  reply.send(buffer);
}
