const TENANT_KEY = "housbilling_tenant";
const ADMIN_KEY = "housbilling_admin";

export interface StoredTenant {
  id: number;
  name: string;
  room_number: string;
}

export function setTenantSession(tenant: StoredTenant): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(TENANT_KEY, JSON.stringify(tenant));
  sessionStorage.removeItem(ADMIN_KEY);
}

export function setAdminSession(): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(ADMIN_KEY, "1");
  sessionStorage.removeItem(TENANT_KEY);
}

export function clearSession(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(TENANT_KEY);
  sessionStorage.removeItem(ADMIN_KEY);
}

export function getTenantSession(): StoredTenant | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(TENANT_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredTenant;
  } catch {
    return null;
  }
}

export function isAdminSession(): boolean {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem(ADMIN_KEY) === "1";
}
