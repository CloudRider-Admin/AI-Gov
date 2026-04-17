/**
 * Extract plain text from uploaded documents (PDF, DOCX, TXT, MD).
 */

export async function extractDocumentText(
  buffer: Buffer,
  mimeType: string,
  fileName: string,
): Promise<string> {
  switch (mimeType) {
    case 'application/pdf':
      return extractPdfText(buffer);

    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      return extractDocxText(buffer);

    case 'text/plain':
    case 'text/markdown':
      return buffer.toString('utf-8');

    default:
      throw new Error(`Unsupported file type: ${mimeType} (${fileName})`);
  }
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  const { PDFParse } = await import('pdf-parse');
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  const result = await parser.getText();
  return result.text;
}

async function extractDocxText(buffer: Buffer): Promise<string> {
  const mammoth = await import('mammoth');
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}
