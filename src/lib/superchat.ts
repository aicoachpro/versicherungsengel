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

export async function getContacts(limit = 50, offset = 0) {
  return superchatFetch(`/contacts?limit=${limit}&offset=${offset}`);
}

export async function getContact(contactId: string) {
  return superchatFetch(`/contacts/${contactId}`);
}

export async function getConversations(contactId: string) {
  return superchatFetch(`/contacts/${contactId}/conversations`);
}

export async function getMessages(conversationId: string) {
  return superchatFetch(`/conversations/${conversationId}/messages`);
}

export async function sendMessage(
  conversationId: string,
  text: string
) {
  return superchatFetch(`/messages`, {
    method: "POST",
    body: JSON.stringify({
      conversation_id: conversationId,
      body: { text },
    }),
  });
}

export async function createContact(data: {
  name: string;
  phone?: string;
  email?: string;
}) {
  return superchatFetch(`/contacts`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function searchContacts(query: string) {
  return superchatFetch(`/contacts?search=${encodeURIComponent(query)}`);
}
