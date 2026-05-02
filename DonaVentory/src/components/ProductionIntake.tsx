import { useState } from 'react';
import { searchSKUs } from '@/Backend/SKUs';
import { receiveProduction } from '@/Backend/Orders';
import type { SKU } from '@/Backend/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import SuccessCard from '@/components/SuccessCard';

type View = 'search' | 'form' | 'success';

export default function ProductionIntake() {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<SKU[]>([]);
  const [selectedSKU, setSelectedSKU] = useState<SKU | null>(null);
  const [firstName, setFirstName] = useState('');
  const [amount, setAmount] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<View>('search');
  const [successMsg, setSuccessMsg] = useState('');
  const [status, setStatus] = useState('');
  const [isError, setIsError] = useState(false);
  const [errors, setErrors] = useState(false);

  const handleSearch = async () => {
    if (!searchTerm) return;
    setLoading(true);
    setStatus('Searching...');
    setIsError(false);
    try {
      const response = await searchSKUs(searchTerm);
      setResults(response.data);
      setStatus(response.data.length > 0 ? '' : 'No products found.');
    } catch (error) {
      console.error(error);
      setStatus('Search failed. Check your VITE_PREDIKO_AUTH_KEY in .env');
      setIsError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleIntake = async () => {
    const numAmount = Number(amount);
    if (!firstName || amount === '' || numAmount < 0) {
      setErrors(true);
      setIsError(true);
      setStatus(numAmount < 0 ? 'Amount cannot be negative.' : 'All fields are required.');
      return;
    }

    setErrors(false);
    setIsError(false);
    setLoading(true);
    setStatus(`Updating inventory for ${selectedSKU?.sku_name}...`);
    try {
      if (selectedSKU) {
        await receiveProduction(selectedSKU, numAmount, firstName);
        setSuccessMsg(`Added ${numAmount} unit${numAmount !== 1 ? 's' : ''} of ${selectedSKU.product_name} to inventory.`);
        setView('success');
        setStatus('');
      }
    } catch (error) {
      console.error(error);
      setStatus('Failed to update inventory. Check your API Key in .env');
      setIsError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setSelectedSKU(null);
    setErrors(false);
    setIsError(false);
    setStatus('');
    setView('search');
  };

  const handleReset = () => {
    setSelectedSKU(null);
    setAmount('');
    setFirstName('');
    setResults([]);
    setSearchTerm('');
    setStatus('');
    setView('search');
  };

  // ── Success screen ───────────────────────────────────────────────────────────
  if (view === 'success') {
    return <SuccessCard message={successMsg} onReset={handleReset} />;
  }

  return (
    <div className="p-8 max-w-2xl">
      {view === 'search' ? (
        <div className="space-y-4">
          {/* Search bar */}
          <div className="flex gap-2">
            <Input
              placeholder="Search product name…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="flex-1"
            />
            <Button onClick={handleSearch} disabled={loading}>
              {loading ? (
                <span className="flex items-center gap-2">
                  <Spinner />
                  Searching
                </span>
              ) : 'Search'}
            </Button>
          </div>

          {/* Results */}
          {results.length > 0 && (
            <div className="space-y-2">
              {results.map((sku) => (
                <Card
                  key={sku.sku_id}
                  className="cursor-pointer transition-colors hover:bg-accent hover:border-primary"
                  onClick={() => { setSelectedSKU(sku); setView('form'); }}
                >
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{sku.product_name}</p>
                      <p className="text-xs text-muted-foreground font-mono truncate mt-0.5">{sku.sku_name}</p>
                    </div>
                    <Badge variant="secondary" className="ml-4 shrink-0 font-mono text-xs">
                      Stock: {sku.sum_stock_level}
                    </Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div onKeyDown={(e) => e.key === 'Enter' && handleIntake()}>
          <Card>
            <CardHeader className="bg-muted/50 rounded-t-xl border-b px-6 py-5">
              <p className="text-xs font-mono font-medium text-muted-foreground uppercase tracking-widest mb-1">
                Recording intake for
              </p>
              <h2 className="text-xl font-semibold text-foreground tracking-tight">{selectedSKU?.product_name}</h2>
              <p className="text-xs text-muted-foreground font-mono mt-1">
                Current inventory:{' '}
                <span className="text-primary font-medium">{selectedSKU?.sum_stock_level}</span>{' '}
                units
              </p>
            </CardHeader>

            <CardContent className="px-6 py-6 space-y-5">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Your First Name</label>
                <Input
                  className={errors && !firstName ? 'border-destructive focus-visible:ring-destructive' : ''}
                  value={firstName}
                  onChange={(e) => {
                    setFirstName(e.target.value);
                    if (e.target.value) setErrors(false);
                  }}
                  placeholder="Enter your first name"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Amount Made</label>
                <Input
                  type="number"
                  min="0"
                  className={errors && (amount === '' || Number(amount) < 0) ? 'border-destructive focus-visible:ring-destructive' : ''}
                  value={amount}
                  onChange={(e) => {
                    const val = e.target.value;
                    setAmount(val);
                    if (val !== '' && Number(val) >= 0) setErrors(false);
                  }}
                  placeholder="Enter quantity"
                />
              </div>

              <div className="flex gap-2 pt-2 border-t">
                <Button
                  className="flex-1"
                  onClick={handleIntake}
                  disabled={loading || amount === '' || Number(amount) < 0 || !firstName}
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <Spinner />
                      Processing…
                    </span>
                  ) : 'Confirm Intake'}
                </Button>
                <Button variant="outline" onClick={handleCancel} disabled={loading}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Error / info status */}
      {status && (
        <div className={`mt-4 flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-mono ${
          isError
            ? 'bg-destructive/10 border-destructive/30 text-destructive'
            : 'bg-primary/10 border-primary/30 text-primary'
        }`}>
          <span className="text-xs">●</span>
          {status}
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
