import { useState, useEffect } from 'react';
import { searchSKUs } from './Backend/SKUs';
import { receiveProduction } from './Backend/Orders';
import { getAuthKey, saveAuthKey } from './Backend/apiConfig';
import type { SKU } from './Backend/types';
import './App.css';

function App() {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<SKU[]>([]);
  const [selectedSKU, setSelectedSKU] = useState<SKU | null>(null);
  const [firstName, setFirstName] = useState('');
  const [amount, setAmount] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [errors, setErrors] = useState(false);
  
  // Settings state
  const [showSettings, setShowSettings] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [keyMissing, setKeyMissing] = useState(false);

  // Load key on mount
  useEffect(() => {
    getAuthKey().then(key => {
      if (key) {
        setApiKey(key);
        setKeyMissing(false);
      } else {
        setKeyMissing(true);
        setShowSettings(true);
      }
    });
  }, []);

  const handleSaveKey = async () => {
    const success = await saveAuthKey(apiKey);
    if (success) {
      setShowSettings(false);
      setKeyMissing(false);
      setStatus('API Key saved successfully.');
      setTimeout(() => setStatus(''), 3000);
    } else {
      setStatus('Failed to save API key.');
    }
  };

  const handleSearch = async () => {
    if (!searchTerm) return;
    setLoading(true);
    setStatus('Searching...');
    try {
      const response = await searchSKUs(searchTerm);
      setResults(response.data);
      setStatus(response.data.length > 0 ? '' : 'No products found.');
    } catch (error) {
      console.error(error);
      setStatus('Search failed. Check your API key in Settings.');
    } finally {
      setLoading(false);
    }
  };

  const handleIntake = async () => {
    const numAmount = Number(amount);
    if (!firstName || amount === '' || numAmount < 0) {
      setErrors(true);
      setStatus(numAmount < 0 ? 'Amount cannot be negative.' : 'All fields are required.');
      return;
    }
    
    setErrors(false);
    setLoading(true);
    setStatus(`Updating inventory for ${selectedSKU?.sku_name}...`);
    try {
      if (selectedSKU) {
        await receiveProduction(selectedSKU, numAmount, firstName);
        setStatus(`Successfully added ${numAmount} units to ${selectedSKU.product_name}!`);
        setSelectedSKU(null);
        setAmount('');
        setFirstName('');
        setResults([]);
        setSearchTerm('');
      }
    } catch (error) {
      console.error(error);
      setStatus('Failed to update inventory. Check your API Key.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <header className="app-header">
        <h1>Production Intake</h1>
        <button className="settings-btn" onClick={() => setShowSettings(!showSettings)}>
          Settings
        </button>
      </header>

      {showSettings && (
        <section className="settings-panel">
          <h3>API Settings</h3>
          <div className="input-group">
            <label>Prediko API Key:</label>
            <input 
              type="password" 
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Paste your pk_live_... key here"
            />
          </div>
          <button className="confirm-btn" onClick={handleSaveKey}>Save Key</button>
          {keyMissing && <p className="error-text">API key is required to use this application.</p>}
        </section>
      )}
      
      {!selectedSKU ? (
        <section className="search-section">
          <div className="search-box">
            <input 
              type="text" 
              placeholder="Search product (e.g. 'book')" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <button onClick={handleSearch} disabled={loading || keyMissing}>Search</button>
          </div>

          <div className="results-list">
            {results.map((sku) => (
              <div 
                key={sku.sku_id} 
                className="result-item" 
                onClick={() => setSelectedSKU(sku)}
              >
                <div className="product-info">
                  <div className="product-details">
                    <strong>{sku.product_name}</strong>
                    <span className="sku-id-text">{sku.sku_name}</span>
                  </div>
                </div>
                <span className="stock-badge">Stock: {sku.sum_stock_level}</span>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <section 
          className="intake-section"
          onKeyDown={(e) => e.key === 'Enter' && handleIntake()}
        >
          <div className="selected-info">
            <h2>{selectedSKU.product_name}</h2>
            <p>Current Inventory: {selectedSKU.sum_stock_level}</p>
          </div>
          
          <div className="input-group">
            <label>Your First Name:</label>
            <input 
              type="text" 
              className={errors && !firstName ? 'error-input' : ''}
              value={firstName} 
              onChange={(e) => {
                setFirstName(e.target.value);
                if (e.target.value) setErrors(false);
              }}
              placeholder="Enter your first name"
            />
          </div>

          <div className="input-group">
            <label>Amount Made:</label>
            <input 
              type="number" 
              min="0"
              className={errors && (amount === '' || Number(amount) < 0) ? 'error-input' : ''}
              value={amount} 
              onChange={(e) => {
                const val = e.target.value;
                setAmount(val);
                if (val !== '' && Number(val) >= 0) setErrors(false);
              }}
              placeholder="Enter quantity"
            />
          </div>

          <div className="button-group">
            <button className="confirm-btn" onClick={handleIntake} disabled={loading || amount === '' || Number(amount) < 0 || !firstName}>
              Confirm Intake
            </button>
            <button className="cancel-btn" onClick={() => {
              setSelectedSKU(null);
              setErrors(false);
              setStatus('');
            }} disabled={loading}>
              Cancel
            </button>
          </div>
        </section>
      )}

      {status && <p className={errors ? 'status-msg error-text' : 'status-msg'}>{status}</p>}
    </div>
  );
}

export default App;
