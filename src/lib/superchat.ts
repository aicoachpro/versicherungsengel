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

export async function createContact(data: {
  first_name?: string;
  last_name?: string;
  phone?: string;
  email?: string;
  custom_attributes?: Array<{ id: string; value: string | string[] }>;
}) {
  const handles: Array<{ type: string; value: string }> = [];
  if (data.phone) handles.push({ type: "phone", value: data.phone });
  if (data.email) handles.push({ type: "mail", value: data.email });

  const body: Record<string, unknown> = { handles };
  if (data.first_name) body.first_name = data.first_name;
  if (data.last_name) body.last_name = data.last_name;
  if (data.custom_attributes?.length) body.custom_attributes = data.custom_attributes;

  return superchatFetch(`/contacts`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function findContactByHandle(handle: string): Promise<{ id: string } | null> {
  // Superchat API hat keine Suchfunktion — Cursor-basiert paginieren, max 10 Seiten
  const limit = 100;
  const maxPages = 10;
  const normalizedHandle = handle.replace(/[^0-9a-zA-Z@.+]/g, "").toLowerCase();
  let cursor: string | null = null;

  for (let page = 0; page < maxPages; page++) {
    const url = cursor
      ? `/contacts?limit=${limit}&after=${cursor}`
      : `/contacts?limit=${limit}`;
    const result = await superchatFetch(url);
    const contacts = result?.results || [];

    for (const contact of contacts) {
      const handles: Array<{ type: string; value: string }> = contact.handles || [];
      const match = handles.some((h) =>
        h.value.replace(/[^0-9a-zA-Z@.+]/g, "").toLowerCase() === normalizedHandle
      );
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

export async function updateContact(
  contactId: string,
  data: {
    first_name?: string;
    last_name?: string;
    phone?: string;
    email?: string;
    custom_attributes?: Array<{ id: string; value: string | string[] }>;
  }
) {
  const body: Record<string, unknown> = {};
  if (data.first_name !== undefined) body.first_name = data.first_name;
  if (data.last_name !== undefined) body.last_name = data.last_name;
  if (data.custom_attributes?.length) body.custom_attributes = data.custom_attributes;

  const handles: Array<{ type: string; value: string }> = [];
  if (data.phone) handles.push({ type: "phone", value: data.phone });
  if (data.email) handles.push({ type: "mail", value: data.email });
  if (handles.length) body.handles = handles;

  return superchatFetch(`/contacts/${contactId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}
