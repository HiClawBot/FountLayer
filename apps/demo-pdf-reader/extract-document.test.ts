import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

import {
  DocumentExtractionError,
  documentLimits,
  extractDocument,
  extractPdfText,
} from "./lib/extract-document";

describe("bounded document extraction", () => {
  it("normalizes a local text document", async () => {
    const result = await extractDocument(
      new File(["First line.  \n\n\nSecond line."], "notes.md", {
        type: "text/markdown",
      }),
    );

    expect(result).toMatchObject({
      characterCount: 25,
      fileName: "notes.md",
      kind: "text",
      text: "First line.\n\nSecond line.",
    });
  });

  it("extracts ordered PDF page text and ignores non-text content items", async () => {
    const pages = [
      {
        getTextContent: async () => ({
          items: [
            { str: "FountLayer PDF fixture", hasEOL: true },
            { type: "marked-content" },
            { str: "Page one", hasEOL: false },
          ],
        }),
      },
      {
        getTextContent: async () => ({
          items: [{ str: "Page two", hasEOL: false }],
        }),
      },
    ];
    const document = {
      numPages: pages.length,
      getPage: async (pageNumber: number) => pages[pageNumber - 1]!,
    };

    await expect(extractPdfText(document as never)).resolves.toBe(
      "FountLayer PDF fixture\nPage one\n\nPage two",
    );
  });

  it("extracts the committed PDF fixture with the real PDF.js parser", async () => {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const encoded = (
      await readFile(
        new URL("./fixtures/fountlayer-fixture.pdf.base64", import.meta.url),
        "utf8",
      )
    ).trim();
    const loadingTask = pdfjs.getDocument({
      data: new Uint8Array(Buffer.from(encoded, "base64")),
      useSystemFonts: true,
    });

    try {
      const document = await loadingTask.promise;

      await expect(extractPdfText(document)).resolves.toBe(
        "FountLayer PDF fixture\nBounded local extraction works.",
      );
    } finally {
      await loadingTask.destroy();
    }
  });

  it("rejects unsupported, oversized, overlong, and too-many-page inputs", async () => {
    await expect(
      extractDocument(
        new File(["binary"], "archive.zip", {
          type: "application/zip",
        }),
      ),
    ).rejects.toMatchObject({ code: "unsupported_document_type" });
    await expect(
      extractDocument(
        new File([new Uint8Array(documentLimits.maxBytes + 1)], "large.txt", {
          type: "text/plain",
        }),
      ),
    ).rejects.toMatchObject({ code: "document_too_large" });
    await expect(
      extractDocument(
        new File(["x".repeat(documentLimits.maxCharacters + 1)], "long.txt", {
          type: "text/plain",
        }),
      ),
    ).rejects.toMatchObject({ code: "document_too_long" });
    await expect(
      extractPdfText({
        numPages: documentLimits.maxPdfPages + 1,
        getPage: async () => {
          throw new Error("must not load pages");
        },
      } as never),
    ).rejects.toBeInstanceOf(DocumentExtractionError);
  });
});
