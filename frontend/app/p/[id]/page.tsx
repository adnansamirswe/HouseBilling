'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import {
    Home, Zap, Receipt, AlertCircle, Printer,
    Check, Trash2, Calendar
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getTenantDashboard, type TenantDashboard } from '@/lib/api';
import { getErrorMessage } from '@/lib/utils';

function getPastMonths(count: number): string[] {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const now = new Date();
    const result: string[] = [];
    for (let i = 0; i < count; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        result.push(`${months[d.getMonth()]}-${d.getFullYear()}`);
    }
    return result;
}

export default function PublicBillPage() {
    const params = useParams();
    const tenantId = params.id as string;

    const [bills, setBills] = useState<TenantDashboard[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadAllBills = useCallback(async () => {
        setLoading(true);
        try {
            const months = getPastMonths(4);
            const billPromises = months.map(month => 
                getTenantDashboard(parseInt(tenantId), month).catch(() => null)
            );
            const results = await Promise.all(billPromises);
            setBills(results.filter((b): b is TenantDashboard => b !== null && b.invoice !== null));
            setError(null);
        } catch (err: unknown) {
            setError(getErrorMessage(err));
        } finally {
            setLoading(false);
        }
    }, [tenantId]);

    useEffect(() => {
        loadAllBills();
    }, [loadAllBills]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="text-center">
                    <div className="spinner mx-auto mb-4" />
                    <p className="text-muted-foreground font-medium">Fetching your bills...</p>
                </div>
            </div>
        );
    }

    if (error || bills.length === 0) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4 bg-background">
                <Card className="max-w-md w-full border-red-500/20 bg-red-500/5">
                    <CardContent className="pt-6 text-center">
                        <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
                        <h2 className="text-xl font-bold mb-2">No Bills Found</h2>
                        <p className="text-muted-foreground mb-6">
                            {error || "We couldn't find any recent bills for this room."}
                        </p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const tenant = bills[0].tenant;
    const currentInvoice = bills[0].invoice;
    const displayRoom = currentInvoice?.room_number || tenant.room_number;
    const displayName = currentInvoice?.tenant_name || tenant.name;

    return (
        <main className="min-h-screen bg-background pb-12">
            {/* Header */}
            <div className="bg-primary/5 border-b border-primary/10 mb-8 sticky top-0 z-20 glass no-print">
                <div className="max-w-2xl mx-auto px-4 py-6 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center text-primary-foreground shadow-lg">
                            <Home className="w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black tracking-tight">{displayRoom}</h1>
                            <p className="text-sm text-muted-foreground font-medium">{displayName}</p>
                        </div>
                    </div>
                    <Button onClick={() => window.print()} variant="outline" className="gap-2 font-bold border-2">
                        <Printer className="w-4 h-4" />
                        Print All
                    </Button>
                </div>
            </div>

            <div className="max-w-2xl mx-auto px-4 space-y-8">
                <div className="print-only mb-8 text-center border-b-2 pb-6 hidden">
                    <h1 className="text-3xl font-black">HousBilling Report</h1>
                    <p className="text-muted-foreground mt-1">Room: {displayRoom} | Current Tenant: {displayName}</p>
                    <p className="text-sm mt-2">Generated on {new Date().toLocaleDateString()}</p>
                </div>

                {bills.map((bill, index) => (
                    <motion.div
                        key={bill.month}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="print:break-inside-avoid print:mt-8"
                    >
                        <Card className={`overflow-hidden border-2 ${index === 0 ? 'border-primary shadow-xl shadow-primary/5' : 'border-border shadow-sm'}`}>
                            <CardHeader className={`${index === 0 ? 'bg-primary/5' : 'bg-secondary/20'} border-b flex flex-row items-center justify-between`}>
                                <div className="flex flex-col">
                                    <div className="flex items-center gap-2">
                                        <Calendar className="w-5 h-5 text-primary" />
                                        <CardTitle className="text-xl font-bold">{bill.month}</CardTitle>
                                    </div>
                                    <div className="text-[10px] text-muted-foreground font-medium mt-0.5">
                                        {bill.invoice?.tenant_name || bill.tenant.name} • {bill.invoice?.room_number || bill.tenant.room_number}
                                    </div>
                                </div>
                                <Badge variant={bill.invoice?.is_fully_paid ? "success" : "destructive"} className="px-3 py-1 text-xs uppercase tracking-wider font-bold">
                                    {bill.invoice?.is_fully_paid ? 'Paid' : 'Unpaid'}
                                </Badge>
                            </CardHeader>
                            <CardContent className="pt-6">
                                <div className="space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="p-4 rounded-xl bg-secondary/30">
                                            <p className="text-xs text-muted-foreground font-bold uppercase mb-1">Monthly Rent</p>
                                            <p className="text-2xl font-black">৳{bill.invoice?.rent_amount}</p>
                                        </div>
                                        <div className="p-4 rounded-xl bg-secondary/30">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <p className="text-xs text-muted-foreground font-bold uppercase mb-1">Electricity</p>
                                                    <p className="text-2xl font-black">৳{bill.invoice?.electric_amount.toFixed(0)}</p>
                                                </div>
                                                <Zap className="w-5 h-5 text-yellow-500" />
                                            </div>
                                            {bill.lastReading && bill.lastReading.month_year === bill.month && (
                                                <p className="text-[10px] text-muted-foreground mt-2">
                                                    {bill.lastReading.units} units ({bill.lastReading.previous_value} → {bill.lastReading.reading_value})
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    {bill.otherBills.length > 0 && (
                                        <div className="border-t pt-4">
                                            <p className="text-xs text-muted-foreground font-bold uppercase mb-3">Other Charges</p>
                                            <div className="space-y-2">
                                                {bill.otherBills.map(ob => (
                                                    <div key={ob.id} className="flex justify-between items-center text-sm py-1 border-b border-dashed border-border/50">
                                                        <div className="flex items-center gap-2">
                                                            {['Waste', 'Moylar Bill'].includes(ob.name) ? <Trash2 className="w-4 h-4 text-green-600" /> : <Receipt className="w-4 h-4 text-purple-500" />}
                                                            <span className="font-medium">{ob.name === 'Waste' ? 'Moylar Bill' : ob.name}</span>
                                                        </div>
                                                        <span className="font-bold">৳{ob.amount}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <div className="border-t pt-6 mt-4 flex items-center justify-between">
                                        <div>
                                            <p className="text-xs text-muted-foreground font-bold uppercase">Total Bill</p>
                                            <p className="text-3xl font-black text-primary">৳{bill.invoice?.total_due.toFixed(0)}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs text-muted-foreground font-bold uppercase">Status</p>
                                            {bill.invoice?.is_fully_paid ? (
                                                <div className="flex items-center gap-1 text-green-600 font-bold">
                                                    <Check className="w-4 h-4" /> Paid
                                                </div>
                                            ) : (
                                                <div className="text-destructive font-black text-lg">
                                                    Due: ৳{((bill.invoice?.total_due || 0) - (bill.invoice?.amount_paid || 0)).toFixed(0)}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>
                ))}
            </div>

            <style jsx global>{`
                @media print {
                    .no-print { display: none !important; }
                    .print-only { display: block !important; }
                    body { background: white !important; padding: 0 !important; }
                    main { padding-bottom: 0 !important; }
                    .Card { border: 1px solid #eee !important; box-shadow: none !important; margin-bottom: 20px !important; }
                }
            `}</style>
        </main>
    );
}
