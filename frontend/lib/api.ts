const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8787";

export interface Tenant {
  id: number;
  name: string;
  room_number: string;
  password?: string;
  base_rent: number;
  electric_rate: number;
  advance_required: number;
  advance_amount: number;
  advance_paid: number;
  is_active: number;
  invoice_id?: number;
  rent_amount?: number;
  electric_amount?: number;
  other_total?: number;
  total_due?: number;
  amount_paid?: number;
  is_fully_paid?: number;
  last_reading?: number;
}

export interface Invoice {
  id: number;
  tenant_id: number;
  tenant_name?: string;
  room_number?: string;
  month_year: string;
  rent_amount: number;
  electric_amount: number;
  other_total: number;
  total_due: number;
  amount_paid: number;
  is_fully_paid: number;
  due_remaining?: number;
}

export interface OtherBill {
  id: number;
  tenant_id: number;
  name: string;
  amount: number;
  month_year: string;
  is_recurring: number;
}

export interface MeterReading {
  id: number;
  tenant_id: number;
  reading_value: number;
  previous_value: number;
  units: number;
  cost: number;
  image_key: string | null;
  month_year: string;
  created_at: string;
}

export interface LoginResult {
  type: "admin" | "tenant";
  tenant?: { id: number; name: string; room_number: string };
}

export interface TenantDashboard {
  tenant: Tenant;
  invoice: Invoice | null;
  otherBills: OtherBill[];
  lastReading: MeterReading | null;
  month: string;
  message?: string;
  grandTotalDue?: number;
}

export async function login(password: string): Promise<LoginResult> {
  const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error);
  return data;
}

export async function changeAdminPassword(
  old_password: string,
  new_password: string
): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/admin/password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ old_password, new_password }),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error);
}

export async function getAdminTenants(month?: string): Promise<Tenant[]> {
  const url = month
    ? `${API_BASE_URL}/api/admin/tenants?month=${encodeURIComponent(month)}`
    : `${API_BASE_URL}/api/admin/tenants`;
  const res = await fetch(url);
  const data = await res.json();
  if (!data.success) throw new Error(data.error);
  return data.data;
}

export async function createTenant(tenant: {
  name: string;
  room_number: string;
  password: string;
  base_rent?: number;
  electric_rate?: number;
  advance_required?: boolean;
  advance_amount?: number;
  water_bill?: number;
  waste_bill?: number;
  initial_reading?: number;
}): Promise<number> {
  const res = await fetch(`${API_BASE_URL}/api/admin/tenants`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(tenant),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error);
  return data.id;
}

export async function getTenantDetails(id: number, month?: string) {
  const url = month
    ? `${API_BASE_URL}/api/admin/tenants/${id}?month=${encodeURIComponent(month)}`
    : `${API_BASE_URL}/api/admin/tenants/${id}`;
  const res = await fetch(url);
  const data = await res.json();
  if (!data.success) throw new Error(data.error);
  return data.data;
}

export async function updateTenant(
  id: number,
  updates: {
    name?: string;
    room_number?: string;
    password?: string;
    base_rent?: number;
    electric_rate?: number;
    advance_required?: number;
    advance_amount?: number;
    advance_paid?: number;
    month_year?: string;
    create_new?: boolean;
  }
): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/admin/tenants/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error);
}

export async function deleteTenant(id: number): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/admin/tenants/${id}`, {
    method: "DELETE",
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error);
}

export async function addOtherBill(
  tenantId: number,
  name: string,
  amount: number,
  isRecurring = false,
  monthYear?: string
) {
  const res = await fetch(
    `${API_BASE_URL}/api/admin/tenants/${tenantId}/other-bill`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        amount,
        is_recurring: isRecurring,
        month_year: monthYear,
      }),
    }
  );
  const data = await res.json();
  if (!data.success) throw new Error(data.error);
  return data.invoice;
}

export async function updateOtherBill(
  billId: number,
  updates: { name?: string; amount?: number }
): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/admin/other-bills/${billId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error);
}

export async function deleteOtherBill(billId: number) {
  const res = await fetch(`${API_BASE_URL}/api/admin/other-bills/${billId}`, {
    method: "DELETE",
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error);
}

export async function recordPayment(
  invoiceId: number,
  amount?: number,
  markFull = false
) {
  const res = await fetch(
    `${API_BASE_URL}/api/admin/invoices/${invoiceId}/payment`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount, mark_full: markFull }),
    }
  );
  const data = await res.json();
  if (!data.success) throw new Error(data.error);
  return data;
}

export async function updateAdvance(tenantId: number, amountPaid: number) {
  const res = await fetch(
    `${API_BASE_URL}/api/admin/tenants/${tenantId}/advance`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount_paid: amountPaid }),
    }
  );
  const data = await res.json();
  if (!data.success) throw new Error(data.error);
  return data;
}

export async function getTenantDashboard(
  tenantId: number,
  month?: string
): Promise<TenantDashboard> {
  const url = month
    ? `${API_BASE_URL}/api/tenant/${tenantId}/dashboard?month=${encodeURIComponent(month)}`
    : `${API_BASE_URL}/api/tenant/${tenantId}/dashboard`;
  const res = await fetch(url);
  const data = await res.json();
  if (!data.success) throw new Error(data.error);
  return data.data;
}

export async function scanMeter(tenantId: number, image: Blob) {
  const formData = new FormData();
  formData.append("tenant_id", tenantId.toString());
  formData.append("image", image, "meter.jpg");

  const res = await fetch(`${API_BASE_URL}/api/scan-meter`, {
    method: "POST",
    body: formData,
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || "Scan failed");
  return data.data;
}

export async function recordManualReading(
  tenantId: number,
  reading: number,
  month: string
): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/admin/meter-readings/manual`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tenant_id: tenantId, reading, month }),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error);
}

export async function getTenantReadings(
  tenantId: number
): Promise<MeterReading[]> {
  const res = await fetch(`${API_BASE_URL}/api/tenant/${tenantId}/readings`);
  const data = await res.json();
  if (!data.success) throw new Error(data.error);
  return data.data;
}

export interface PublicBillRow {
  tenant_id: number;
  room_number: string;
  tenant_name: string;
  rent_amount?: number | null;
  electric_amount?: number | null;
  other_total?: number | null;
  total_due?: number | null;
  amount_paid?: number | null;
  is_fully_paid?: number | boolean | null;
  month_year?: string | null;
}

export interface PublicBillsResponse {
  success: boolean;
  data: PublicBillRow[];
  month: string;
}

export async function getPublicBills(month?: string): Promise<PublicBillsResponse> {
  const url = month
    ? `${API_BASE_URL}/api/public/bills?month=${encodeURIComponent(month)}`
    : `${API_BASE_URL}/api/public/bills`;
  const res = await fetch(url);
  const data = (await res.json()) as PublicBillsResponse & { error?: string };
  if (!data.success) throw new Error(data.error);
  return data;
}
