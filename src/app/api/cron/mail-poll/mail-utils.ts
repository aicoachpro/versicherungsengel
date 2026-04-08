/**
 * Einfache Text-/HTML-Extraktion aus einer E-Mail-Source.
 * Für komplexere MIME-Parsing könnte man mailparser verwenden,
 * aber für die meisten E-Mails reicht diese Lösung.
 */

export function extractTextFromSource(source: string): { text: string; html: string } {
  let text = "";
  let html = "";

  // Content-Transfer-Encoding erkennen
  const isBase64 = /Content-Transfer-Encoding:\s*base64/i.test(source);
  const isQuotedPrintable = /Content-Transfer-Encoding:\s*quoted-printable/i.test(source);

  // Multipart Boundary finden
  const boundaryMatch = source.match(/boundary="?([^"\s;]+)"?/i);

  if (boundaryMatch) {
    const boundary = boundaryMatch[1];
    const parts = source.split(`--${boundary}`);

    for (const part of parts) {
      const isTextPlain = /Content-Type:\s*text\/plain/i.test(part);
      const isTextHtml = /Content-Type:\s*text\/html/i.test(part);

      if (isTextPlain || isTextHtml) {
        // Body nach doppeltem Newline extrahieren
        const bodyStart = part.indexOf("\r\n\r\n");
        if (bodyStart === -1) continue;
        let body = part.substring(bodyStart + 4).trim();

        // Encoding dekodieren
        const partIsBase64 = /Content-Transfer-Encoding:\s*base64/i.test(part);
        const partIsQP = /Content-Transfer-Encoding:\s*quoted-printable/i.test(part);
        const charset = detectCharset(part);

        if (partIsBase64) {
          try {
            const buf = Buffer.from(body.replace(/\s/g, ""), "base64");
            body = decodeBuffer(buf, charset);
          } catch {
            // Fallback: rohen Text verwenden
          }
        } else if (partIsQP) {
          body = decodeQuotedPrintable(body, charset);
        }

        // Boundary-Ende entfernen
        body = body.replace(/--$/, "").trim();

        if (isTextPlain && !text) text = body;
        if (isTextHtml && !html) html = body;
      }
    }
  } else {
    // Kein Multipart — einzelner Body
    const bodyStart = source.indexOf("\r\n\r\n");
    if (bodyStart !== -1) {
      let body = source.substring(bodyStart + 4).trim();
      const charset = detectCharset(source);

      if (isBase64) {
        try {
          const buf = Buffer.from(body.replace(/\s/g, ""), "base64");
          body = decodeBuffer(buf, charset);
        } catch {
          // Fallback
        }
      } else if (isQuotedPrintable) {
        body = decodeQuotedPrintable(body, charset);
      }

      const isHtml = /Content-Type:\s*text\/html/i.test(source);
      if (isHtml) {
        html = body;
        text = stripHtml(body);
      } else {
        text = body;
      }
    }
  }

  // Fallback: HTML zu Text konvertieren wenn kein plain text
  if (!text && html) {
    text = stripHtml(html);
  }

  return { text, html };
}

function detectCharset(headers: string): string {
  const match = headers.match(/charset="?([^"\s;]+)"?/i);
  return match ? match[1].toLowerCase().replace(/^us-/, "") : "utf-8";
}

function decodeBuffer(buf: Buffer, charset: string): string {
  // Node.js TextDecoder unterstützt gängige Charsets
  try {
    const decoder = new TextDecoder(charset);
    return decoder.decode(buf);
  } catch {
    // Unbekanntes Charset → UTF-8 Fallback
    return buf.toString("utf-8");
  }
}

function decodeQuotedPrintable(str: string, charset = "utf-8"): string {
  // Soft line breaks entfernen
  const cleaned = str.replace(/=\r?\n/g, "");
  // Hex-Bytes in Buffer sammeln und mit richtigem Charset dekodieren
  const bytes: number[] = [];
  let i = 0;
  while (i < cleaned.length) {
    if (cleaned[i] === "=" && i + 2 < cleaned.length) {
      const hex = cleaned.substring(i + 1, i + 3);
      if (/^[0-9A-Fa-f]{2}$/.test(hex)) {
        bytes.push(parseInt(hex, 16));
        i += 3;
        continue;
      }
    }
    bytes.push(cleaned.charCodeAt(i));
    i++;
  }
  return decodeBuffer(Buffer.from(bytes), charset);
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
