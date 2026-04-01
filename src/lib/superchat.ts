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
    throw new Error(`Superchat API ${res.status}: ${body}`);
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
