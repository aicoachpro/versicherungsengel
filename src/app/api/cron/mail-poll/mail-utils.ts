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

        if (partIsBase64) {
          try {
            body = Buffer.from(body.replace(/\s/g, ""), "base64").toString("utf-8");
          } catch {
            // Fallback: rohen Text verwenden
          }
        } else if (partIsQP) {
          body = decodeQuotedPrintable(body);
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

      if (isBase64) {
        try {
          body = Buffer.from(body.replace(/\s/g, ""), "base64").toString("utf-8");
        } catch {
          // Fallback
        }
      } else if (isQuotedPrintable) {
        body = decodeQuotedPrintable(body);
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

function decodeQuotedPrintable(str: string): string {
  return str
    .replace(/=\r?\n/g, "")
    .replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
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
