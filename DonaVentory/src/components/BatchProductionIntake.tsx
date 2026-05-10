import { useState } from 'react';
import { searchSKUs } from '@/Backend/SKUs';
import { receiveBatchProduction } from '@/Backend/Orders';
import type { SKU } from '@/Backend/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { X, ArrowLeft, ShoppingCart } from 'lucide-react';
import SuccessCard from '@/components/SuccessCard';
import Disclaimer from '@/components/Disclaimer';

type View = 'search' | 'checkout';

export default function BatchProductionIntake() {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<SKU[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchStatus, setSearchStatus] = useState('');

  // Cart: Map<sku_id, SKU> — acts as a hash set, preserves insertion order
  const [cart, setCart] = useState<Map<string, SKU>>(new Map());

  // Checkout state
  const [view, setView] = useState<View>('search');
  const [firstName, setFirstName] = useState('');
  const [amounts, setAmounts] = useState<Map<string, string>>(new Map());
  const [submitting, setSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState('');
  const [isError, setIsError] = useState(false);
  const [succeeded, setSucceeded] = useState(false);
  const [fieldErrors, setFieldErrors] = useState(false);

  // ── Cart helpers ────────────────────────────────────────────────────────
  const toggleCart = (sku: SKU) => {
    setCart((prev) => {
      const next = new Map(prev);
      if (next.has(sku.sku_id)) {
        next.delete(sku.sku_id);
      } else {
        next.set(sku.sku_id, sku);
      }
      return next;
    });
  };

  const removeFromCart = (skuId: string) => {
    setCart((prev) => {
      const next = new Map(prev);
      next.delete(skuId);
      return next;
    });
  };

  // ── Search ──────────────────────────────────────────────────────────────
  const handleSearch = async () => {
    if (!searchTerm || searchLoading) return;
    setSearchLoading(true);
    setSearchStatus('Searching...');
    try {
      const response = await searchSKUs(searchTerm);
      const data = response.data || [];
      setResults(data);
      setSearchStatus(data.length > 0 ? '' : 'No products found.');
    } catch (error) {
      console.error(error);
      const msg = error instanceof Error ? error.message : String(error);
      setSearchStatus(`Search failed: ${msg}`);
    } finally {
      setSearchLoading(false);
    }
  };

  // ── Submit batch ────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    const entries = Array.from(cart.keys()).map((id) => ({
      id,
      val: amounts.get(id) ?? '',
    }));
    const hasInvalid = entries.some(({ val }) => val === '' || Number(val) < 0);

    if (!firstName || hasInvalid) {
      setFieldErrors(true);
      setIsError(true);
      setSubmitStatus(
        !firstName ? 'First name is required.' : 'All quantities are required and must be non-negative.'
      );
      return;
    }

    setFieldErrors(false);
    setIsError(false);
    setSubmitting(true);
    setSubmitStatus(`Processing ${cart.size} product${cart.size !== 1 ? 's' : ''}…`);

    try {
      const items = Array.from(cart.values()).map((sku) => ({
        sku,
        amount: Number(amounts.get(sku.sku_id))
      }));
      await receiveBatchProduction(items, firstName);
      setSucceeded(true);
      setIsError(false);
      setSubmitStatus(`Intake recorded for ${cart.size} product${cart.size !== 1 ? 's' : ''}.`);
      setCart(new Map());
      setAmounts(new Map());
    } catch (error) {
      console.error(error);
      const msg = error instanceof Error ? error.message : String(error);
      setIsError(true);
      setSubmitStatus(`Failed to process intake: ${msg}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setSucceeded(false);
    setSubmitStatus('');
    setFirstName('');
    setAmounts(new Map());
    setResults([]);
    setSearchTerm('');
    setView('search');
  };

  // ── Checkout view ───────────────────────────────────────────────────────
  if (view === 'checkout') {
    if (succeeded) {
      return <SuccessCard message={submitStatus} onReset={handleReset} resetLabel="Log Another Batch" />;
    }
    const cartItems = Array.from(cart.values());

    return (
      <div className="p-8 max-w-2xl space-y-6">
        {/* Back */}
        <button
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => setView('search')}
        >
          <ArrowLeft className="w-4 h-4" />
          Back to search
        </button>

        {/* Name */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Logged by</label>
          <Input
            className={fieldErrors && !firstName ? 'border-destructive focus-visible:ring-destructive' : ''}
            value={firstName}
            onChange={(e) => {
              setFirstName(e.target.value);
              if (e.target.value) setFieldErrors(false);
            }}
            placeholder="Enter your first name"
          />
        </div>

        <div className="border-t border-border" />

        <Disclaimer message="Stock levels may take 1–5 minutes to reflect after submission." />

        {/* Cart items */}
        <div className="space-y-2">
          {cartItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">No products in cart.</p>
          ) : (
            cartItems.map((sku) => {
              const amountVal = amounts.get(sku.sku_id) ?? '';
              const hasError = fieldErrors && (amountVal === '' || Number(amountVal) < 0);
              return (
                <Card key={sku.sku_id}>
                  <CardContent className="flex items-center gap-3 p-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {sku.product_name}
                      </p>
                      <p className="text-xs text-muted-foreground font-mono truncate mt-0.5">
                        {sku.sku_name}
                      </p>
                    </div>
                    <Input
                      type="number"
                      min="0"
                      placeholder="Qty"
                      className={`w-24 shrink-0 ${
                        hasError ? 'border-destructive focus-visible:ring-destructive' : ''
                      }`}
                      value={amountVal}
                      onChange={(e) => {
                        const val = e.target.value;
                        setAmounts((prev) => new Map(prev).set(sku.sku_id, val));
                        if (val !== '' && Number(val) >= 0) setFieldErrors(false);
                      }}
                    />
                    <button
                      className="text-muted-foreground hover:text-destructive transition-colors shrink-0 p-1"
                      onClick={() => removeFromCart(sku.sku_id)}
                      title="Remove"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {/* Confirm */}
        <Button
          className="w-full"
          onClick={handleSubmit}
          disabled={submitting || succeeded}
        >
          {submitting ? (
            <span className="flex items-center gap-2">
              <Spinner />
              Processing…
            </span>
          ) : succeeded ? (
            'Intake Submitted'
          ) : (
            `Confirm Intake for ${cart.size} Product${cart.size !== 1 ? 's' : ''}`
          )}
        </Button>

        {/* Status */}
        {submitStatus && (
          <div
            className={`flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-mono ${
              isError
                ? 'bg-destructive/10 border-destructive/30 text-destructive'
                : 'bg-green-500/10 border-green-500/30 text-green-600'
            }`}
          >
            <span className="text-xs">●</span>
            {submitStatus}
          </div>
        )}
      </div>
    );
  }

  // ── Search view ─────────────────────────────────────────────────────────
  return (
    <div className="p-8 max-w-2xl pb-28">
      <Disclaimer message="Stock levels may take 1–5 minutes to reflect after submission." />
      {/* Search bar */}
      <div className="flex gap-2 mb-4">
        <Input
          placeholder="Search product name…"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          className="flex-1"
        />
        <Button onClick={handleSearch} disabled={searchLoading}>
          {searchLoading ? (
            <span className="flex items-center gap-2">
              <Spinner />
              Searching
            </span>
          ) : (
            'Search'
          )}
        </Button>
      </div>

      {searchStatus && (
        <p className="text-sm text-muted-foreground mb-4">{searchStatus}</p>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-2">
          {results.map((sku) => {
            const inCart = cart.has(sku.sku_id);
            return (
              <Card
                key={sku.sku_id}
                className={`cursor-pointer transition-all ${
                  inCart
                    ? 'border-primary bg-primary/5'
                    : 'hover:bg-accent hover:border-primary/40'
                }`}
                onClick={() => toggleCart(sku)}
              >
                <CardContent className="flex items-center gap-3 p-4">
                  {/* Checkbox */}
                  <div
                    className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                      inCart ? 'bg-primary border-primary' : 'border-muted-foreground/40'
                    }`}
                  >
                    {inCart && (
                      <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                        <path
                          d="M1 4L3.5 6.5L9 1"
                          stroke="white"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {sku.product_name}
                    </p>
                    <p className="text-xs text-muted-foreground font-mono truncate mt-0.5">
                      {sku.sku_name}
                    </p>
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

      {/* Floating cart bar */}
      {cart.size > 0 && (
        <div className="fixed bottom-6 inset-x-0 flex justify-center pointer-events-none z-50">
          <div className="pointer-events-auto flex items-center gap-4 bg-background border border-border shadow-lg rounded-xl px-5 py-3">
            <div className="flex items-center gap-2 text-sm text-foreground">
              <ShoppingCart className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium">{cart.size}</span>
              <span className="text-muted-foreground">
                product{cart.size !== 1 ? 's' : ''} selected
              </span>
            </div>
            <div className="w-px h-4 bg-border" />
            <Button size="sm" onClick={() => setView('checkout')}>
              Done Batching →
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Spinner() {
  return (
    <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin inline-block shrink-0" />
  );
}
