import type {
  PDFDocumentProxy,
  TextItem,
} from "pdfjs-dist/types/src/display/api";

export const documentLimits = {
  maxBytes: 10 * 1024 * 1024,
  maxCharacters: 80_000,
  maxPdfPages: 40,
} as const;

export type ExtractedDocument = {
  characterCount: number;
  fileName: string;
  kind: "pdf" | "text";
  pageCount?: number;
  text: string;
};

export class DocumentExtractionError extends Error {
  constructor(
    public readonly code:
      | "document_empty"
      | "document_too_large"
      | "document_too_long"
      | "pdf_too_many_pages"
      | "pdf_unreadable"
      | "unsupported_document_type",
    message: string,
  ) {
    super(message);
    this.name = "DocumentExtractionError";
  }
}

function normalizeExtractedText(value: string): string {
  return value
    .replaceAll("\u0000", "")
    .replace(/[\t ]+\n/gu, "\n")
    .replace(/\n{3,}/gu, "\n\n")
    .trim();
}

function assertTextWithinLimits(text: string): string {
  const normalized = normalizeExtractedText(text);

  if (!normalized) {
    throw new DocumentExtractionError(
      "document_empty",
      "The document does not contain extractable text.",
    );
  }

  if (normalized.length > documentLimits.maxCharacters) {
    throw new DocumentExtractionError(
      "document_too_long",
      `Extracted text exceeds ${documentLimits.maxCharacters.toLocaleString()} characters. Split the document before summarizing.`,
    );
  }

  return normalized;
}

function isTextItem(value: unknown): value is TextItem {
  return (
    typeof value === "object" &&
    value !== null &&
    "str" in value &&
    typeof value.str === "string"
  );
}

export async function extractPdfText(
  document: Pick<PDFDocumentProxy, "getPage" | "numPages">,
): Promise<string> {
  if (document.numPages > documentLimits.maxPdfPages) {
    throw new DocumentExtractionError(
      "pdf_too_many_pages",
      `PDF has ${document.numPages} pages; the beta limit is ${documentLimits.maxPdfPages}.`,
    );
  }

  const pages: string[] = [];
  let characterCount = 0;

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    const fragments: string[] = [];

    for (const item of content.items) {
      if (!isTextItem(item)) {
        continue;
      }

      fragments.push(item.str, item.hasEOL ? "\n" : " ");
    }

    const pageText = normalizeExtractedText(fragments.join(""));
    characterCount += pageText.length;

    if (characterCount > documentLimits.maxCharacters) {
      throw new DocumentExtractionError(
        "document_too_long",
        `Extracted text exceeds ${documentLimits.maxCharacters.toLocaleString()} characters. Split the PDF before summarizing.`,
      );
    }

    if (pageText) {
      pages.push(pageText);
    }
  }

  return assertTextWithinLimits(pages.join("\n\n"));
}

async function extractPdf(file: File): Promise<ExtractedDocument> {
  let loadingTask:
    | ReturnType<(typeof import("pdfjs-dist"))["getDocument"]>
    | undefined;
  let document: PDFDocumentProxy | undefined;

  try {
    const pdfjs = await import("pdfjs-dist");

    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url,
    ).toString();
    loadingTask = pdfjs.getDocument({
      data: new Uint8Array(await file.arrayBuffer()),
      useSystemFonts: true,
    });
    document = await loadingTask.promise;
    const text = await extractPdfText(document);

    return {
      characterCount: text.length,
      fileName: file.name,
      kind: "pdf",
      pageCount: document.numPages,
      text,
    };
  } catch (error) {
    if (error instanceof DocumentExtractionError) {
      throw error;
    }

    throw new DocumentExtractionError(
      "pdf_unreadable",
      "The PDF could not be read. It may be encrypted, damaged, or image-only.",
    );
  } finally {
    await loadingTask?.destroy();
  }
}

export async function extractDocument(file: File): Promise<ExtractedDocument> {
  if (file.size === 0) {
    throw new DocumentExtractionError(
      "document_empty",
      "Choose a non-empty document.",
    );
  }

  if (file.size > documentLimits.maxBytes) {
    throw new DocumentExtractionError(
      "document_too_large",
      `Document exceeds the ${documentLimits.maxBytes / 1024 / 1024} MB beta limit.`,
    );
  }

  const extension = file.name.toLowerCase().split(".").pop();
  const isPdf = file.type === "application/pdf" || extension === "pdf";

  if (isPdf) {
    return extractPdf(file);
  }

  const isText =
    ["md", "txt"].includes(extension ?? "") ||
    ["text/markdown", "text/plain"].includes(file.type);

  if (!isText) {
    throw new DocumentExtractionError(
      "unsupported_document_type",
      "Choose a PDF, Markdown, or plain-text document.",
    );
  }

  const text = assertTextWithinLimits(await file.text());

  return {
    characterCount: text.length,
    fileName: file.name,
    kind: "text",
    text,
  };
}
