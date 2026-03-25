import { ImportData, FileNode } from '../types';

const API_BASE = (window as any).__API_BASE__ || '';

function authHeaders() {
  const token = localStorage.getItem('mathsci-jwt');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function fetchWorkspace(): Promise<ImportData | null> {
  try {
    const res = await fetch(`${API_BASE}/api/workspace`, { headers: { ...authHeaders() } });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    return null;
  }
}

export async function replaceWorkspace(data: ImportData) {
  await fetch(`${API_BASE}/api/workspace`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(data)
  });
}

export async function listNodes(): Promise<FileNode[] | null> {
  try {
    const res = await fetch(`${API_BASE}/api/workspace/nodes`);
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    return null;
  }
}

export async function createNode(node: Partial<FileNode>) {
  const res = await fetch(`${API_BASE}/api/workspace/nodes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(node)
  });
  return res.ok ? await res.json() : null;
}

export async function updateNode(id: string, patch: Partial<FileNode>) {
  const res = await fetch(`${API_BASE}/api/workspace/nodes/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(patch)
  });
  return res.ok;
}

export async function moveNode(id: string, parentId: string | null) {
  const res = await fetch(`${API_BASE}/api/workspace/nodes/${id}/move`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ parentId })
  });
  return res.ok;
}

export async function deleteNode(id: string) {
  const res = await fetch(`${API_BASE}/api/workspace/nodes/${id}`, {
    method: 'DELETE',
    headers: { ...authHeaders() }
  });
  return res.ok;
}

export async function fetchMe() {
  try {
    const res = await fetch(`${API_BASE}/api/me`, { headers: { ...authHeaders() } });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    return null;
  }
}
