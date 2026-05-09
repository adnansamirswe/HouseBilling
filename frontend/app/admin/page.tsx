'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Building2, Plus, LogOut, Loader2, AlertCircle,
    ChevronLeft, ChevronRight, Check, Clock, Banknote,
    Zap, User, Home, DollarSign, FileText, Trash2, Camera, ChevronDown, Pencil, KeyRound
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { getAdminTenants, getTenantDetails, createTenant, recordPayment, updateAdvance, addOtherBill, updateOtherBill, deleteOtherBill, updateTenant, deleteTenant, recordManualReading, changeAdminPassword, type Tenant, type OtherBill } from '@/lib/api';
import { isAdminSession, clearSession } from '@/lib/session';
import { getErrorMessage } from '@/lib/utils';

type EditTenantFormState = {
    name: string;
    room_number: string;
    password: string;
    base_rent: string;
    electric_rate: string;
    advance_required: boolean;
    advance_amount: string;
    advance_paid: string;
    last_reading: string;
    amount_paid: string;
    create_new?: boolean;
};

// Compact TenantRow component with expandable details
function TenantRow({ tenant, onPayment, onAdvance, onAddBill, onScan, onEdit, onManualReading, onDelete }: {
    tenant: Tenant;
    onPayment: () => void;
    onAdvance: () => void;
    onAddBill: () => void;
    onScan: () => void;
    onEdit: () => void;
    onManualReading: () => void;
    onDelete: () => void;
}) {
    const [expanded, setExpanded] = useState(false);
    const dueAmount = (tenant.total_due || 0) - (tenant.amount_paid || 0);

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
        >
            {/* Row Header - Always Visible */}
            <div
                className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_1.5fr_1fr_1fr_80px] gap-2 items-center px-4 py-3 cursor-pointer hover:bg-secondary/30 transition-colors"
                onClick={() => setExpanded(!expanded)}
            >
                {/* Room */}
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
                        <Home className="w-4 h-4 text-primary" />
                    </div>
                    <span className="font-medium">{tenant.room_number}</span>
                </div>

                {/* Tenant Name - Hidden on mobile, shown in expanded */}
                <div className="hidden sm:block text-sm text-muted-foreground truncate">
                    {tenant.name}
                </div>

                {/* Total - Hidden on mobile */}
                <div className="hidden sm:block text-right font-medium">
                    ৳{(tenant.total_due || 0).toFixed(0)}
                </div>

                {/* Status */}
                <div className="flex justify-end sm:justify-end">
                    {tenant.invoice_id ? (
                        tenant.is_fully_paid ? (
                            <Badge variant="success" className="text-xs">
                                <Check className="w-3 h-3 mr-1" />
                                Paid
                            </Badge>
                        ) : (
                            <Badge variant="warning" className="text-xs">
                                ৳{dueAmount.toFixed(0)}
                            </Badge>
                        )
                    ) : (
                        <Badge variant="secondary" className="text-xs">-</Badge>
                    )}
                </div>

                {/* Expand Icon */}
                <div className="hidden sm:flex justify-end">
                    <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${expanded ? 'rotate-180' : ''}`} />
                </div>
            </div>

            {/* Expanded Details */}
            <AnimatePresence>
                {expanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="px-4 pb-4 pt-2 bg-secondary/20">
                            {/* Mobile: Show tenant name */}
                            <div className="sm:hidden text-sm text-muted-foreground mb-3 flex items-center gap-1">
                                <User className="w-3 h-3" />
                                {tenant.name}
                            </div>

                            {/* Bill Breakdown */}
                            {tenant.invoice_id && (
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                                    <div className="bg-background/60 rounded-lg p-3 text-center border border-border/40 shadow-sm">
                                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center justify-center gap-1 mb-1"><Home className="w-3 h-3" /> Rent</div>
                                        <div className="font-bold text-lg">৳{tenant.rent_amount || 0}</div>
                                    </div>
                                    <div className="bg-background/60 rounded-lg p-3 text-center border border-border/40 shadow-sm cursor-pointer hover:bg-secondary/50 transition-colors"
                                        onClick={(e) => { e.stopPropagation(); onManualReading(); }}>
                                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center justify-center gap-1 mb-1"><Zap className="w-3 h-3 text-yellow-500" /> Electric</div>
                                        <div className="font-bold text-lg">৳{(tenant.electric_amount || 0).toFixed(0)}</div>
                                    </div>
                                    <div className="bg-background/60 rounded-lg p-3 text-center border border-border/40 shadow-sm">
                                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center justify-center gap-1 mb-1"><FileText className="w-3 h-3" /> Others</div>
                                        <div className="font-bold text-lg">৳{tenant.other_total || 0}</div>
                                    </div>
                                    <div className="bg-background/60 rounded-lg p-3 text-center border border-border/40 shadow-sm">
                                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Paid</div>
                                        <div className="font-bold text-lg text-green-500">৳{tenant.amount_paid || 0}</div>
                                    </div>
                                </div>
                            )}

                            {/* Advance & Rate Section */}
                            <div className="space-y-3 mb-4">
                                {!!tenant.advance_required && (
                                    <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg border border-border/50">
                                        <div className="flex items-center gap-2 text-sm">
                                            <Banknote className="w-4 h-4 text-muted-foreground" />
                                            <span className="text-muted-foreground">Advance:</span>
                                            <span className="font-medium">৳{tenant.advance_paid} / ৳{tenant.advance_amount}</span>
                                            {tenant.advance_paid < tenant.advance_amount && (
                                                <span className="text-yellow-500 text-xs font-semibold">(Due: ৳{tenant.advance_amount - tenant.advance_paid})</span>
                                            )}
                                        </div>
                                        {tenant.advance_paid < tenant.advance_amount && (
                                            <Button size="sm" variant="outline" className="h-7 text-xs border-primary/20 hover:bg-primary/10 hover:text-primary" onClick={(e) => { e.stopPropagation(); onAdvance(); }}>
                                                Update
                                            </Button>
                                        )}
                                    </div>
                                )}

                                {/* Rate & Reading */}
                                <div className="flex gap-2">
                                    <Badge variant="secondary" className="bg-background/50 border border-border/50 text-muted-foreground font-normal">
                                        <Zap className="w-3 h-3 mr-1 text-yellow-500" />
                                        ৳{tenant.electric_rate}/unit
                                    </Badge>
                                    {tenant.last_reading && (
                                        <Badge variant="secondary" className="bg-background/50 border border-border/50 text-muted-foreground font-normal">
                                            Last Reading: {tenant.last_reading}
                                        </Badge>
                                    )}
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center justify-between mt-4 pt-4 border-t border-border/40">
                                <div className="flex gap-2">
                                    {tenant.invoice_id && !tenant.is_fully_paid && (
                                        <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white shadow-sm" onClick={(e) => { e.stopPropagation(); onPayment(); }}>
                                            <Banknote className="w-4 h-4 mr-2" />
                                            Payment
                                        </Button>
                                    )}
                                    <Button size="sm" variant="outline" className="shadow-sm bg-background" onClick={(e) => { e.stopPropagation(); onScan(); }}>
                                        <Camera className="w-4 h-4 mr-2" />
                                        Scan
                                    </Button>
                                    <Button size="sm" variant="outline" className="shadow-sm bg-background" onClick={(e) => { e.stopPropagation(); onAddBill(); }}>
                                        <FileText className="w-4 h-4 mr-2" />
                                        Add bill
                                    </Button>
                                    <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); onEdit(); }}>
                                        <Pencil className="w-4 h-4" />
                                    </Button>
                                        <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); window.open(`/p/${tenant.id}/`, '_blank'); }}>
                                        <FileText className="w-4 h-4 text-blue-500" />
                                    </Button>
                                </div>
                                <Button size="icon" variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={(e) => { e.stopPropagation(); onDelete(); }}>
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}

function getDefaultMonthYear(): string {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const now = new Date();
    now.setMonth(now.getMonth() - 1);
    return `${months[now.getMonth()]}-${now.getFullYear()}`;
}

function getMonthOptions(): string[] {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const now = new Date();
    const options: string[] = [];
    for (let i = -3; i <= 3; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
        options.push(`${months[d.getMonth()]}-${d.getFullYear()}`);
    }
    return options;
}

export default function AdminDashboard() {
    const router = useRouter();
    const [tenants, setTenants] = useState<Tenant[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedMonth, setSelectedMonth] = useState(getDefaultMonthYear());

    // Modal states
    const [addTenantOpen, setAddTenantOpen] = useState(false);
    const [paymentModal, setPaymentModal] = useState<Tenant | null>(null);
    const [advanceModal, setAdvanceModal] = useState<Tenant | null>(null);
    const [billModal, setBillModal] = useState<Tenant | null>(null);
    const [editModal, setEditModal] = useState<Tenant | null>(null);

    // Edit/Manual Entry form state
    const [editTenant, setEditTenant] = useState<EditTenantFormState>({
        name: '', room_number: '', password: '', base_rent: '', electric_rate: '',
        advance_required: true, advance_amount: '', advance_paid: '',
        last_reading: '', amount_paid: '', create_new: false,
    });
    const [editOtherBills, setEditOtherBills] = useState<{ id: number; name: string; amount: string; original_name: string; original_amount: number }[]>([]);
    const [newBillName, setNewBillName] = useState('');
    const [newBillAmount, setNewBillAmount] = useState('');
    const [editLoading, setEditLoading] = useState(false);
    const [manualReading, setManualReading] = useState('');
    const [meterModal, setMeterModal] = useState<Tenant | null>(null);
    const [deleteModal, setDeleteModal] = useState<Tenant | null>(null);
    const [passwordModalOpen, setPasswordModalOpen] = useState(false);
    const [oldAdminPassword, setOldAdminPassword] = useState('');
    const [newAdminPassword, setNewAdminPassword] = useState('');
    const [confirmAdminPassword, setConfirmAdminPassword] = useState('');

    // Form states
    const [newTenant, setNewTenant] = useState({
        name: '', room_number: '', password: '', base_rent: '3000', electric_rate: '9',
        advance_required: true, advance_amount: '3000',
        water_bill: '0', waste_bill: '0', initial_reading: '0'
    });
    const [paymentAmount, setPaymentAmount] = useState('');
    const [advanceAmount, setAdvanceAmount] = useState('');
    const [billName, setBillName] = useState('');
    const [billAmount, setBillAmount] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const loadTenants = useCallback(async () => {
        try {
            const data = await getAdminTenants(selectedMonth);
            setTenants(data);
            setError(null);
        } catch (err: unknown) {
            setError(getErrorMessage(err));
        } finally {
            setLoading(false);
        }
    }, [selectedMonth]);

    useEffect(() => {
        loadTenants();
    }, [loadTenants]);

    useEffect(() => {
        if (!isAdminSession()) {
            router.replace('/');
        }
    }, [router]);

    const handleCreateTenant = async () => {
        setSubmitting(true);
        try {
            await createTenant({
                name: newTenant.name,
                room_number: newTenant.room_number,
                password: newTenant.password,
                base_rent: parseInt(newTenant.base_rent) || 3000,
                electric_rate: parseFloat(newTenant.electric_rate) || 9,
                advance_required: newTenant.advance_required,
                advance_amount: newTenant.advance_required ? parseInt(newTenant.advance_amount) || 0 : 0,
                water_bill: parseInt(newTenant.water_bill) || 0,
                waste_bill: parseInt(newTenant.waste_bill) || 0,
                initial_reading: parseInt(newTenant.initial_reading) || 0,
            });
            setAddTenantOpen(false);
            setNewTenant({ name: '', room_number: '', password: '', base_rent: '3000', electric_rate: '9', advance_required: true, advance_amount: '3000', water_bill: '0', waste_bill: '0', initial_reading: '0' });
            loadTenants();
        } catch (err: unknown) {
            setError(getErrorMessage(err));
        } finally {
            setSubmitting(false);
        }
    };

    const handlePayment = async (markFull = false) => {
        if (!paymentModal?.invoice_id) return;
        setSubmitting(true);
        try {
            await recordPayment(paymentModal.invoice_id, markFull ? undefined : parseFloat(paymentAmount), markFull);
            setPaymentModal(null);
            setPaymentAmount('');
            loadTenants();
        } catch (err: unknown) {
            setError(getErrorMessage(err));
        } finally {
            setSubmitting(false);
        }
    };

    const handleAdvanceUpdate = async () => {
        if (!advanceModal) return;
        setSubmitting(true);
        try {
            await updateAdvance(advanceModal.id, parseInt(advanceAmount) || 0);
            setAdvanceModal(null);
            setAdvanceAmount('');
            loadTenants();
        } catch (err: unknown) {
            setError(getErrorMessage(err));
        } finally {
            setSubmitting(false);
        }
    };

    const handleAddBill = async () => {
        if (!billModal) return;
        setSubmitting(true);
        try {
            await addOtherBill(billModal.id, billName, parseInt(billAmount) || 0);
            setBillModal(null);
            setBillName('');
            setBillAmount('');
            loadTenants();
        } catch (err: unknown) {
            setError(getErrorMessage(err));
        } finally {
            setSubmitting(false);
        }
    };

    const handleEditTenant = async () => {
        if (!editModal) return;
        setSubmitting(true);
        try {
            // Update tenant details
            const updates: Parameters<typeof updateTenant>[1] = {
                name: editTenant.name,
                room_number: editTenant.room_number,
                base_rent: parseInt(editTenant.base_rent) || 3000,
                electric_rate: parseFloat(editTenant.electric_rate) || 9,
                advance_required: editTenant.advance_required ? 1 : 0,
                advance_amount: parseInt(editTenant.advance_amount) || 0,
                advance_paid: parseInt(editTenant.advance_paid) || 0,
                month_year: selectedMonth,
                create_new: !!editTenant.create_new,
            };
            if (editTenant.password.trim()) {
                updates.password = editTenant.password;
            }
            await updateTenant(editModal.id, updates);

            // Update meter reading if changed
            const newReading = parseInt(editTenant.last_reading);
            if (!isNaN(newReading) && newReading !== (editModal.last_reading || 0)) {
                await recordManualReading(editModal.id, newReading, selectedMonth);
            }

            // Update existing other bills & add new ones from the list
            for (const bill of editOtherBills) {
                const newAmount = parseInt(bill.amount) || 0;
                if (bill.id < 0) {
                    // Newly added bill (has negative temp ID)
                    if (newAmount > 0) {
                        await addOtherBill(editModal.id, bill.name, newAmount, false, selectedMonth);
                    }
                } else if (newAmount === 0) {
                    // Delete bills with 0 amount
                    await deleteOtherBill(bill.id);
                } else if (newAmount !== bill.original_amount || bill.name !== bill.original_name) {
                    await updateOtherBill(bill.id, { name: bill.name, amount: newAmount });
                }
            }

            // Add new bill if provided
            if (newBillName.trim() && parseInt(newBillAmount) > 0) {
                await addOtherBill(editModal.id, newBillName.trim(), parseInt(newBillAmount), false, selectedMonth);
            }

            // Update payment amount if changed and invoice exists
            const newPaid = parseInt(editTenant.amount_paid) || 0;
            if (editModal.invoice_id && newPaid !== (editModal.amount_paid || 0)) {
                await recordPayment(editModal.invoice_id, newPaid);
            }

            setEditModal(null);
            loadTenants();
        } catch (err: unknown) {
            setError(getErrorMessage(err));
        } finally {
            setSubmitting(false);
        }
    };

    const handleManualReading = async () => {
        if (!meterModal) return;
        setSubmitting(true);
        try {
            await recordManualReading(meterModal.id, parseInt(manualReading), selectedMonth);
            setMeterModal(null);
            setManualReading('');
            loadTenants();
        } catch (err: unknown) {
            setError(getErrorMessage(err));
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteTenant = async () => {
        if (!deleteModal) return;
        setSubmitting(true);
        try {
            await deleteTenant(deleteModal.id);
            setDeleteModal(null);
            loadTenants();
        } catch (err: unknown) {
            setError(getErrorMessage(err));
        } finally {
            setSubmitting(false);
        }
    };

    const handleChangeAdminPassword = async () => {
        if (newAdminPassword !== confirmAdminPassword) {
            setError('New passwords do not match');
            return;
        }
        if (newAdminPassword.length < 4) {
            setError('New password must be at least 4 characters');
            return;
        }
        setSubmitting(true);
        try {
            await changeAdminPassword(oldAdminPassword, newAdminPassword);
            setPasswordModalOpen(false);
            setOldAdminPassword('');
            setNewAdminPassword('');
            setConfirmAdminPassword('');
            setError(null);
        } catch (err: unknown) {
            setError(getErrorMessage(err));
        } finally {
            setSubmitting(false);
        }
    };

    const monthOptions = getMonthOptions();
    const monthIndex = monthOptions.indexOf(selectedMonth);

    // Summary calculations
    const totalDue = tenants.reduce((sum, t) => sum + (t.total_due || 0), 0);
    const totalPaid = tenants.reduce((sum, t) => sum + (t.amount_paid || 0), 0);
    const totalPending = totalDue - totalPaid;

    return (
        <main className="min-h-screen pb-6">
            {/* Header */}
            <header className="sticky top-0 z-20 glass border-b border-border safe-bottom">
                <div className="px-4 py-4">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                                <Building2 className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                                <h1 className="text-lg font-bold">Admin Dashboard</h1>
                                <p className="text-xs text-muted-foreground">Manage your rentals</p>
                            </div>
                        </div>
                        <Button variant="ghost" size="icon" title="Change admin password" onClick={() => {
                            setPasswordModalOpen(true);
                            setOldAdminPassword('');
                            setNewAdminPassword('');
                            setConfirmAdminPassword('');
                        }}>
                            <KeyRound className="w-5 h-5" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => { clearSession(); router.push('/'); }}>
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

            <div className="px-4 pt-4">
                {/* Summary Cards */}
                <div className="grid grid-cols-3 gap-3 mb-6">
                    <Card className="card-premium">
                        <CardContent className="p-4 text-center">
                            <DollarSign className="w-5 h-5 text-muted-foreground mx-auto mb-1" />
                            <p className="text-xs text-muted-foreground">Total Due</p>
                            <p className="text-lg font-bold">৳{totalDue.toFixed(0)}</p>
                        </CardContent>
                    </Card>
                    <Card className="card-premium">
                        <CardContent className="p-4 text-center">
                            <Check className="w-5 h-5 text-green-400 mx-auto mb-1" />
                            <p className="text-xs text-muted-foreground">Paid</p>
                            <p className="text-lg font-bold text-green-400">৳{totalPaid.toFixed(0)}</p>
                        </CardContent>
                    </Card>
                    <Card className="card-premium">
                        <CardContent className="p-4 text-center">
                            <Clock className="w-5 h-5 text-yellow-400 mx-auto mb-1" />
                            <p className="text-xs text-muted-foreground">Pending</p>
                            <p className="text-lg font-bold text-yellow-400">৳{totalPending.toFixed(0)}</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Error */}
                {error && (
                    <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/30 flex items-center gap-2 text-sm text-destructive">
                        <AlertCircle className="w-4 h-4" />
                        {error}
                    </div>
                )}

                {/* Loading */}
                {loading && (
                    <div className="flex flex-col items-center justify-center py-12">
                        <div className="spinner mb-4" />
                        <p className="text-muted-foreground">Loading...</p>
                    </div>
                )}

                {/* Tenant Table */}
                <Card className="card-premium overflow-hidden">
                    {/* Table Header */}
                    <div className="hidden sm:grid sm:grid-cols-[1fr_1.5fr_1fr_1fr_80px] gap-2 px-4 py-3 bg-secondary/50 text-xs font-medium text-muted-foreground border-b border-border">
                        <span>Room</span>
                        <span>Tenant</span>
                        <span className="text-right">Total</span>
                        <span className="text-right">Status</span>
                        <span></span>
                    </div>

                    {/* Tenant Rows */}
                    <div className="divide-y divide-border">
                        <AnimatePresence>
                            {tenants.map((tenant) => (
                                <TenantRow
                                    key={tenant.id}
                                    tenant={tenant}
                                    onPayment={() => { setPaymentModal(tenant); setPaymentAmount(''); }}
                                    onAdvance={() => { setAdvanceModal(tenant); setAdvanceAmount(tenant.advance_paid.toString()); }}
                                    onAddBill={() => setBillModal(tenant)}
                                    onScan={() => router.push(`/scan/${tenant.id}/`)}
                                    onEdit={async () => {
                                        setEditModal(tenant);
                                        setEditTenant({
                                            name: tenant.name,
                                            room_number: tenant.room_number,
                                            password: '',
                                            base_rent: tenant.base_rent.toString(),
                                            electric_rate: tenant.electric_rate.toString(),
                                            advance_required: !!tenant.advance_required,
                                            advance_amount: (tenant.advance_amount || 0).toString(),
                                            advance_paid: (tenant.advance_paid || 0).toString(),
                                            last_reading: (tenant.last_reading || 0).toString(),
                                            amount_paid: (tenant.amount_paid || 0).toString(),
                                            create_new: false,
                                        });
                                        setEditOtherBills([]);
                                        setNewBillName('');
                                        setNewBillAmount('');
                                        // Fetch other bills for this tenant
                                        try {
                                            setEditLoading(true);
                                            const details = await getTenantDetails(tenant.id, selectedMonth);
                                            if (details.otherBills) {
                                                setEditOtherBills(details.otherBills.map((b: OtherBill) => ({
                                                    id: b.id,
                                                    name: b.name,
                                                    amount: b.amount.toString(),
                                                    original_name: b.name,
                                                    original_amount: b.amount,
                                                })));
                                            }
                                        } catch { /* ignore */ } finally {
                                            setEditLoading(false);
                                        }
                                    }}
                                    onManualReading={() => { setMeterModal(tenant); setManualReading(''); }}
                                    onDelete={() => setDeleteModal(tenant)}
                                />
                            ))}
                        </AnimatePresence>
                    </div>
                </Card>

                {/* Empty State */}
                {!loading && tenants.length === 0 && (
                    <div className="text-center py-12">
                        <Home className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                        <p className="text-muted-foreground mb-4">No tenants yet</p>
                        <Button onClick={() => setAddTenantOpen(true)}>
                            <Plus className="w-4 h-4" />
                            Add First Tenant
                        </Button>
                    </div>
                )}

                {/* FAB */}
                <Button
                    className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-2xl shadow-primary/30"
                    size="icon"
                    onClick={() => setAddTenantOpen(true)}
                >
                    <Plus className="w-6 h-6" />
                </Button>
            </div>

            {/* Add Tenant Modal */}
            <Dialog open={addTenantOpen} onOpenChange={setAddTenantOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add New Tenant</DialogTitle>
                        <DialogDescription>Enter tenant details and billing settings</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <Input label="Name" placeholder="Tenant name" value={newTenant.name} onChange={(e) => setNewTenant({ ...newTenant, name: e.target.value })} />
                        <Input label="Room Number" placeholder="e.g., Room 3" value={newTenant.room_number} onChange={(e) => setNewTenant({ ...newTenant, room_number: e.target.value })} />
                        <Input label="Password" placeholder="Login password" value={newTenant.password} onChange={(e) => setNewTenant({ ...newTenant, password: e.target.value })} />
                        <div className="grid grid-cols-2 gap-4">
                            <Input label="Base Rent (৳)" type="number" value={newTenant.base_rent} onChange={(e) => setNewTenant({ ...newTenant, base_rent: e.target.value })} />
                            <Input label="Electric Rate (৳/unit)" type="number" step="0.1" value={newTenant.electric_rate} onChange={(e) => setNewTenant({ ...newTenant, electric_rate: e.target.value })} />
                        </div>

                        {/* Other Bills */}
                        <div className="border-t border-border pt-4">
                            <p className="text-sm font-medium mb-3 flex items-center gap-2">
                                <FileText className="w-4 h-4" />
                                Monthly Other Bills
                            </p>
                            <div className="grid grid-cols-2 gap-4">
                                <Input label="Water (৳)" type="number" value={newTenant.water_bill} onChange={(e) => setNewTenant({ ...newTenant, water_bill: e.target.value })} />
                                <Input label="Waste (৳)" type="number" value={newTenant.waste_bill} onChange={(e) => setNewTenant({ ...newTenant, waste_bill: e.target.value })} />
                            </div>
                        </div>

                        {/* Initial Meter Reading */}
                        <div className="border-t border-border pt-4">
                            <p className="text-sm font-medium mb-3 flex items-center gap-2">
                                <Zap className="w-4 h-4 text-yellow-400" />
                                Initial Meter Reading
                            </p>
                            <Input label="Current Meter Units" type="number" placeholder="Enter current meter reading" value={newTenant.initial_reading} onChange={(e) => setNewTenant({ ...newTenant, initial_reading: e.target.value })} />
                            <p className="text-xs text-muted-foreground mt-1">The meter reading when tenant moves in. Used to calculate electricity consumption.</p>
                        </div>

                        {/* Advance */}
                        <div className="flex items-center gap-3">
                            <input type="checkbox" id="advance" checked={newTenant.advance_required} onChange={(e) => setNewTenant({ ...newTenant, advance_required: e.target.checked })} className="w-5 h-5 rounded accent-primary" />
                            <label htmlFor="advance" className="text-sm">Advance Required</label>
                        </div>
                        {newTenant.advance_required && (
                            <Input label="Advance Amount (৳)" type="number" value={newTenant.advance_amount} onChange={(e) => setNewTenant({ ...newTenant, advance_amount: e.target.value })} />
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setAddTenantOpen(false)}>Cancel</Button>
                        <Button onClick={handleCreateTenant} disabled={submitting}>
                            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add Tenant'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Payment Modal */}
            <Dialog open={!!paymentModal} onOpenChange={() => setPaymentModal(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Record Payment</DialogTitle>
                        <DialogDescription>{paymentModal?.room_number} - {paymentModal?.name}</DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <p className="text-sm text-muted-foreground mb-2">
                            Total Due: <span className="text-foreground font-semibold">৳{paymentModal?.total_due?.toFixed(0)}</span>
                        </p>
                        <p className="text-sm text-muted-foreground mb-4">
                            Already Paid: <span className="text-foreground font-semibold">৳{paymentModal?.amount_paid || 0}</span>
                        </p>
                        <Input label="Payment Amount (৳)" type="number" placeholder="Enter amount" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => handlePayment(true)} disabled={submitting}>
                            Mark Full Paid
                        </Button>
                        <Button onClick={() => handlePayment(false)} disabled={submitting || !paymentAmount}>
                            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Record Partial'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Advance Modal */}
            <Dialog open={!!advanceModal} onOpenChange={() => setAdvanceModal(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Update Advance</DialogTitle>
                        <DialogDescription>{advanceModal?.room_number} - {advanceModal?.name}</DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <p className="text-sm text-muted-foreground mb-4">
                            Required: ৳{advanceModal?.advance_amount} | Current: ৳{advanceModal?.advance_paid}
                        </p>
                        <Input label="New Paid Amount (৳)" type="number" value={advanceAmount} onChange={(e) => setAdvanceAmount(e.target.value)} />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setAdvanceModal(null)}>Cancel</Button>
                        <Button onClick={handleAdvanceUpdate} disabled={submitting}>
                            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Update'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Add Bill Modal */}
            <Dialog open={!!billModal} onOpenChange={() => setBillModal(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add Other Bill</DialogTitle>
                        <DialogDescription>{billModal?.room_number} - {billModal?.name}</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <Input label="Bill Name" placeholder="e.g., Water, Waste, Late Fee" value={billName} onChange={(e) => setBillName(e.target.value)} />
                        <Input label="Amount (৳)" type="number" placeholder="Enter amount" value={billAmount} onChange={(e) => setBillAmount(e.target.value)} />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setBillModal(null)}>Cancel</Button>
                        <Button onClick={handleAddBill} disabled={submitting || !billName || !billAmount}>
                            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add Bill'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Tenant Modal */}
            <Dialog open={!!editModal} onOpenChange={() => setEditModal(null)}>
                <DialogContent className="max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Edit Tenant</DialogTitle>
                        <DialogDescription>Update all tenant details and billing settings</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        {/* Basic Info */}
                        <Input label="Name" placeholder="Tenant name" value={editTenant.name} onChange={(e) => setEditTenant({ ...editTenant, name: e.target.value })} />
                        <Input label="Room Number" placeholder="Room/Unit" value={editTenant.room_number} onChange={(e) => setEditTenant({ ...editTenant, room_number: e.target.value })} />
                        <Input label="Password" placeholder="Leave blank to keep current" type="password" value={editTenant.password} onChange={(e) => setEditTenant({ ...editTenant, password: e.target.value })} />

                        {/* Rent & Rates */}
                        <div className="border-t border-border pt-4">
                            <p className="text-sm font-medium mb-3 flex items-center gap-2">
                                <DollarSign className="w-4 h-4" />
                                Rent & Rates
                            </p>
                            <div className="grid grid-cols-2 gap-4">
                                <Input label="Base Rent (৳)" type="number" value={editTenant.base_rent} onChange={(e) => setEditTenant({ ...editTenant, base_rent: e.target.value })} />
                                <Input label="Electric Rate (৳/unit)" type="number" step="0.1" value={editTenant.electric_rate} onChange={(e) => setEditTenant({ ...editTenant, electric_rate: e.target.value })} />
                            </div>
                        </div>

                        {/* Meter Reading */}
                        <div className="border-t border-border pt-4">
                            <p className="text-sm font-medium mb-3 flex items-center gap-2">
                                <Zap className="w-4 h-4 text-yellow-400" />
                                Meter Reading
                            </p>
                            <Input label="Last Reading (units)" type="number" placeholder="Current meter reading" value={editTenant.last_reading} onChange={(e) => setEditTenant({ ...editTenant, last_reading: e.target.value })} />
                            <p className="text-xs text-muted-foreground mt-1">Changing this will recalculate the electric bill for {selectedMonth}.</p>
                        </div>

                        {/* Other Bills */}
                        <div className="border-t border-border pt-4">
                            <p className="text-sm font-medium mb-3 flex items-center gap-2">
                                <FileText className="w-4 h-4" />
                                Other Bills ({selectedMonth})
                            </p>
                            {editLoading ? (
                                <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                                    <Loader2 className="w-4 h-4 animate-spin" /> Loading bills...
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {editOtherBills.length === 0 && (
                                        <p className="text-xs text-muted-foreground">No other bills for this month.</p>
                                    )}
                                    {editOtherBills.map((bill, idx) => (
                                        <div key={bill.id} className="flex items-end gap-2">
                                            <div className="flex-1">
                                                <Input label={idx === 0 ? 'Bill Name' : undefined} value={bill.name} onChange={(e) => {
                                                    const updated = [...editOtherBills];
                                                    updated[idx] = { ...updated[idx], name: e.target.value };
                                                    setEditOtherBills(updated);
                                                }} />
                                            </div>
                                            <div className="w-28">
                                                <Input label={idx === 0 ? 'Amount (৳)' : undefined} type="number" value={bill.amount} onChange={(e) => {
                                                    const updated = [...editOtherBills];
                                                    updated[idx] = { ...updated[idx], amount: e.target.value };
                                                    setEditOtherBills(updated);
                                                }} />
                                            </div>
                                            <Button size="icon" variant="ghost" className="text-destructive hover:bg-destructive/10 shrink-0 mb-0.5" onClick={() => {
                                                const updated = [...editOtherBills];
                                                updated[idx] = { ...updated[idx], amount: '0' };
                                                setEditOtherBills(updated);
                                            }}>
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    ))}

                                    {/* Add New Bill */}
                                    <div className="pt-2 border-t border-border/50">
                                        <p className="text-xs text-muted-foreground mb-2">Add new bill</p>
                                        <div className="flex items-end gap-2">
                                            <div className="flex-1">
                                                <Input placeholder="e.g., Water, Waste" value={newBillName} onChange={(e) => setNewBillName(e.target.value)} />
                                            </div>
                                            <div className="w-28">
                                                <Input type="number" placeholder="Amount" value={newBillAmount} onChange={(e) => setNewBillAmount(e.target.value)} />
                                            </div>
                                            <Button size="icon" variant="outline" className="shrink-0 mb-0.5" disabled={!newBillName.trim() || !newBillAmount} onClick={() => {
                                                setEditOtherBills([...editOtherBills, { id: -(Date.now()), name: newBillName.trim(), amount: newBillAmount, original_name: '', original_amount: 0 }]);
                                                setNewBillName('');
                                                setNewBillAmount('');
                                            }}>
                                                <Plus className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Payment */}
                        {editModal?.invoice_id && (
                            <div className="border-t border-border pt-4">
                                <p className="text-sm font-medium mb-3 flex items-center gap-2">
                                    <Check className="w-4 h-4 text-green-500" />
                                    Payment ({selectedMonth})
                                </p>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-xs text-muted-foreground mb-1">Total Due</p>
                                        <p className="text-lg font-bold">৳{editModal?.total_due?.toFixed(0) || 0}</p>
                                    </div>
                                    <Input label="Amount Paid (৳)" type="number" value={editTenant.amount_paid} onChange={(e) => setEditTenant({ ...editTenant, amount_paid: e.target.value })} />
                                </div>
                            </div>
                        )}

                        {/* Advance Settings */}
                        <div className="border-t border-border pt-4">
                            <p className="text-sm font-medium mb-3 flex items-center gap-2">
                                <Banknote className="w-4 h-4" />
                                Advance Settings
                            </p>
                            <div className="flex items-center gap-3 mb-3">
                                <input type="checkbox" id="edit-advance" checked={editTenant.advance_required} onChange={(e) => setEditTenant({ ...editTenant, advance_required: e.target.checked })} className="w-5 h-5 rounded accent-primary" />
                                <label htmlFor="edit-advance" className="text-sm">Advance Required</label>
                            </div>
                            {editTenant.advance_required && (
                                <div className="grid grid-cols-2 gap-4">
                                    <Input label="Advance Amount (৳)" type="number" value={editTenant.advance_amount} onChange={(e) => setEditTenant({ ...editTenant, advance_amount: e.target.value })} />
                                    <Input label="Advance Paid (৳)" type="number" value={editTenant.advance_paid} onChange={(e) => setEditTenant({ ...editTenant, advance_paid: e.target.value })} />
                                </div>
                            )}
                        </div>
                        <div className="flex items-center gap-3 bg-primary/5 p-3 rounded-lg border border-primary/20">
                            <input 
                                type="checkbox" 
                                id="createNew" 
                                checked={!!editTenant.create_new}
                                onChange={(e) => setEditTenant({ ...editTenant, create_new: e.target.checked })}
                                className="w-5 h-5 rounded accent-primary" 
                            />
                            <div className="flex-1">
                                <label htmlFor="createNew" className="text-sm font-bold block">New Tenant Moved In?</label>
                                <p className="text-[10px] text-muted-foreground">This will archive the current tenant and create a new one with these details, keeping historical records separate.</p>
                            </div>
                        </div>

                    </div>
                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => setEditModal(null)}>Cancel</Button>
                        <Button onClick={handleEditTenant} disabled={submitting}>
                            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : editTenant.create_new ? 'Create New & Archive' : 'Save Changes'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Manual Reading Modal */}
            <Dialog open={!!meterModal} onOpenChange={() => setMeterModal(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Manual Meter Reading</DialogTitle>
                        <DialogDescription>{meterModal?.room_number} - {meterModal?.name}</DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Input label="New Meter Reading" type="number" placeholder="Enter current reading" value={manualReading} onChange={(e) => setManualReading(e.target.value)} />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setMeterModal(null)}>Cancel</Button>
                        <Button onClick={handleManualReading} disabled={submitting || !manualReading}>
                            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Reading'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={passwordModalOpen} onOpenChange={setPasswordModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Change admin password</DialogTitle>
                        <DialogDescription>Updates the landlord login password stored on the server.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <Input label="Current password" type="password" value={oldAdminPassword} onChange={(e) => setOldAdminPassword(e.target.value)} />
                        <Input label="New password" type="password" value={newAdminPassword} onChange={(e) => setNewAdminPassword(e.target.value)} />
                        <Input label="Confirm new password" type="password" value={confirmAdminPassword} onChange={(e) => setConfirmAdminPassword(e.target.value)} />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setPasswordModalOpen(false)}>Cancel</Button>
                        <Button
                            onClick={handleChangeAdminPassword}
                            disabled={submitting || !oldAdminPassword || !newAdminPassword || !confirmAdminPassword}
                        >
                            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Update password'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Modal */}
            <Dialog open={!!deleteModal} onOpenChange={() => setDeleteModal(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Tenant</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete {deleteModal?.name} ({deleteModal?.room_number})?
                            This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteModal(null)}>Cancel</Button>
                        <Button variant="destructive" className="bg-red-500 hover:bg-red-600 text-white" onClick={handleDeleteTenant} disabled={submitting}>
                            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Delete Tenant'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </main>
    );
}
