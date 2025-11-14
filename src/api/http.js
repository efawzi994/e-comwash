export const API_URL = "http://localhost:4173";

export async function get(path) {
  const r = await fetch(`${API_URL}${path}`);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function post(path, body) {
  const r = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
