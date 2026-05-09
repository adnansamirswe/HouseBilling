import { Hono } from 'hono';
import { cors } from 'hono/cors';

// Type definitions
type Bindings = {
	DB: D1Database;
	BUCKET: R2Bucket;
	AI: Ai;
};

interface Tenant {
	id: number;
	name: string;
	room_number: string;
	password: string;
	base_rent: number;
	electric_rate: number;
	advance_required: number;
	advance_amount: number;
	advance_paid: number;
	is_active: number;
	start_month: string | null;
	created_at: string;
}

interface Invoice {
	id: number;
	tenant_id: number;
	tenant_name: string | null;
	room_number: string | null;
	month_year: string;
	rent_amount: number;
	electric_amount: number;
	other_total: number;
	total_due: number;
	amount_paid: number;
	is_fully_paid: number;
}

interface OtherBill {
	id: number;
	tenant_id: number;
	name: string;
	amount: number;
	month_year: string;
	is_recurring: number;
}

interface MeterReading {
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

const app = new Hono<{ Bindings: Bindings }>();

// CORS
app.use('*', cors({
	origin: '*',
	allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
	allowHeaders: ['Content-Type'],
}));

// Health check
app.get('/', (c) => c.json({ status: 'ok', app: 'HousBilling API v2' }));

// Helper: Get current month-year
function getCurrentMonthYear(): string {
	const now = new Date();
	const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	return `${months[now.getMonth()]}-${now.getFullYear()}`;
}

// Helper: Check if month1 is before month2 (format: "Jan-2026")
function isMonthBefore(month1: string, month2: string): boolean {
	const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	const [m1, y1] = month1.split('-');
	const [m2, y2] = month2.split('-');
	const date1 = new Date(parseInt(y1), months.indexOf(m1), 1);
	const date2 = new Date(parseInt(y2), months.indexOf(m2), 1);
	return date1 < date2;
}

// Helper: Calculate and update invoice
async function updateInvoice(db: D1Database, tenantId: number, monthYear: string): Promise<Invoice> {
	const tenant = await db.prepare('SELECT * FROM tenants WHERE id = ?').bind(tenantId).first<Tenant>();
	if (!tenant) throw new Error('Tenant not found');

	// Get electric amount from meter reading
	const reading = await db.prepare(
		'SELECT cost FROM meter_readings WHERE tenant_id = ? AND month_year = ? ORDER BY created_at DESC LIMIT 1'
	).bind(tenantId, monthYear).first<{ cost: number }>();
	const electricAmount = reading?.cost || 0;

	// Get other bills total
	const { results: bills } = await db.prepare(
		'SELECT SUM(amount) as total FROM other_bills WHERE tenant_id = ? AND month_year = ?'
	).bind(tenantId, monthYear).all();
	const otherTotal = (bills[0] as any)?.total || 0;

	const totalDue = tenant.base_rent + electricAmount + otherTotal;

	// Find or create invoice
	let invoice = await db.prepare(
		'SELECT * FROM invoices WHERE tenant_id = ? AND month_year = ?'
	).bind(tenantId, monthYear).first<Invoice>();

	if (invoice) {
		await db.prepare(`
			UPDATE invoices 
			SET tenant_name = ?, room_number = ?, rent_amount = ?, electric_amount = ?, other_total = ?, total_due = ?, 
			    is_fully_paid = CASE WHEN amount_paid >= ? THEN 1 ELSE 0 END,
			    updated_at = datetime('now')
			WHERE id = ?
		`).bind(tenant.name, tenant.room_number, tenant.base_rent, electricAmount, otherTotal, totalDue, totalDue, invoice.id).run();

		invoice.tenant_name = tenant.name;
		invoice.room_number = tenant.room_number;
		invoice.rent_amount = tenant.base_rent;
		invoice.electric_amount = electricAmount;
		invoice.other_total = otherTotal;
		invoice.total_due = totalDue;
	} else {
		const result = await db.prepare(`
			INSERT INTO invoices (tenant_id, tenant_name, room_number, month_year, rent_amount, electric_amount, other_total, total_due)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		`).bind(tenantId, tenant.name, tenant.room_number, monthYear, tenant.base_rent, electricAmount, otherTotal, totalDue).run();

		invoice = {
			id: result.meta.last_row_id as number,
			tenant_id: tenantId,
			tenant_name: tenant.name,
			room_number: tenant.room_number,
			month_year: monthYear,
			rent_amount: tenant.base_rent,
			electric_amount: electricAmount,
			other_total: otherTotal,
			total_due: totalDue,
			amount_paid: 0,
			is_fully_paid: 0
		};
	}

	return invoice;
}

// Helper: Ensure invoice exists and copy recurring bills from previous month if newly created
async function ensureInvoiceExists(db: D1Database, tenantId: number, monthYear: string): Promise<Invoice> {
	let invoice = await db.prepare('SELECT * FROM invoices WHERE tenant_id = ? AND month_year = ?').bind(tenantId, monthYear).first<Invoice>();
	if (!invoice) {
		// Copy recurring bills from the most recent month they existed
		const lastBillMonth = await db.prepare(`
			SELECT month_year FROM other_bills 
			WHERE tenant_id = ? AND is_recurring = 1 
			ORDER BY id DESC LIMIT 1
		`).bind(tenantId).first<{ month_year: string }>();

		if (lastBillMonth) {
			const { results: recurringBills } = await db.prepare(
				'SELECT name, amount FROM other_bills WHERE tenant_id = ? AND month_year = ? AND is_recurring = 1'
			).bind(tenantId, lastBillMonth.month_year).all<{ name: string, amount: number }>();

			for (const bill of recurringBills) {
				const billExists = await db.prepare(
					'SELECT 1 FROM other_bills WHERE tenant_id = ? AND month_year = ? AND name = ?'
				).bind(tenantId, monthYear, bill.name).first();
				if (!billExists) {
					await db.prepare(`
						INSERT INTO other_bills (tenant_id, name, amount, month_year, is_recurring)
						VALUES (?, ?, ?, ?, 1)
					`).bind(tenantId, bill.name, bill.amount, monthYear).run();
				}
			}
		}
		invoice = await updateInvoice(db, tenantId, monthYear);
	}
	return invoice;
}

async function autoGenerateInvoices(db: D1Database, monthYear: string) {
	const activeTenants = await db.prepare('SELECT id, start_month FROM tenants WHERE is_active = 1').all<{ id: number, start_month: string }>();
	for (const t of activeTenants.results) {
		if (t.start_month && isMonthBefore(monthYear, t.start_month)) continue;
		await ensureInvoiceExists(db, t.id, monthYear);
	}
}

// ============================================
// AUTH ENDPOINTS
// ============================================

app.post('/api/auth/login', async (c) => {
	try {
		const { password } = await c.req.json<{ password: string }>();

		if (!password) {
			return c.json({ success: false, error: 'Password required' }, 400);
		}

		// Check admin password
		const admin = await c.env.DB.prepare('SELECT * FROM admin WHERE id = 1').first<{ password: string }>();
		if (admin && admin.password === password) {
			return c.json({
				success: true,
				type: 'admin',
				message: 'Admin login successful'
			});
		}

		// Check tenant password
		const tenant = await c.env.DB.prepare(
			'SELECT id, name, room_number FROM tenants WHERE password = ? AND is_active = 1'
		).bind(password).first<Tenant>();

		if (tenant) {
			return c.json({
				success: true,
				type: 'tenant',
				tenant: {
					id: tenant.id,
					name: tenant.name,
					room_number: tenant.room_number
				}
			});
		}

		return c.json({ success: false, error: 'Invalid password' }, 401);
	} catch (error) {
		console.error('Login error:', error);
		return c.json({ success: false, error: 'Login failed' }, 500);
	}
});

// ============================================
// PUBLIC ENDPOINTS
// ============================================

// List all bills for a month (Simplified overview)
app.get('/api/public/bills', async (c) => {
	try {
		const monthYear = c.req.query('month') || getCurrentMonthYear();

		const { results: bills } = await c.env.DB.prepare(`
			SELECT t.id as tenant_id, t.room_number, t.name as tenant_name,
			       i.rent_amount, i.electric_amount, i.other_total,
			       i.total_due, i.amount_paid, i.is_fully_paid, i.month_year
			FROM tenants t
			LEFT JOIN invoices i ON t.id = i.tenant_id AND i.month_year = ?
			WHERE t.is_active = 1
			ORDER BY t.room_number
		`).bind(monthYear).all();

		const data = (bills as Record<string, unknown>[]).map((r) => ({
			tenant_id: Number(r.tenant_id),
			room_number: r.room_number,
			tenant_name: r.tenant_name,
			rent_amount:
				r.rent_amount != null && r.rent_amount !== ''
					? Number(r.rent_amount)
					: null,
			electric_amount:
				r.electric_amount != null && r.electric_amount !== ''
					? Number(r.electric_amount)
					: null,
			other_total:
				r.other_total != null && r.other_total !== ''
					? Number(r.other_total)
					: null,
			total_due:
				r.total_due != null && r.total_due !== '' ? Number(r.total_due) : null,
			amount_paid:
				r.amount_paid != null && r.amount_paid !== ''
					? Number(r.amount_paid)
					: null,
			is_fully_paid: r.is_fully_paid != null ? Number(r.is_fully_paid) : null,
			month_year: r.month_year ?? null,
		}));

		return c.json({ success: true, data, month: monthYear });
	} catch (error) {
		console.error('Error fetching public bills:', error);
		return c.json({ success: false, error: 'Failed to fetch bills' }, 500);
	}
});

// ============================================
// ADMIN ENDPOINTS
// ============================================

// List all tenants
app.get('/api/admin/tenants', async (c) => {
	try {
		const monthYear = c.req.query('month') || getCurrentMonthYear();

		await autoGenerateInvoices(c.env.DB, monthYear);

		const { results: tenants } = await c.env.DB.prepare(`
			SELECT t.*, 
			       i.id as invoice_id, i.rent_amount, i.electric_amount, i.other_total, 
			       i.total_due, i.amount_paid, i.is_fully_paid,
			       (SELECT reading_value FROM meter_readings WHERE tenant_id = t.id ORDER BY created_at DESC LIMIT 1) as last_reading
			FROM tenants t
			LEFT JOIN invoices i ON t.id = i.tenant_id AND i.month_year = ?
			WHERE t.is_active = 1
			ORDER BY t.room_number
		`).bind(monthYear).all();

		return c.json({ success: true, data: tenants, month: monthYear });
	} catch (error) {
		console.error('Error fetching tenants:', error);
		return c.json({ success: false, error: 'Failed to fetch tenants' }, 500);
	}
});

// Create new tenant
app.post('/api/admin/tenants', async (c) => {
	let body: any;
	try {
		body = await c.req.json<{
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
		}>();

		if (!body.name || !body.room_number || !body.password) {
			return c.json({ success: false, error: 'Name, room number, and password required' }, 400);
		}

		const monthYear = getCurrentMonthYear();

		const result = await c.env.DB.prepare(`
			INSERT INTO tenants (name, room_number, password, base_rent, electric_rate, advance_required, advance_amount, start_month)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		`).bind(
			body.name,
			body.room_number,
			body.password,
			body.base_rent || 3000,
			body.electric_rate || 9.0,
			body.advance_required ? 1 : 0,
			body.advance_amount || 0,
			monthYear
		).run();

		const tenantId = result.meta.last_row_id as number;

		// Add initial meter reading if specified (this is the starting point for electricity calculations)
		if (body.initial_reading && body.initial_reading > 0) {
			await c.env.DB.prepare(`
				INSERT INTO meter_readings (tenant_id, reading_value, previous_value, units, cost, month_year)
				VALUES (?, ?, 0, 0, 0, 'Initial Reading')
			`).bind(tenantId, body.initial_reading).run();
		}

		// Add recurring water bill if specified
		if (body.water_bill && body.water_bill > 0) {
			await c.env.DB.prepare(`
				INSERT INTO other_bills (tenant_id, name, amount, month_year, is_recurring)
				VALUES (?, 'Water', ?, ?, 1)
			`).bind(tenantId, body.water_bill, monthYear).run();
		}

		// Add recurring waste bill if specified
		if (body.waste_bill && body.waste_bill > 0) {
			await c.env.DB.prepare(`
				INSERT INTO other_bills (tenant_id, name, amount, month_year, is_recurring)
				VALUES (?, 'Moylar Bill', ?, ?, 1)
			`).bind(tenantId, body.waste_bill, monthYear).run();
		}

		// Create invoice for current month
		await updateInvoice(c.env.DB, tenantId, monthYear);

		return c.json({ success: true, id: tenantId, message: 'Tenant created' }, 201);
	} catch (error: any) {
		if (error.message?.includes('UNIQUE')) {
			// Check if there is an inactive tenant with this room number
			const inactive = await c.env.DB.prepare('SELECT id FROM tenants WHERE room_number = ? AND is_active = 0').bind(body.room_number).first<{ id: number }>();
			if (inactive) {
				// Rename the old inactive tenant to free up the room number
				await c.env.DB.prepare('UPDATE tenants SET room_number = room_number || "_archived_" || id WHERE id = ?').bind(inactive.id).run();
				return c.json({ success: false, error: 'Previous deleted tenant archived. Please try creating again.' }, 409);
			}
			return c.json({ success: false, error: 'Room number already exists' }, 409);
		}
		console.error('Error creating tenant:', error);
		return c.json({ success: false, error: 'Failed to create tenant' }, 500);
	}
});

// Get single tenant details
app.get('/api/admin/tenants/:id', async (c) => {
	try {
		const id = c.req.param('id');
		const monthYear = c.req.query('month') || getCurrentMonthYear();

		const tenant = await c.env.DB.prepare('SELECT * FROM tenants WHERE id = ?').bind(id).first<Tenant>();
		if (!tenant) return c.json({ success: false, error: 'Tenant not found' }, 404);

		// Get invoice
		const invoice = await c.env.DB.prepare(
			'SELECT * FROM invoices WHERE tenant_id = ? AND month_year = ?'
		).bind(id, monthYear).first<Invoice>();

		// Get other bills for this month
		const { results: otherBills } = await c.env.DB.prepare(
			'SELECT * FROM other_bills WHERE tenant_id = ? AND month_year = ? ORDER BY created_at'
		).bind(id, monthYear).all<OtherBill>();

		// Get recent readings
		const { results: readings } = await c.env.DB.prepare(
			'SELECT * FROM meter_readings WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 5'
		).bind(id).all<MeterReading>();

		return c.json({
			success: true,
			data: { tenant, invoice, otherBills, readings, month: monthYear }
		});
	} catch (error) {
		console.error('Error fetching tenant:', error);
		return c.json({ success: false, error: 'Failed to fetch tenant' }, 500);
	}
});

// Update tenant
app.put('/api/admin/tenants/:id', async (c) => {
	try {
		const id = c.req.param('id');
		const body = await c.req.json<Partial<Tenant> & { month_year?: string, create_new?: boolean }>();

		const currentTenant = await c.env.DB.prepare('SELECT * FROM tenants WHERE id = ?').bind(id).first<Tenant>();
		if (!currentTenant) return c.json({ success: false, error: 'Tenant not found' }, 404);

		if (body.create_new) {
			// Mark old tenant as inactive and rename room to avoid unique constraint
			await c.env.DB.prepare(`
				UPDATE tenants 
				SET is_active = 0, room_number = room_number || '_archived_' || id 
				WHERE id = ?
			`).bind(id).run();

			// Create new tenant with updated data
			const result = await c.env.DB.prepare(`
				INSERT INTO tenants (name, room_number, password, base_rent, electric_rate, advance_required, advance_amount, advance_paid, start_month)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
			`).bind(
				body.name !== undefined ? body.name : currentTenant.name,
				body.room_number !== undefined ? body.room_number : currentTenant.room_number,
				body.password !== undefined ? body.password : currentTenant.password,
				body.base_rent !== undefined ? body.base_rent : currentTenant.base_rent,
				body.electric_rate !== undefined ? body.electric_rate : currentTenant.electric_rate,
				body.advance_required !== undefined ? body.advance_required : currentTenant.advance_required,
				body.advance_amount !== undefined ? body.advance_amount : currentTenant.advance_amount,
				body.advance_paid !== undefined ? body.advance_paid : currentTenant.advance_paid,
				body.month_year || getCurrentMonthYear()
			).run();

			const newId = result.meta.last_row_id as number;

			// Create invoice for the new tenant
			const monthYear = body.month_year || getCurrentMonthYear();
			await updateInvoice(c.env.DB, newId, monthYear);

			return c.json({ success: true, message: 'New tenant created, old one archived', id: newId });
		}

		const updates: string[] = [];
		const values: any[] = [];

		if (body.name !== undefined) { updates.push('name = ?'); values.push(body.name); }
		if (body.room_number !== undefined) { updates.push('room_number = ?'); values.push(body.room_number); }
		if (body.password !== undefined) { updates.push('password = ?'); values.push(body.password); }
		if (body.base_rent !== undefined) { updates.push('base_rent = ?'); values.push(body.base_rent); }
		if (body.electric_rate !== undefined) { updates.push('electric_rate = ?'); values.push(body.electric_rate); }
		if (body.advance_required !== undefined) { updates.push('advance_required = ?'); values.push(body.advance_required); }
		if (body.advance_amount !== undefined) { updates.push('advance_amount = ?'); values.push(body.advance_amount); }
		if (body.advance_paid !== undefined) { updates.push('advance_paid = ?'); values.push(body.advance_paid); }
		if (body.is_active !== undefined) { updates.push('is_active = ?'); values.push(body.is_active); }

		if (updates.length === 0) {
			return c.json({ success: false, error: 'No fields to update' }, 400);
		}

		values.push(id);
		await c.env.DB.prepare(`UPDATE tenants SET ${updates.join(', ')} WHERE id = ?`).bind(...values).run();

		// Recalculate invoice if rent or electric rate or name changed
		const monthYear = body.month_year || getCurrentMonthYear();
		if (body.base_rent !== undefined || body.electric_rate !== undefined || body.name !== undefined || body.room_number !== undefined) {
			await updateInvoice(c.env.DB, parseInt(id), monthYear);
		}

		return c.json({ success: true, message: 'Tenant updated' });
	} catch (error) {
		console.error('Error updating tenant:', error);
		return c.json({ success: false, error: 'Failed to update tenant' }, 500);
	}
});

// Delete tenant (Soft delete)
app.delete('/api/admin/tenants/:id', async (c) => {
	try {
		const id = c.req.param('id');
		// Soft delete and rename room number to avoid unique constraint conflicts
		await c.env.DB.prepare(`
			UPDATE tenants 
			SET is_active = 0, room_number = room_number || '_archived_' || id 
			WHERE id = ?
		`).bind(id).run();
		return c.json({ success: true, message: 'Tenant deleted' });
	} catch (error) {
		console.error('Error deleting tenant:', error);
		return c.json({ success: false, error: 'Failed to delete tenant' }, 500);
	}
});

// Manual meter reading
app.post('/api/admin/meter-readings/manual', async (c) => {
	try {
		const body = await c.req.json<{ tenant_id: number; reading: number; month: string }>();

		if (!body.tenant_id || !body.reading || !body.month) {
			return c.json({ success: false, error: 'Tenant ID, reading, and month required' }, 400);
		}



		console.log('--- Manual Reading Debug ---');
		console.log('Tenant:', body.tenant_id, 'Month:', body.month, 'Reading:', body.reading);

		// Check if a reading already exists for this month (get the latest one)
		const existingReading = await c.env.DB.prepare(
			'SELECT id FROM meter_readings WHERE tenant_id = ? AND month_year = ? ORDER BY created_at DESC LIMIT 1'
		).bind(body.tenant_id, body.month).first<{ id: number }>();
		console.log('Existing Reading ID:', existingReading?.id);

		// Find previous valid reading (excluding current month to avoid self-reference)
		const previousReading = await c.env.DB.prepare(
			'SELECT reading_value FROM meter_readings WHERE tenant_id = ? AND month_year != ? ORDER BY created_at DESC LIMIT 1'
		).bind(body.tenant_id, body.month).first<{ reading_value: number }>();
		console.log('Previous Reading SQL Result:', previousReading);

		const prevValue = previousReading?.reading_value || 0;
		const units = Math.max(0, body.reading - prevValue);

		console.log('Calculated - Prev:', prevValue, 'Units:', units);

		// Get tenant rate
		const tenant = await c.env.DB.prepare('SELECT electric_rate FROM tenants WHERE id = ?').bind(body.tenant_id).first<{ electric_rate: number }>();
		const rate = tenant?.electric_rate || 0;
		const cost = units * rate;

		if (existingReading) {
			console.log('Updating existing reading...');
			// Update existing reading
			await c.env.DB.prepare(`
				UPDATE meter_readings 
				SET reading_value = ?, previous_value = ?, units = ?, cost = ?
				WHERE id = ?
			`).bind(body.reading, prevValue, units, cost, existingReading.id).run();
			console.log('Update run complete');
		} else {
			console.log('Inserting new reading...');
			// Insert new reading
			await c.env.DB.prepare(`
				INSERT INTO meter_readings (tenant_id, reading_value, previous_value, units, cost, month_year)
				VALUES (?, ?, ?, ?, ?, ?)
			`).bind(body.tenant_id, body.reading, prevValue, units, cost, body.month).run();
		}

		// Update invoice
		await updateInvoice(c.env.DB, body.tenant_id, body.month);
		console.log('Invoice updated');

		return c.json({ success: true, message: 'Manual reading recorded' });
	} catch (error) {
		console.error('Error recording manual reading:', error);
		return c.json({ success: false, error: 'Failed to record reading' }, 500);
	}
});

// Add other bill
app.post('/api/admin/tenants/:id/other-bill', async (c) => {
	try {
		const tenantId = c.req.param('id');
		const { name, amount, is_recurring, month_year } = await c.req.json<{ name: string; amount: number; is_recurring?: boolean; month_year?: string }>();

		if (!name || typeof amount !== 'number') {
			return c.json({ success: false, error: 'Name and amount required' }, 400);
		}

		const monthYear = month_year || getCurrentMonthYear();

		await c.env.DB.prepare(`
			INSERT INTO other_bills (tenant_id, name, amount, month_year, is_recurring)
			VALUES (?, ?, ?, ?, ?)
		`).bind(tenantId, name, amount, monthYear, is_recurring ? 1 : 0).run();

		// Update invoice
		const invoice = await updateInvoice(c.env.DB, parseInt(tenantId), monthYear);

		return c.json({ success: true, message: 'Bill added', invoice });
	} catch (error) {
		console.error('Error adding bill:', error);
		return c.json({ success: false, error: 'Failed to add bill' }, 500);
	}
});

// Update other bill
app.put('/api/admin/other-bills/:id', async (c) => {
	try {
		const billId = c.req.param('id');
		const { name, amount } = await c.req.json<{ name?: string; amount?: number }>();

		const bill = await c.env.DB.prepare('SELECT * FROM other_bills WHERE id = ?').bind(billId).first<OtherBill>();
		if (!bill) return c.json({ success: false, error: 'Bill not found' }, 404);

		const updates: string[] = [];
		const values: any[] = [];
		if (name !== undefined) { updates.push('name = ?'); values.push(name); }
		if (amount !== undefined) { updates.push('amount = ?'); values.push(amount); }

		if (updates.length === 0) {
			return c.json({ success: false, error: 'No fields to update' }, 400);
		}

		values.push(billId);
		await c.env.DB.prepare(`UPDATE other_bills SET ${updates.join(', ')} WHERE id = ?`).bind(...values).run();

		// Update invoice
		await updateInvoice(c.env.DB, bill.tenant_id, bill.month_year);

		return c.json({ success: true, message: 'Bill updated' });
	} catch (error) {
		console.error('Error updating bill:', error);
		return c.json({ success: false, error: 'Failed to update bill' }, 500);
	}
});

// Delete other bill
app.delete('/api/admin/other-bills/:id', async (c) => {
	try {
		const billId = c.req.param('id');

		const bill = await c.env.DB.prepare('SELECT * FROM other_bills WHERE id = ?').bind(billId).first<OtherBill>();
		if (!bill) return c.json({ success: false, error: 'Bill not found' }, 404);

		await c.env.DB.prepare('DELETE FROM other_bills WHERE id = ?').bind(billId).run();

		// Update invoice
		await updateInvoice(c.env.DB, bill.tenant_id, bill.month_year);

		return c.json({ success: true, message: 'Bill deleted' });
	} catch (error) {
		console.error('Error deleting bill:', error);
		return c.json({ success: false, error: 'Failed to delete bill' }, 500);
	}
});

// Record payment
app.post('/api/admin/invoices/:id/payment', async (c) => {
	try {
		const invoiceId = c.req.param('id');
		const { amount, mark_full } = await c.req.json<{ amount?: number; mark_full?: boolean }>();

		const invoice = await c.env.DB.prepare('SELECT * FROM invoices WHERE id = ?').bind(invoiceId).first<Invoice>();
		if (!invoice) return c.json({ success: false, error: 'Invoice not found' }, 404);

		let newPaid = invoice.amount_paid;
		let fullyPaid = invoice.is_fully_paid;

		if (mark_full) {
			newPaid = invoice.total_due;
			fullyPaid = 1;
		} else if (typeof amount === 'number') {
			newPaid = amount;
			fullyPaid = newPaid >= invoice.total_due ? 1 : 0;
		}

		await c.env.DB.prepare(`
			UPDATE invoices SET amount_paid = ?, is_fully_paid = ?, updated_at = datetime('now')
			WHERE id = ?
		`).bind(newPaid, fullyPaid, invoiceId).run();

		return c.json({
			success: true,
			message: 'Payment recorded',
			amount_paid: newPaid,
			due_remaining: Math.max(0, invoice.total_due - newPaid),
			is_fully_paid: fullyPaid
		});
	} catch (error) {
		console.error('Error recording payment:', error);
		return c.json({ success: false, error: 'Failed to record payment' }, 500);
	}
});

// Update advance payment
app.post('/api/admin/tenants/:id/advance', async (c) => {
	try {
		const tenantId = c.req.param('id');
		const { amount_paid } = await c.req.json<{ amount_paid: number }>();

		if (typeof amount_paid !== 'number') {
			return c.json({ success: false, error: 'Amount required' }, 400);
		}

		await c.env.DB.prepare(
			'UPDATE tenants SET advance_paid = ? WHERE id = ?'
		).bind(amount_paid, tenantId).run();

		const tenant = await c.env.DB.prepare('SELECT * FROM tenants WHERE id = ?').bind(tenantId).first<Tenant>();

		return c.json({
			success: true,
			message: 'Advance updated',
			advance_paid: amount_paid,
			advance_due: Math.max(0, (tenant?.advance_amount || 0) - amount_paid)
		});
	} catch (error) {
		console.error('Error updating advance:', error);
		return c.json({ success: false, error: 'Failed to update advance' }, 500);
	}
});

// Update admin password
app.post('/api/admin/password', async (c) => {
	try {
		const { old_password, new_password } = await c.req.json<{ old_password: string; new_password: string }>();

		const admin = await c.env.DB.prepare('SELECT * FROM admin WHERE id = 1').first<{ password: string }>();
		if (!admin || admin.password !== old_password) {
			return c.json({ success: false, error: 'Invalid current password' }, 401);
		}

		await c.env.DB.prepare('UPDATE admin SET password = ? WHERE id = 1').bind(new_password).run();

		return c.json({ success: true, message: 'Password updated' });
	} catch (error) {
		console.error('Error updating password:', error);
		return c.json({ success: false, error: 'Failed to update password' }, 500);
	}
});

// ============================================
// TENANT ENDPOINTS
// ============================================

// Tenant dashboard
app.get('/api/tenant/:id/dashboard', async (c) => {
	try {
		const tenantId = c.req.param('id');
		const monthYear = c.req.query('month') || getCurrentMonthYear();

		const tenant = await c.env.DB.prepare(
			'SELECT id, name, room_number, base_rent, electric_rate, advance_required, advance_amount, advance_paid, start_month FROM tenants WHERE id = ? AND is_active = 1'
		).bind(tenantId).first<any>();

		if (!tenant) return c.json({ success: false, error: 'Tenant not found' }, 404);

		// Check if requested month is before tenant's start_month
		const startMonth = tenant.start_month;
		if (startMonth && isMonthBefore(monthYear, startMonth)) {
			return c.json({
				success: true,
				data: {
					tenant,
					invoice: null,
					otherBills: [],
					lastReading: null,
					month: monthYear,
					message: 'Tenant was not active in this month'
				}
			});
		}

		// Get or create invoice
		const invoice = await ensureInvoiceExists(c.env.DB, parseInt(tenantId), monthYear);

		// Get other bills
		const { results: otherBills } = await c.env.DB.prepare(
			'SELECT id, name, amount FROM other_bills WHERE tenant_id = ? AND month_year = ?'
		).bind(tenantId, monthYear).all();

		// Get last reading
		const lastReading = await c.env.DB.prepare(
			'SELECT * FROM meter_readings WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 1'
		).bind(tenantId).first<MeterReading>();

		// Calculate grand total due (sum of all unpaid invoices)
		// Calculate grand total due (sum of all unpaid invoices)
		const pendingResult = await c.env.DB.prepare(
			'SELECT SUM(total_due - amount_paid) as total_pending FROM invoices WHERE tenant_id = ?'
		).bind(tenantId).first<{ total_pending: number }>();

		return c.json({
			success: true,
			data: {
				tenant,
				invoice: {
					...invoice,
					due_remaining: Math.max(0, (invoice?.total_due || 0) - (invoice?.amount_paid || 0))
				},
				grandTotalDue: pendingResult?.total_pending || 0,
				otherBills,
				lastReading,
				month: monthYear
			}
		});
	} catch (error) {
		console.error('Error fetching tenant dashboard:', error);
		return c.json({ success: false, error: 'Failed to fetch dashboard' }, 500);
	}
});


// ============================================
// METER SCANNING
// ============================================

app.post('/api/scan-meter', async (c) => {
	try {
		const formData = await c.req.formData();
		const image = formData.get('image') as File | null;
		const tenantId = formData.get('tenant_id') as string;

		if (!image || !tenantId) {
			return c.json({ success: false, error: 'Image and tenant_id required' }, 400);
		}

		// Get tenant
		const tenant = await c.env.DB.prepare(
			'SELECT * FROM tenants WHERE id = ? AND is_active = 1'
		).bind(tenantId).first<Tenant>();

		if (!tenant) return c.json({ success: false, error: 'Tenant not found' }, 404);

		// Upload to R2
		const imageBuffer = await image.arrayBuffer();
		const imageKey = `meters/${tenantId}/${Date.now()}-${image.name}`;
		await c.env.BUCKET.put(imageKey, imageBuffer, {
			httpMetadata: { contentType: image.type }
		});

		// AI Vision
		const imageArray = new Uint8Array(imageBuffer);
		const aiResponse = await c.env.AI.run('@cf/meta/llama-3.2-11b-vision-instruct', {
			messages: [{
				role: 'user',
				content: [{
					type: 'text',
					text: 'Output ONLY the numeric digits visible on this electricity meter display. Just the number, nothing else.'
				}, {
					type: 'image',
					image: [...imageArray]
				}]
			}],
			max_tokens: 50
		});

		const aiText = (aiResponse as any).response || '';
		const digitsMatch = aiText.match(/\d+/);

		if (!digitsMatch) {
			return c.json({
				success: false,
				error: 'Could not read meter digits',
				ai_response: aiText,
				image_key: imageKey
			}, 400);
		}

		const currentReading = parseInt(digitsMatch[0], 10);
		const monthYear = getCurrentMonthYear();

		// Get previous reading
		const lastReading = await c.env.DB.prepare(
			'SELECT reading_value FROM meter_readings WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 1'
		).bind(tenantId).first<{ reading_value: number }>();

		const previousValue = lastReading?.reading_value || 0;

		if (currentReading < previousValue) {
			return c.json({
				success: false,
				error: 'Current reading is less than previous. Meter reset?',
				current: currentReading,
				previous: previousValue
			}, 400);
		}

		// Calculate
		const units = currentReading - previousValue;
		const cost = units * tenant.electric_rate;

		// Save reading
		await c.env.DB.prepare(`
			INSERT INTO meter_readings (tenant_id, reading_value, previous_value, units, cost, image_key, month_year)
			VALUES (?, ?, ?, ?, ?, ?, ?)
		`).bind(tenantId, currentReading, previousValue, units, cost, imageKey, monthYear).run();

		// Update invoice
		const invoice = await updateInvoice(c.env.DB, parseInt(tenantId), monthYear);

		return c.json({
			success: true,
			message: 'Meter scanned successfully',
			data: {
				reading: { current: currentReading, previous: previousValue, units, cost },
				invoice,
				image_key: imageKey
			}
		});
	} catch (error) {
		console.error('Scan error:', error);
		return c.json({ success: false, error: 'Failed to scan meter' }, 500);
	}
});

// Get readings history
app.get('/api/tenant/:id/readings', async (c) => {
	try {
		const tenantId = c.req.param('id');
		const { results } = await c.env.DB.prepare(
			'SELECT * FROM meter_readings WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 12'
		).bind(tenantId).all<MeterReading>();

		return c.json({ success: true, data: results });
	} catch (error) {
		console.error('Error fetching readings:', error);
		return c.json({ success: false, error: 'Failed to fetch readings' }, 500);
	}
});

export default app;
