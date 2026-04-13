const SUPERCHAT_BASE_URL = "https://api.superchat.com/v1.0";
const SUPERCHAT_API_KEY = process.env.SUPERCHAT_API_KEY || "";

async function superchatFetch(endpoint: string, options?: RequestInit) {
  const res = await fetch(`${SUPERCHAT_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      "x-api-key": SUPERCHAT_API_KEY,
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    const error = new Error(`Superchat API ${res.status}: ${body}`) as Error & { status: number };
    error.status = res.status;
    throw error;
  }

  return res.json();
}

export async function getContact(contactId: string) {
  return superchatFetch(`/contacts/${contactId}`);
}

export async function getConversations(contactId: string) {
  return superchatFetch(`/contacts/${contactId}/conversations`);
}

export async function getConversationMessages(conversationId: string) {
  // Paginiert ueber alle Seiten, damit wir den kompletten Verlauf erhalten
  const limit = 100;
  const all: Array<Record<string, unknown>> = [];
  let cursor: string | null = null;
  for (let page = 0; page < 20; page++) {
    const url: string = cursor
      ? `/conversations/${conversationId}/messages?limit=${limit}&after=${cursor}`
      : `/conversations/${conversationId}/messages?limit=${limit}`;
    const result = await superchatFetch(url);
    const messages = result?.results || result?.data || [];
    all.push(...messages);
    cursor = result?.pagination?.next_cursor || null;
    if (!cursor || messages.length < limit) break;
  }
  return all;
}

export async function createContact(data: {
  first_name?: string;
  last_name?: string;
  phone?: string;
  email?: string;
  custom_attributes?: Array<{ id: string; value: string | string[] }>;
  contact_list_ids?: string[];
}) {
  const handles: Array<{ type: string; value: string }> = [];
  if (data.phone) handles.push({ type: "phone", value: data.phone });
  if (data.email) handles.push({ type: "mail", value: data.email });

  const body: Record<string, unknown> = { handles };
  if (data.first_name) body.first_name = data.first_name;
  if (data.last_name) body.last_name = data.last_name;
  if (data.custom_attributes?.length) body.custom_attributes = data.custom_attributes;
  if (data.contact_list_ids?.length) body.contact_list_ids = data.contact_list_ids;

  return superchatFetch(`/contacts`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/**
 * Normalisiert eine Telefonnummer fuer den Vergleich:
 * - Entfernt alles ausser Ziffern
 * - Entfernt fuehrende Nullen
 * - Entfernt Laenderpraefix '49' (DE)
 * So werden '+49 172 7755335', '01727755335' und '491727755335' alle zu '1727755335'.
 */
function normalizePhoneForCompare(value: string): string {
  return value
    .replace(/\D/g, "")
    .replace(/^0+/, "")
    .replace(/^49/, "");
}

function normalizeEmailForCompare(value: string): string {
  return value.trim().toLowerCase();
}

function isPhoneHandle(value: string): boolean {
  return /^[\d\s+\-()]+$/.test(value);
}

export async function findContactByHandle(handle: string): Promise<{ id: string } | null> {
  // Superchat API hat keine Suchfunktion — Cursor-basiert paginieren
  const limit = 100;
  const maxPages = 30;
  const isPhone = isPhoneHandle(handle);
  const normalizedHandle = isPhone
    ? normalizePhoneForCompare(handle)
    : normalizeEmailForCompare(handle);

  let cursor: string | null = null;

  for (let page = 0; page < maxPages; page++) {
    const url = cursor
      ? `/contacts?limit=${limit}&after=${cursor}`
      : `/contacts?limit=${limit}`;
    const result = await superchatFetch(url);
    const contacts = result?.results || [];

    for (const contact of contacts) {
      const handles: Array<{ type: string; value: string }> = contact.handles || [];
      const match = handles.some((h) => {
        if (!h.value) return false;
        if (isPhone) {
          // Phone: Vergleich ueber normalisierte Ziffern (ohne +/Leerzeichen/Laenderpraefix)
          return normalizePhoneForCompare(h.value) === normalizedHandle;
        }
        return normalizeEmailForCompare(h.value) === normalizedHandle;
      });
      if (match) return contact;
    }

    cursor = result?.pagination?.next_cursor || null;
    if (!cursor || contacts.length < limit) return null;
  }

  return null;
}

export async function getCustomAttributes() {
  return superchatFetch(`/custom-attributes`);
}

export async function sendTemplateMessage(params: {
  phone: string;
  channelId: string;
  templateId: string;
  variables: Array<{ position: number; value: string }>;
}) {
  return superchatFetch(`/messages`, {
    method: "POST",
    body: JSON.stringify({
      to: [{ identifier: params.phone }],
      from: { channel_id: params.channelId },
      content: {
        type: "whats_app_template",
        template_id: params.templateId,
        variables: params.variables,
      },
    }),
  });
}

export async function updateContact(
  contactId: string,
  data: {
    first_name?: string;
    last_name?: string;
    phone?: string;
    email?: string;
    custom_attributes?: Array<{ id: string; value: string | string[] }>;
    contact_list_ids?: string[];
  }
) {
  const body: Record<string, unknown> = {};
  if (data.first_name !== undefined) body.first_name = data.first_name;
  if (data.last_name !== undefined) body.last_name = data.last_name;
  if (data.custom_attributes?.length) body.custom_attributes = data.custom_attributes;
  if (data.contact_list_ids?.length) body.contact_list_ids = data.contact_list_ids;

  const handles: Array<{ type: string; value: string }> = [];
  if (data.phone) handles.push({ type: "phone", value: data.phone });
  if (data.email) handles.push({ type: "mail", value: data.email });
  if (handles.length) body.handles = handles;

  return superchatFetch(`/contacts/${contactId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}
