'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
    Home, Zap, LogOut, Camera, ChevronLeft, ChevronRight,
    Check, Clock, AlertCircle, Receipt, Banknote, Trash2, Printer
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
    getTenantDashboard,
    getTenantReadings,
    type TenantDashboard,
    type MeterReading,
} from '@/lib/api';
import { clearSession } from '@/lib/session';
import { getErrorMessage } from '@/lib/utils';

function getCurrentMonthYear(): string {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const now = new Date();
    return `${months[now.getMonth()]}-${now.getFullYear()}`;
}

function getMonthOptions(): string[] {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const now = new Date();
    const options: string[] = [];
    for (let i = -6; i <= 0; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
        options.push(`${months[d.getMonth()]}-${d.getFullYear()}`);
    }
    return options;
}

export default function TenantDashboardPage() {
    const params = useParams();
    const router = useRouter();
    const tenantId = params.id as string;

    const [data, setData] = useState<TenantDashboard | null>(null);
    const [readings, setReadings] = useState<MeterReading[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthYear());

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const result = await getTenantDashboard(parseInt(tenantId), selectedMonth);
            setData(result);
            setError(null);
        } catch (err: unknown) {
            setError(getErrorMessage(err));
        } finally {
            setLoading(false);
        }
    }, [tenantId, selectedMonth]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const list = await getTenantReadings(parseInt(tenantId, 10));
                if (!cancelled) setReadings(list);
            } catch {
                if (!cancelled) setReadings([]);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [tenantId]);

    const monthOptions = getMonthOptions();
    const monthIndex = monthOptions.indexOf(selectedMonth);

    if (loading) {
        return (
            <main className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="spinner mx-auto mb-4" />
                    <p className="text-muted-foreground">Loading your dashboard...</p>
                </div>
            </main>
        );
    }

    if (error || !data) {
        return (
            <main className="min-h-screen flex items-center justify-center p-4">
                <Card className="max-w-md w-full">
                    <CardContent className="pt-6 text-center">
                        <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
                        <p className="text-destructive mb-4">{error || 'Failed to load'}</p>
                        <Button onClick={() => router.push('/')}>Back to Login</Button>
                    </CardContent>
                </Card>
            </main>
        );
    }

    const { tenant, invoice, otherBills, lastReading, message } = data;

    // If invoice is null, tenant wasn't active in this month
    if (!invoice) {
        return (
            <main className="min-h-screen pb-24">
                {/* Header */}
                <header className="sticky top-0 z-20 glass border-b border-border">
                    <div className="px-4 py-4">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                                    <Home className="w-5 h-5 text-primary" />
                                </div>
                                <div>
                                    <h1 className="text-lg font-bold">{tenant.room_number}</h1>
                                    <p className="text-xs text-muted-foreground">{tenant.name}</p>
                                </div>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => {
                                clearSession();
                                router.push('/');
                            }}>
                                <LogOut className="w-5 h-5" />
                            </Button>
                        </div>

                        {/* Month Selector */}
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={() => monthIndex > 0 && setSelectedMonth(monthOptions[monthIndex - 1])}
                                disabled={monthIndex === 0}
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </Button>
                            <div className="flex-1 text-center font-semibold text-lg">{selectedMonth}</div>
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={() => monthIndex < monthOptions.length - 1 && setSelectedMonth(monthOptions[monthIndex + 1])}
                                disabled={monthIndex === monthOptions.length - 1}
                            >
                                <ChevronRight className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                </header>

                <div className="px-4 pt-8">
                    <Card className="card-premium text-center">
                        <CardContent className="py-12">
                            <AlertCircle className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                            <h2 className="text-xl font-semibold mb-2">No Data for This Month</h2>
                            <p className="text-muted-foreground">
                                {message || "You were not a tenant during this time period."}
                            </p>
                        </CardContent>
                    </Card>
                </div>
            </main>
        );
    }

    const dueRemaining = Math.max(0, (invoice.total_due || 0) - (invoice.amount_paid || 0));

    return (
        <main className="min-h-screen pb-24">
            {/* Header */}
            <header className="sticky top-0 z-20 glass border-b border-border">
                <div className="px-4 py-4">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                                <Home className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                                <h1 className="font-bold">{tenant.room_number}</h1>
                                <p className="text-xs text-muted-foreground">{tenant.name}</p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="ghost" size="icon" onClick={() => window.open(`/p/${tenantId}/`, '_blank')}>
                                <Printer className="w-5 h-5 text-blue-500" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => { clearSession(); router.push('/'); }}>
                                <LogOut className="w-5 h-5" />
                            </Button>
                        </div>
                    </div>

                    {/* Month Selector */}
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={() => monthIndex > 0 && setSelectedMonth(monthOptions[monthIndex - 1])}
                            disabled={monthIndex === 0}
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </Button>
                        <div className="flex-1 text-center font-semibold">{selectedMonth}</div>
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={() => monthIndex < monthOptions.length - 1 && setSelectedMonth(monthOptions[monthIndex + 1])}
                            disabled={monthIndex === monthOptions.length - 1}
                        >
                            <ChevronRight className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
            </header>

            <div className="px-4 pt-4">
                {/* Total Past Due Banner - on top */}
                {data.grandTotalDue !== undefined && invoice?.total_due !== undefined && data.grandTotalDue > invoice.total_due && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="mb-4"
                    >
                        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-center">
                            <p className="text-red-500 font-medium mb-1">Total Outstanding Due</p>
                            <p className="text-3xl font-bold text-red-500">৳{data.grandTotalDue.toFixed(0)}</p>
                            <p className="text-xs text-red-500/80 mt-1">Including previous unpaid months</p>
                        </div>
                    </motion.div>
                )}

                {/* Status Card */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                >
                    <Card className={`card-premium mb-4 ${invoice.is_fully_paid ? 'border-green-500/30' : 'border-yellow-500/30'}`}>
                        <CardContent className="pt-6">
                            <div className="flex items-center justify-between mb-4">
                                <span className="text-muted-foreground">Payment Status</span>
                                {invoice.is_fully_paid ? (
                                    <Badge variant="success" className="text-sm px-4 py-1">
                                        <Check className="w-4 h-4 mr-1" />
                                        Fully Paid
                                    </Badge>
                                ) : (
                                    <Badge variant="warning" className="text-sm px-4 py-1">
                                        <Clock className="w-4 h-4 mr-1" />
                                        Due: ৳{dueRemaining.toFixed(0)}
                                    </Badge>
                                )}
                            </div>
                            <div className="text-center py-4">
                                <p className="text-muted-foreground text-sm mb-1">Total Bill</p>
                                <p className="text-4xl font-bold text-primary">৳{invoice.total_due.toFixed(0)}</p>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>

                {/* Bill Breakdown */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                >
                    <Card className="card-premium mb-4">
                        <CardHeader className="pb-2">
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                {/* Rent */}
                                <div className="flex justify-between items-center py-2 border-b border-border/50">
                                    <div className="flex items-center gap-2">
                                        <Home className="w-5 h-5 text-blue-400" />
                                        <span>Monthly Rent</span>
                                    </div>
                                    <span className="font-semibold">৳{invoice.rent_amount}</span>
                                </div>

                                {/* Electric */}
                                <div className="flex justify-between items-center py-2 border-b border-border/50">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <Zap className="w-5 h-5 text-yellow-400" />
                                            <span>Electricity</span>
                                        </div>
                                        {lastReading && (
                                            <p className="text-xs text-muted-foreground ml-7">
                                                {lastReading.units} units × ৳{tenant.electric_rate}/unit
                                            </p>
                                        )}
                                    </div>
                                    <span className="font-semibold">৳{invoice.electric_amount.toFixed(0)}</span>
                                </div>

                                {/* Other Bills */}
                                {otherBills.map((bill) => (
                                    <div key={bill.id} className="flex justify-between items-center py-2 border-b border-border/50">
                                        <div className="flex items-center gap-2">
                                            {['Waste', 'Moylar Bill'].includes(bill.name) ? (
                                                <Trash2 className="w-5 h-5 text-green-500" />
                                            ) : (
                                                <Receipt className="w-5 h-5 text-purple-400" />
                                            )}
                                            <span>{bill.name === 'Waste' ? 'Moylar Bill' : bill.name}</span>
                                        </div>
                                        <span className="font-semibold">৳{bill.amount}</span>
                                    </div>
                                ))}

                                {/* Total */}
                                <div className="flex justify-between items-center pt-2">
                                    <span className="text-lg font-bold">Total</span>
                                    <span className="text-2xl font-bold text-primary">৳{invoice.total_due.toFixed(0)}</span>
                                </div>

                                {/* Payment Info */}
                                {invoice.amount_paid > 0 && (
                                    <>
                                        <div className="h-px bg-border" />
                                        <div className="flex justify-between text-sm">
                                            <span className="text-green-400">Amount Paid</span>
                                            <span className="text-green-400">৳{invoice.amount_paid}</span>
                                        </div>
                                        {dueRemaining > 0 && (
                                            <div className="flex justify-between text-sm font-semibold">
                                                <span className="text-yellow-400">Remaining Due</span>
                                                <span className="text-yellow-400">৳{dueRemaining.toFixed(0)}</span>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>

                {/* Last Reading */}
                {lastReading && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                    >
                        <Card className="card-premium mb-4">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <Zap className="w-4 h-4 text-yellow-400" />
                                    Meter Reading
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-3 gap-4 text-center">
                                    <div>
                                        <p className="text-xs text-muted-foreground mb-1">Previous</p>
                                        <p className="text-xl font-bold">{lastReading.previous_value}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground mb-1">Current</p>
                                        <p className="text-xl font-bold text-primary">{lastReading.reading_value}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground mb-1">Units Used</p>
                                        <p className="text-xl font-bold text-yellow-400">{lastReading.units}</p>
                                    </div>
                                </div>
                                <p className="text-xs text-muted-foreground text-center mt-3">
                                    Recorded: {new Date(lastReading.created_at).toLocaleDateString()}
                                </p>
                            </CardContent>
                        </Card>
                    </motion.div>
                )}

                {/* Reading history */}
                {readings.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.25 }}
                    >
                        <Card className="card-premium mb-4">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base">Reading history</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2 text-sm">
                                {readings.slice(0, 12).map((r) => (
                                    <div
                                        key={r.id}
                                        className="flex flex-wrap justify-between gap-2 border-b border-border/50 py-2 last:border-0"
                                    >
                                        <span className="text-muted-foreground">{r.month_year}</span>
                                        <span>
                                            {r.previous_value} → {r.reading_value}{' '}
                                            <span className="text-yellow-400">({r.units} u)</span>
                                        </span>
                                        <span className="font-medium">৳{r.cost.toFixed(0)}</span>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    </motion.div>
                )}

                {/* Advance Info */}
                {tenant.advance_required === 1 && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                    >
                        <Card className="card-premium">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <Banknote className="w-5 h-5 text-green-400" />
                                    Advance Deposit
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex justify-between items-center">
                                    <span className="text-muted-foreground">Status</span>
                                    {tenant.advance_paid >= tenant.advance_amount ? (
                                        <Badge variant="success">Fully Paid</Badge>
                                    ) : (
                                        <Badge variant="warning">
                                            Due: ৳{tenant.advance_amount - tenant.advance_paid}
                                        </Badge>
                                    )}
                                </div>
                                <div className="mt-3 bg-secondary/50 rounded-lg p-3">
                                    <div className="flex justify-between text-sm mb-2">
                                        <span>Required</span>
                                        <span className="font-semibold">৳{tenant.advance_amount}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span>Paid</span>
                                        <span className="font-semibold text-green-400">৳{tenant.advance_paid}</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>
                )}
            </div>

            {/* Bottom Scan Button */}
            <div className="fixed bottom-0 left-0 right-0 p-4 glass border-t border-border safe-bottom">
                <Button
                    className="w-full h-14 text-lg shadow-2xl shadow-primary/30"
                    onClick={() => router.push(`/scan/${tenantId}/`)}
                >
                    <Camera className="w-6 h-6 mr-2" />
                    Scan Meter
                </Button>
            </div>
        </main>
    );
}
