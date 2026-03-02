import { randomUUID } from "crypto";

export interface McpServerEntry {
  id: string;
  name?: string;
  url?: string;
  transport?: "stdio" | "http";
  tools?: { name: string; description?: string }[];
  updated_at: number;
}

const store = new Map<string, McpServerEntry>();

export function listServers(): McpServerEntry[] {
  return Array.from(store.values()).sort((a, b) => b.updated_at - a.updated_at);
}

export function getServer(id: string): McpServerEntry | undefined {
  return store.get(id);
}

export function addServer(entry: Omit<McpServerEntry, "id" | "updated_at">): string {
  const id = randomUUID().slice(0, 12);
  store.set(id, {
    ...entry,
    id,
    updated_at: Date.now(),
  });
  return id;
}

export function deleteServer(id: string): boolean {
  return store.delete(id);
}

export function getServerTools(id: string): { name: string; description?: string }[] {
  const s = store.get(id);
  return s?.tools ?? [];
}
