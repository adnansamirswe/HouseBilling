'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Building2, Search, Home, User, AlertCircle, Zap, FileText, Receipt, Printer
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getPublicBills, getTenantDashboard, type PublicBillRow } from '@/lib/api';
import { getErrorMessage } from '@/lib/utils';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

/** Calendar month label e.g. May-2026 */
function monthYearLabel(d: Date): string {
    return `${MONTHS[d.getMonth()]}-${d.getFullYear()}`;
}

function fullMonthYearLabel(shortMonthYear: string): string {
    const [mon, year] = shortMonthYear.split('-');
    const map: Record<string, string> = {
        Jan: 'January',
        Feb: 'February',
        Mar: 'March',
        Apr: 'April',
        May: 'May',
        Jun: 'June',
        Jul: 'July',
        Aug: 'August',
        Sep: 'September',
        Oct: 'October',
        Nov: 'November',
        Dec: 'December',
    };
    return `${map[mon] || mon}-${year}`;
}

/**
 * Same idea as the admin dashboard: focus on completed cycles.
 * We load the previous calendar month and the one before that (tenants pay after the month ends).
 */
function getPostedBillingMonths(): [string, string] {
    const now = new Date();
    const recent = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const older = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    return [monthYearLabel(recent), monthYearLabel(older)];
}

function getCompletedBillingMonths(count: number): string[] {
    const now = new Date();
    const out: string[] = [];
    for (let i = 1; i <= count; i++) {
        out.push(monthYearLabel(new Date(now.getFullYear(), now.getMonth() - i, 1)));
    }
    return out;
}

function isPaidFlag(v: PublicBillRow['is_fully_paid']): boolean {
    return v === true || v === 1;
}

function formatTaka(n: number | string | null | undefined): string {
    if (n === '' || n === null || n === undefined) return '—';
    const x = typeof n === 'string' ? Number(n) : n;
    if (Number.isNaN(Number(x))) return '—';
    return `৳${Number(x).toFixed(0)}`;
}

function hasAnyInvoiceSignal(row: PublicBillRow): boolean {
    return row.total_due != null || (row.amount_paid != null && Number(row.amount_paid) > 0);
}

/** True when we have an invoice total but API omitted one or more line amounts */
function needsBillEnrichment(row: PublicBillRow): boolean {
    if (!hasAnyInvoiceSignal(row)) return false;
    return (
        row.rent_amount == null ||
        row.electric_amount == null ||
        row.other_total == null
    );
}

/**
 * Older / cached Worker responses sometimes omit rent/electric/other. Dashboard always includes them.
 */
async function enrichBillRows(
    rows: PublicBillRow[],
    monthKey: string
): Promise<PublicBillRow[]> {
    const cacheByTenantMonth = new Map<
        string,
        Awaited<ReturnType<typeof getTenantDashboard>>
    >();

    const enrichOneDeduped = async (row: PublicBillRow): Promise<PublicBillRow> => {
        const month = row.month_year || monthKey;
        const mapKey = `${row.tenant_id}:${month}`;
        if (!needsBillEnrichment(row)) return row;

        let dash = cacheByTenantMonth.get(mapKey);
        if (!dash) {
            try {
                dash = await getTenantDashboard(row.tenant_id, month);
                cacheByTenantMonth.set(mapKey, dash);
            } catch {
                return row;
            }
        }

        const inv = dash.invoice;
        if (!inv) return row;

        return {
            ...row,
            rent_amount: inv.rent_amount,
            electric_amount: inv.electric_amount,
            other_total: inv.other_total,
            total_due: row.total_due ?? inv.total_due,
            amount_paid: row.amount_paid ?? inv.amount_paid,
            is_fully_paid: row.is_fully_paid ?? inv.is_fully_paid,
            month_year: month,
        };
    };

    return Promise.all(rows.map((r) => enrichOneDeduped(r)));
}

type TenantMonthSlice = {
    month: string;
    row: PublicBillRow | null;
};

type MergedTenantCard = {
    tenant_id: number;
    room_number: string;
    tenant_name: string;
    slices: [TenantMonthSlice, TenantMonthSlice];
};

type DueLine = {
    month: string;
    due: number;
};

type PrintTenantRow = {
    tenant_id: number;
    room_number: string;
    tenant_name: string;
    rent: number;
    electricity: number;
    moylarBill: number;
    previousDueLines: DueLine[];
    totalDue: number;
};

function dueForSlice(slice: TenantMonthSlice): number {
    const row = slice.row;
    if (!row || row.total_due == null) return 0;
    const total = Number(row.total_due || 0);
    const paid = Number(row.amount_paid || 0);
    return Math.max(0, total - paid);
}

function mergeByTenant(
    recentRows: PublicBillRow[],
    olderRows: PublicBillRow[],
    monthRecent: string,
    monthOlder: string
): MergedTenantCard[] {
    const byId = new Map<number, MergedTenantCard>();

    const touch = (row: PublicBillRow) => {
        let m = byId.get(row.tenant_id);
        if (!m) {
            m = {
                tenant_id: row.tenant_id,
                room_number: row.room_number,
                tenant_name: row.tenant_name,
                slices: [
                    { month: monthRecent, row: null },
                    { month: monthOlder, row: null },
                ],
            };
            byId.set(row.tenant_id, m);
        }
        return m;
    };

    for (const row of recentRows) {
        const m = touch(row);
        m.room_number = row.room_number;
        m.tenant_name = row.tenant_name;
        m.slices[0] = { month: monthRecent, row };
    }
    for (const row of olderRows) {
        const m = touch(row);
        m.room_number = row.room_number;
        m.tenant_name = row.tenant_name;
        m.slices[1] = { month: monthOlder, row };
    }

    return Array.from(byId.values()).sort((a, b) =>
        String(a.room_number).localeCompare(String(b.room_number), undefined, { numeric: true })
    );
}

function MonthBlock({ slice }: { slice: TenantMonthSlice }) {
    const { month, row } = slice;
    const hasInvoice = row && row.total_due != null;
    const totalDue = Number(row?.total_due || 0);
    const paidAmount = Number(row?.amount_paid || 0);
    const dueAmount = Math.max(0, totalDue - paidAmount);

    return (
        <div className="rounded-lg border border-border/60 bg-background/40 p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                    {month}
                </span>
                {hasInvoice ? (
                    <Badge
                        variant={isPaidFlag(row!.is_fully_paid) ? 'success' : 'destructive'}
                        className="px-2 py-0.5 text-[10px] uppercase"
                    >
                        {isPaidFlag(row!.is_fully_paid) ? 'Paid' : `Due ৳${dueAmount.toFixed(0)}`}
                    </Badge>
                ) : (
                    <span className="text-[10px] text-muted-foreground">No bill</span>
                )}
            </div>

            {hasInvoice ? (
                <>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                            <Zap className="w-3.5 h-3.5 shrink-0 text-yellow-400" />
                            <span>Electricity</span>
                        </div>
                        <span className="text-right font-semibold tabular-nums">
                            {formatTaka(row!.electric_amount)}
                        </span>
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                            <FileText className="w-3.5 h-3.5 shrink-0 text-purple-300" />
                            <span>Moylar Bill</span>
                        </div>
                        <span className="text-right font-semibold tabular-nums">
                            {formatTaka(row!.other_total)}
                        </span>
                        <div className="flex items-center gap-1.5 text-muted-foreground col-span-2 pt-1 border-t border-border/40">
                            <Receipt className="w-3.5 h-3.5 shrink-0 text-primary" />
                            <span>Rent</span>
                            <span className="ml-auto font-semibold tabular-nums">
                                {formatTaka(row!.rent_amount)}
                            </span>
                        </div>
                    </div>
                    <div className="flex items-end justify-between pt-1 border-t border-dashed border-border/50">
                        <div>
                            <p className="text-[10px] uppercase text-muted-foreground font-bold">Total bill</p>
                            <p className="text-lg font-black tabular-nums">{formatTaka(row!.total_due)}</p>
                        </div>
                        {row!.amount_paid != null && Number(row!.amount_paid) > 0 && (
                            <p className="text-[11px] text-green-400 font-medium tabular-nums">
                                Paid {formatTaka(row!.amount_paid)}
                            </p>
                        )}
                    </div>
                </>
            ) : (
                <p className="text-xs text-muted-foreground text-center py-1">
                    No invoice for this month yet.
                </p>
            )}
        </div>
    );
}

export default function TenantBillBoardPage() {
    const [monthRecent, monthOlder] = useMemo(() => getPostedBillingMonths(), []);
    const reportMonths = useMemo(() => getCompletedBillingMonths(6), []);
    const [merged, setMerged] = useState<MergedTenantCard[]>([]);
    const [printRows, setPrintRows] = useState<PrintTenantRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const monthlyBillsUrl = 'https://housebill.vercel.app/bill-status/';
    const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(
        monthlyBillsUrl
    )}`;

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const reportResults = await Promise.all(
                reportMonths.map(async (m) => {
                    const res = await getPublicBills(m);
                    const enriched = await enrichBillRows(res.data, m);
                    return { month: m, rows: enriched };
                })
            );

            const byMonth = new Map<string, PublicBillRow[]>(
                reportResults.map((x) => [x.month, x.rows])
            );

            const enrichedRecent = byMonth.get(monthRecent) || [];
            const enrichedOlder = byMonth.get(monthOlder) || [];
            setMerged(mergeByTenant(enrichedRecent, enrichedOlder, monthRecent, monthOlder));

            const tenantMap = new Map<number, { room_number: string; tenant_name: string }>();
            for (const monthRows of byMonth.values()) {
                for (const r of monthRows) {
                    if (!tenantMap.has(r.tenant_id)) {
                        tenantMap.set(r.tenant_id, {
                            room_number: r.room_number,
                            tenant_name: r.tenant_name,
                        });
                    }
                }
            }

            const rowsForPrint: PrintTenantRow[] = [];
            for (const [tenantId, info] of tenantMap.entries()) {
                const recentRow = enrichedRecent.find((r) => r.tenant_id === tenantId) || null;
                const rent = Number(recentRow?.rent_amount || 0);
                const electricity = Number(recentRow?.electric_amount || 0);
                const moylarBill = Number(recentRow?.other_total || 0);
                const currentDue = recentRow
                    ? Math.max(
                          0,
                          Number(recentRow.total_due || 0) - Number(recentRow.amount_paid || 0)
                      )
                    : 0;

                const previousDueLines: DueLine[] = reportMonths
                    .slice(1)
                    .map((m) => {
                        const row = (byMonth.get(m) || []).find((r) => r.tenant_id === tenantId);
                        if (!row) return null;
                        const due = Math.max(0, Number(row.total_due || 0) - Number(row.amount_paid || 0));
                        if (due <= 0) return null;
                        return { month: m, due };
                    })
                    .filter((x): x is DueLine => x !== null);

                const totalDue = currentDue + previousDueLines.reduce((sum, d) => sum + d.due, 0);

                rowsForPrint.push({
                    tenant_id: tenantId,
                    room_number: info.room_number,
                    tenant_name: info.tenant_name,
                    rent,
                    electricity,
                    moylarBill,
                    previousDueLines,
                    totalDue,
                });
            }

            rowsForPrint.sort((a, b) =>
                String(a.room_number).localeCompare(String(b.room_number), undefined, { numeric: true })
            );
            setPrintRows(rowsForPrint);
            setError(null);
        } catch (err: unknown) {
            setError(getErrorMessage(err));
            setMerged([]);
            setPrintRows([]);
        } finally {
            setLoading(false);
        }
    }, [monthRecent, monthOlder, reportMonths]);

    useEffect(() => {
        load();
    }, [load]);

    const filtered = merged.filter(
        (m) =>
            m.room_number.toLowerCase().includes(search.toLowerCase()) ||
            m.tenant_name.toLowerCase().includes(search.toLowerCase())
    );
    const grandTotalDue = printRows.reduce((sum, row) => sum + row.totalDue, 0);

    return (
        <main className="min-h-screen bg-background pb-12">
            <div className="no-print">
                <div className="bg-primary/5 border-b border-primary/10 sticky top-0 z-20 glass">
                    <div className="max-w-5xl mx-auto px-4 py-3">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center text-primary-foreground shadow">
                                <Building2 className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                                <h1 className="text-base font-bold tracking-tight">Billing board</h1>
                                <p className="text-[11px] text-muted-foreground">
                                    {monthRecent} & {monthOlder}
                                </p>
                            </div>
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="ml-auto no-print"
                                onClick={() => window.print()}
                            >
                                <Printer className="w-4 h-4" />
                                Print
                            </Button>
                        </div>

                        <div className="mt-3 relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                                placeholder="Search by room or name..."
                                className="pl-10 h-10 bg-background/50 border focus:border-primary transition-all rounded-lg"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                <div className="max-w-5xl mx-auto px-4 mt-8">
                    {error && (
                        <Card className="border-destructive/20 bg-destructive/5 mb-6">
                            <CardContent className="pt-6 flex items-center gap-3 text-destructive">
                                <AlertCircle className="w-5 h-5" />
                                <p className="font-medium">{error}</p>
                            </CardContent>
                        </Card>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <AnimatePresence mode="popLayout">
                            {loading ? (
                                Array.from({ length: 4 }).map((_, i) => (
                                    <Card key={i} className="animate-pulse bg-secondary/20 border-none min-h-[220px]" />
                                ))
                            ) : filtered.length > 0 ? (
                                filtered.map((card, index) => {
                                    const totalDue = dueForSlice(card.slices[0]) + dueForSlice(card.slices[1]);
                                    return (
                                    <motion.div
                                        key={card.tenant_id}
                                        layout
                                        initial={{ opacity: 0, y: 8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: index * 0.03 }}
                                    >
                                        <Card className="border-2 border-border/80 hover:border-primary/25 transition-colors h-full">
                                            <CardContent className="p-5 flex flex-col gap-4">
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="w-11 h-11 rounded-xl bg-secondary flex items-center justify-center shrink-0">
                                                        <Home className="w-5 h-5 text-primary" />
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                                                            Room
                                                        </p>
                                                        <p className="text-xl font-black leading-tight truncate">
                                                            {card.room_number}
                                                        </p>
                                                        <div className="flex items-start gap-1.5 mt-1 text-sm text-muted-foreground font-medium">
                                                            <User className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                                                            <span className="leading-snug">{card.tenant_name}</span>
                                                        </div>
                                                    </div>
                                                    <div className="text-right shrink-0">
                                                        <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                                                            Total due
                                                        </p>
                                                        <p className="text-sm font-black tabular-nums text-destructive">
                                                            ৳{totalDue.toFixed(0)}
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-2 gap-2">
                                                    <MonthBlock slice={card.slices[0]} />
                                                    <MonthBlock slice={card.slices[1]} />
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </motion.div>
                                    );
                                })
                            ) : (
                                <div className="col-span-full py-20 text-center">
                                    <Search className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-20" />
                                    <h3 className="text-xl font-bold text-muted-foreground">No matches</h3>
                                    <p className="text-sm text-muted-foreground/60">
                                        Try a different room number or name
                                    </p>
                                </div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>

            <section className="print-only hidden p-6 text-black">
                <div className="flex items-start justify-between mb-4">
                    <div>
                        <h1 className="text-xl font-bold mb-1">Monthly Billing Report</h1>
                        <p className="text-sm">Month: {fullMonthYearLabel(monthRecent)}</p>
                    </div>
                    <div className="text-center">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={qrSrc}
                            alt="Monthly bills QR"
                            width={80}
                            height={80}
                            className="w-20 h-20 mx-auto border border-black/20 p-1"
                        />
                        <p className="text-[11px] mt-1">Scan to see Monthly Bills</p>
                    </div>
                </div>
                <div className="print-grid grid grid-cols-2 gap-3">
                    {printRows.map((row) => (
                        <div key={row.tenant_id} className="border border-black/30 rounded p-3">
                            <div className="flex items-center justify-between mb-2">
                                <p className="font-bold">Room {row.room_number}</p>
                                <p className="text-sm">{row.tenant_name}</p>
                            </div>
                            <div className="text-sm space-y-1">
                                <div className="flex justify-between">
                                    <span>Rent</span>
                                    <span>{formatTaka(row.rent)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Electricity</span>
                                    <span>{formatTaka(row.electricity)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Moylar Bill</span>
                                    <span>{formatTaka(row.moylarBill)}</span>
                                </div>
                            </div>

                            {row.previousDueLines.length > 0 && (
                                <div className="mt-2 pt-2 border-t border-black/20 text-sm">
                                    <p className="font-semibold mb-1">Previous dues</p>
                                    {row.previousDueLines.map((d) => (
                                        <div key={`${row.tenant_id}-${d.month}`} className="flex justify-between">
                                            <span>{d.month}</span>
                                            <span>{formatTaka(d.due)}</span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="mt-2 pt-2 border-t border-black/30 flex justify-between font-bold">
                                <span>Total Due</span>
                                <span>{formatTaka(row.totalDue)}</span>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="mt-4 pt-2 border-t-2 border-black/40 flex items-center justify-end gap-2 text-base font-bold">
                    <span>Total Due (All Tenants):</span>
                    <span>{formatTaka(grandTotalDue)}</span>
                </div>
            </section>

            <style jsx global>{`
                @media print {
                    .no-print { display: none !important; }
                    .print-only { display: block !important; }
                    html, body {
                        background: #fff !important;
                        color: #000 !important;
                    }
                    main {
                        background: #fff !important;
                        padding: 0 !important;
                        margin: 0 !important;
                    }
                    @page {
                        size: A4;
                        margin: 12mm;
                    }
                    * {
                        box-shadow: none !important;
                        text-shadow: none !important;
                    }
                    .print-grid {
                        display: grid !important;
                        grid-template-columns: 1fr 1fr !important;
                        gap: 8px !important;
                    }
                    .print-grid > div {
                        break-inside: avoid;
                        page-break-inside: avoid;
                    }
                }
            `}</style>
        </main>
    );
}
