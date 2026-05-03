import { useState, useEffect, useRef } from 'react';
import { getPurchaseOrders, getPurchaseOrderById, clearPurchaseOrdersCache } from '@/Backend/PurchaseOrders';
import type { PurchaseOrder, PurchaseOrderDetail, PurchaseOrderPart, PurchaseOrderStatus } from '@/Backend/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type View = 'list' | 'detail';

const STATUS_FILTERS: { value: PurchaseOrderStatus | ''; label: string }[] = [
    { value: '', label: 'All' },
    { value: 'DRAFT', label: 'Draft' },
    { value: 'SENT_FOR_APPROVAL', label: 'Pending Approval' },
    { value: 'APPROVED', label: 'Approved' },
    { value: 'CONFIRMED', label: 'Confirmed' },
    { value: 'PARTIALLY_RECEIVED', label: 'Partial' },
    { value: 'FULLY_RECEIVED', label: 'Received' },
];

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatStatus(status: string): string {
    return status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function formatDate(dates: string[] | undefined): string {
    if (!dates?.length) return '—';
    return dates[0];
}

function formatCost(cost: number, currency: string): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD' }).format(cost);
}

function statusVariant(status: PurchaseOrderStatus): 'default' | 'secondary' | 'outline' {
    if (status === 'FULLY_RECEIVED' || status === 'CONFIRMED') return 'default';
    if (status === 'APPROVED' || status === 'PARTIALLY_RECEIVED') return 'secondary';
    return 'outline';
}

// ── Small shared components ────────────────────────────────────────────────────

function Spinner() {
    return (
        <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin inline-block shrink-0" />
    );
}

function StatusBadge({ status }: { status: PurchaseOrderStatus }) {
    return (
        <Badge variant={statusVariant(status)}>
            {formatStatus(status)}
        </Badge>
    );
}

function Stat({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
            <p className="text-sm font-medium text-foreground">{value}</p>
        </div>
    );
}

function ErrorBanner({ message }: { message: string }) {
    return (
        <div className="flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-mono bg-destructive/10 border-destructive/30 text-destructive">
            <span className="text-xs">●</span>
            {message}
        </div>
    );
}

// ── Filter bar ─────────────────────────────────────────────────────────────────

interface StatusFilterBarProps {
    active: PurchaseOrderStatus | '';
    loading: boolean;
    cooldown: boolean;
    onChange: (status: PurchaseOrderStatus | '') => void;
    onRefresh: () => void;
}

function StatusFilterBar({ active, loading, cooldown, onChange, onRefresh }: StatusFilterBarProps) {
    return (
        <div className="flex items-center justify-between gap-4 mb-6">
            <div className="flex flex-wrap gap-1.5">
                {STATUS_FILTERS.map(opt => (
                    <button
                        key={opt.value}
                        onClick={() => onChange(opt.value as PurchaseOrderStatus | '')}
                        className={cn(
                            'px-3 py-1 rounded-full text-xs font-medium transition-colors border',
                            active === opt.value
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'bg-background text-muted-foreground border-border hover:bg-accent hover:text-accent-foreground'
                        )}
                    >
                        {opt.label}
                    </button>
                ))}
            </div>
            <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading || cooldown}>
                {loading ? <Spinner /> : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="23 4 23 10 17 10" />
                        <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                    </svg>
                )}
                {cooldown ? 'Please wait…' : 'Refresh'}
            </Button>
        </div>
    );
}

// ── Order list card ────────────────────────────────────────────────────────────

interface OrderCardProps {
    order: PurchaseOrder;
    disabled: boolean;
    onClick: (order: PurchaseOrder) => void;
}

function OrderCard({ order, disabled, onClick }: OrderCardProps) {
    return (
        <Card
            className="cursor-pointer transition-colors hover:bg-accent hover:border-primary"
            onClick={() => !disabled && onClick(order)}
        >
            <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <p className="text-sm font-medium text-foreground truncate">{order.reference}</p>
                            <StatusBadge status={order.order_status} />
                        </div>
                        <p className="text-xs text-muted-foreground">{order.supplier_name}</p>
                        <div className="flex gap-4 mt-2 text-xs text-muted-foreground font-mono">
                            <span>Delivery: {formatDate(order.delivery_date)}</span>
                            {order.warehouse_names?.length > 0 && (
                                <span>{order.warehouse_names.join(', ')}</span>
                            )}
                        </div>
                    </div>
                    <div className="text-right shrink-0">
                        <p className="text-sm font-semibold text-foreground">
                            {formatCost(order.cost, order.currency)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                            {order.quantity_received} / {order.quantity_confirmed} received
                        </p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

// ── Line item card ─────────────────────────────────────────────────────────────

function LineItemCard({ part, currency }: { part: PurchaseOrderPart; currency: string }) {
    return (
        <Card>
            <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{part.product_name}</p>
                        <p className="text-xs text-muted-foreground font-mono mt-0.5">{part.sku_name}</p>
                        <div className="flex gap-4 mt-2 text-xs text-muted-foreground font-mono">
                            <span>Confirmed: {part.quantity_confirmed}</span>
                            <span>Received: {part.received}</span>
                            {part.in_transit > 0 && <span>In Transit: {part.in_transit}</span>}
                        </div>
                    </div>
                    <div className="text-right shrink-0">
                        <p className="text-sm font-semibold text-foreground">
                            {formatCost(part.total_cost, currency)}
                        </p>
                        {part.is_closed && (
                            <p className="text-xs text-muted-foreground mt-1">Closed</p>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

// ── Detail view ────────────────────────────────────────────────────────────────

function OrderDetail({ order, onBack }: { order: PurchaseOrderDetail; onBack: () => void }) {
    return (
        <div className="p-8 max-w-4xl">
            <button
                onClick={onBack}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
            >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 18 9 12 15 6" />
                </svg>
                Back to orders
            </button>

            <Card className="mb-6">
                <CardHeader className="border-b px-6 py-5">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <p className="text-xs font-mono font-medium text-muted-foreground uppercase tracking-widest mb-1">
                                Purchase Order
                            </p>
                            <h2 className="text-xl font-semibold text-foreground tracking-tight">{order.reference}</h2>
                            <p className="text-xs text-muted-foreground mt-1">{order.supplier_name}</p>
                        </div>
                        <StatusBadge status={order.order_status} />
                    </div>
                </CardHeader>
                <CardContent className="px-6 py-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <Stat label="Total Cost" value={formatCost(order.cost, order.currency)} />
                        <Stat label="Qty Confirmed" value={String(order.quantity_confirmed)} />
                        <Stat label="Qty Received" value={String((order.order_parts ?? []).reduce((sum, p) => sum + p.received, 0))} />
                        <Stat label="Delivery" value={formatDate(order.delivery_date)} />
                    </div>
                </CardContent>
            </Card>

            <p className="text-xs font-mono font-medium text-muted-foreground uppercase tracking-widest mb-3">
                Line Items ({order.order_parts?.length ?? 0})
            </p>
            <div className="space-y-2">
                {(order.order_parts ?? []).map((part, i) => (
                    <LineItemCard key={i} part={part} currency={order.currency} />
                ))}
            </div>
        </div>
    );
}

// ── Main view ──────────────────────────────────────────────────────────────────

export default function PurchaseOrders() {
    const [view, setView] = useState<View>('list');
    const [orders, setOrders] = useState<PurchaseOrder[]>([]);
    const [selectedOrder, setSelectedOrder] = useState<PurchaseOrderDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadingDetail, setLoadingDetail] = useState(false);
    const [error, setError] = useState('');
    const [filterStatus, setFilterStatus] = useState<PurchaseOrderStatus | ''>('');
    const [refreshCooldown, setRefreshCooldown] = useState(false);
    const cooldownTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const fetchOrders = async (forceRefresh = false) => {
        if (forceRefresh) {
            clearPurchaseOrdersCache();
            setRefreshCooldown(true);
            if (cooldownTimer.current) clearTimeout(cooldownTimer.current);
            cooldownTimer.current = setTimeout(() => setRefreshCooldown(false), 5000);
        }
        setLoading(true);
        setError('');
        try {
            const params = filterStatus ? { order_status: filterStatus } : {};
            const res = await getPurchaseOrders(params);
            const sorted = (res.data ?? []).sort((a, b) => {
                const aFull = a.order_status === 'FULLY_RECEIVED' ? 1 : 0;
                const bFull = b.order_status === 'FULLY_RECEIVED' ? 1 : 0;
                return aFull - bFull;
            });
            setOrders(sorted);
        } catch {
            setError('Failed to load purchase orders. Check your API key.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchOrders(); }, [filterStatus]);

    const handleOrderClick = async (order: PurchaseOrder) => {
        setLoadingDetail(true);
        setError('');
        try {
            const detail = await getPurchaseOrderById(order.id);
            setSelectedOrder(detail);
            setView('detail');
        } catch {
            setError('Failed to load order details.');
        } finally {
            setLoadingDetail(false);
        }
    };

    if (view === 'detail' && selectedOrder) {
        return <OrderDetail order={selectedOrder} onBack={() => { setView('list'); setSelectedOrder(null); }} />;
    }

    return (
        <div className="p-8 max-w-4xl">
            <StatusFilterBar
                active={filterStatus}
                loading={loading}
                cooldown={refreshCooldown}
                onChange={setFilterStatus}
                onRefresh={() => fetchOrders(true)}
            />

            {loading ? (
                <div className="flex items-center justify-center py-16 text-muted-foreground text-sm gap-2">
                    <Spinner />
                    Loading purchase orders…
                </div>
            ) : error ? (
                <ErrorBanner message={error} />
            ) : orders.length === 0 ? (
                <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
                    No purchase orders found.
                </div>
            ) : (
                <div className="space-y-2">
                    {orders.map(order => (
                        <OrderCard
                            key={order.id}
                            order={order}
                            disabled={loadingDetail}
                            onClick={handleOrderClick}
                        />
                    ))}
                </div>
            )}

            {loadingDetail && (
                <div className="fixed inset-0 bg-background/60 flex items-center justify-center z-50">
                    <div className="flex items-center gap-2 text-sm text-foreground bg-card border border-border rounded-xl px-5 py-3 shadow-sm">
                        <Spinner />
                        Loading order…
                    </div>
                </div>
            )}
        </div>
    );
}
