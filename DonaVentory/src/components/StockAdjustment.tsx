import { useState, useEffect } from 'react';
import { searchAllStock, prefillStockCache, adjustStockBatch } from '@/Backend/StockAdjustment';
import type { SKU } from '@/Backend/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { X, ArrowLeft, ClipboardList } from 'lucide-react';
import SuccessCard from '@/components/SuccessCard';

type View = 'search' | 'checkout' | 'success';

function Spinner() {
    return (
        <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin inline-block shrink-0" />
    );
}

export default function StockAdjustment() {
    const [view, setView] = useState<View>('search');
    const [prefilling, setPrefilling] = useState(true);
    const [prefillError, setPrefillError] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [results, setResults] = useState<SKU[]>([]);
    const [searching, setSearching] = useState(false);
    const [cart, setCart] = useState<Map<string, SKU>>(new Map());
    const [targets, setTargets] = useState<Map<string, string>>(new Map());
    const [firstName, setFirstName] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState('');
    const [fieldErrors, setFieldErrors] = useState(false);
    const [successMsg, setSuccessMsg] = useState('');

    // Prefill cache on mount
    useEffect(() => {
        prefillStockCache()
            .catch((error: unknown) => setPrefillError(`Failed to load inventory: ${error instanceof Error ? error.message : String(error)}`))
            .finally(() => setPrefilling(false));
    }, []);

    const handleSearch = async () => {
        if (!searchTerm || searching) return;
        setSearching(true);
        try {
            const data = await searchAllStock(searchTerm);
            setResults(data);
        } finally {
            setSearching(false);
        }
    };

    const toggleCart = (sku: SKU) => {
        setCart(prev => {
            const next = new Map(prev);
            if (next.has(sku.sku_id)) { next.delete(sku.sku_id); } else { next.set(sku.sku_id, sku); }
            return next;
        });
    };

    const removeFromCart = (skuId: string) => {
        setCart(prev => { const next = new Map(prev); next.delete(skuId); return next; });
        setTargets(prev => { const next = new Map(prev); next.delete(skuId); return next; });
    };

    const setTarget = (skuId: string, val: string) => {
        setTargets(prev => new Map(prev).set(skuId, val));
        if (val !== '' && Number(val) >= 0) setFieldErrors(false);
    };

    const handleSubmit = async () => {
        const cartItems = Array.from(cart.values());
        const hasInvalid = cartItems.some(sku => {
            const val = targets.get(sku.sku_id) ?? '';
            return val === '' || Number(val) < 0;
        });

        if (!firstName || hasInvalid) {
            setFieldErrors(true);
            setSubmitError(!firstName ? 'Your name is required.' : 'All quantities are required and must be non-negative.');
            return;
        }

        const items = cartItems.map(sku => ({
            sku,
            targetAmount: Number(targets.get(sku.sku_id)),
        }));

        setFieldErrors(false);
        setSubmitError('');
        setSubmitting(true);

        try {
            await adjustStockBatch(items, firstName);
            setSuccessMsg(`Updated stock for ${items.length} product${items.length !== 1 ? 's' : ''}.`);
            setView('success');
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Failed to submit adjustment.';
            setSubmitError(msg);
        } finally {
            setSubmitting(false);
        }
    };

    const handleReset = () => {
        setCart(new Map());
        setTargets(new Map());
        setResults([]);
        setSearchTerm('');
        setFirstName('');
        setSubmitError('');
        setFieldErrors(false);
        setView('search');
    };

    if (view === 'success') {
        return <SuccessCard message={successMsg} onReset={handleReset} resetLabel="Adjust More Stock" />;
    }

    // ── Checkout ───────────────────────────────────────────────────────────────
    if (view === 'checkout') {
        const cartItems = Array.from(cart.values());
        return (
            <div className="p-8 max-w-2xl space-y-6">
                <button
                    className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => setView('search')}
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back to search
                </button>

                <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">Your First Name</label>
                    <Input
                        className={fieldErrors && !firstName ? 'border-destructive focus-visible:ring-destructive' : ''}
                        value={firstName}
                        onChange={e => { setFirstName(e.target.value); if (e.target.value) setFieldErrors(false); }}
                        placeholder="Enter your first name"
                    />
                </div>

                <div className="border-t border-border" />

                <div className="space-y-2">
                    {cartItems.map(sku => {
                        const val = targets.get(sku.sku_id) ?? '';
                        const hasError = fieldErrors && (val === '' || Number(val) < 0);

                        return (
                            <Card key={sku.sku_id}>
                                <CardContent className="flex items-center gap-3 p-4">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-foreground truncate">{sku.product_name}</p>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <p className="text-xs text-muted-foreground font-mono truncate">{sku.sku_name}</p>
                                            <span className="text-xs text-muted-foreground">·</span>
                                            <span className="text-xs text-muted-foreground font-mono">current: {sku.sum_stock_level}</span>
                                        </div>
                                    </div>
                                    <Input
                                        type="number"
                                        min="0"
                                        placeholder="New total"
                                        className={`w-28 shrink-0 ${hasError ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                                        value={val}
                                        onChange={e => setTarget(sku.sku_id, e.target.value)}
                                    />
                                    <button
                                        className="text-muted-foreground hover:text-destructive transition-colors shrink-0 p-1"
                                        onClick={() => removeFromCart(sku.sku_id)}
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>

                <Button className="w-full" onClick={handleSubmit} disabled={submitting}>
                    {submitting
                        ? <span className="flex items-center gap-2"><Spinner />Submitting…</span>
                        : `Confirm Adjustment for ${cart.size} Product${cart.size !== 1 ? 's' : ''}`}
                </Button>

                {submitError && (
                    <div className="flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-mono bg-destructive/10 border-destructive/30 text-destructive">
                        <span className="text-xs">●</span>
                        {submitError}
                    </div>
                )}
            </div>
        );
    }

    // ── Search ─────────────────────────────────────────────────────────────────
    return (
        <div className="p-8 max-w-2xl pb-28">
            {prefilling ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-16 justify-center">
                    <Spinner />
                    Loading inventory…
                </div>
            ) : prefillError ? (
                <div className="flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-mono bg-destructive/10 border-destructive/30 text-destructive">
                    <span className="text-xs">●</span>
                    {prefillError}
                </div>
            ) : (
                <>
                    <div className="flex gap-2 mb-4">
                        <Input
                            placeholder="Search product or material…"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSearch()}
                            className="flex-1"
                        />
                        <Button onClick={handleSearch} disabled={searching}>
                            {searching ? <span className="flex items-center gap-2"><Spinner />Searching</span> : 'Search'}
                        </Button>
                    </div>

                    {results.length > 0 && (
                        <div className="space-y-2">
                            {results.map(sku => {
                                const inCart = cart.has(sku.sku_id);
                                return (
                                    <Card
                                        key={sku.sku_id}
                                        className={`cursor-pointer transition-all ${inCart ? 'border-primary bg-primary/5' : 'hover:bg-accent hover:border-primary/40'}`}
                                        onClick={() => toggleCart(sku)}
                                    >
                                        <CardContent className="flex items-center gap-3 p-4">
                                            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${inCart ? 'bg-primary border-primary' : 'border-muted-foreground/40'}`}>
                                                {inCart && (
                                                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                                                        <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                                    </svg>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-foreground truncate">{sku.product_name}</p>
                                                <p className="text-xs text-muted-foreground font-mono truncate mt-0.5">{sku.sku_name}</p>
                                            </div>
                                            <Badge variant="secondary" className="ml-4 shrink-0 font-mono text-xs">
                                                Stock: {sku.sum_stock_level}
                                            </Badge>
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    )}
                </>
            )}

            {cart.size > 0 && (
                <div className="fixed bottom-6 inset-x-0 flex justify-center pointer-events-none z-50">
                    <div className="pointer-events-auto flex items-center gap-4 bg-background border border-border shadow-lg rounded-xl px-5 py-3">
                        <div className="flex items-center gap-2 text-sm text-foreground">
                            <ClipboardList className="w-4 h-4 text-muted-foreground" />
                            <span className="font-medium">{cart.size}</span>
                            <span className="text-muted-foreground">product{cart.size !== 1 ? 's' : ''} selected</span>
                        </div>
                        <div className="w-px h-4 bg-border" />
                        <Button size="sm" onClick={() => setView('checkout')}>
                            Review Adjustments →
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
