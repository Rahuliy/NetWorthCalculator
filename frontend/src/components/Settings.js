import React, { useState, useEffect, useCallback } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import { createLinkToken, exchangePublicToken, getAccounts, manualSync } from '../api';

function Settings() {
  const [linkToken, setLinkToken] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState(null);
  const [plaidError, setPlaidError] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [accountsRes] = await Promise.all([
        getAccounts(),
      ]);
      setAccounts(accountsRes.data);

      // Get a link token for adding new accounts
      try {
        const linkRes = await createLinkToken();
        setLinkToken(linkRes.data.link_token);
        setPlaidError(null);
      } catch (linkError) {
        console.error('Error creating link token:', linkError);
        const errorMsg = linkError.response?.data?.detail || linkError.message || 'Unknown error';
        const isApiKeyError = errorMsg.toLowerCase().includes('invalid_api_keys') ||
          errorMsg.toLowerCase().includes('client_id') ||
          errorMsg.toLowerCase().includes('secret') ||
          errorMsg.toLowerCase().includes('credentials') ||
          errorMsg.toLowerCase().includes('unauthorized') ||
          linkError.response?.status === 400 ||
          linkError.response?.status === 401;

        if (isApiKeyError) {
          setPlaidError({
            type: 'api_keys',
            message: 'Plaid API keys are not configured or invalid.',
            detail: 'To connect bank accounts, you need valid Plaid credentials. Get your API keys from dashboard.plaid.com and update your .env file.',
          });
        } else {
          setPlaidError({
            type: 'other',
            message: 'Could not connect to Plaid.',
            detail: errorMsg,
          });
        }
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const onSuccess = useCallback(async (publicToken, metadata) => {
    try {
      setMessage({ type: 'info', text: 'Connecting account...' });
      await exchangePublicToken(publicToken, metadata.institution.name);
      setMessage({ type: 'success', text: 'Account connected successfully!' });
      loadData();
    } catch (error) {
      console.error('Error exchanging token:', error);
      setMessage({ type: 'error', text: 'Failed to connect account. Please try again.' });
    }
  }, []);

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess,
  });

  const handleSync = async () => {
    setSyncing(true);
    setMessage({ type: 'info', text: 'Syncing all accounts...' });
    try {
      await manualSync();
      setMessage({ type: 'success', text: 'Sync completed successfully!' });
      loadData();
    } catch (error) {
      console.error('Error syncing:', error);
      setMessage({ type: 'error', text: 'Sync failed. Please try again.' });
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-rh-text tracking-tight">Settings</h1>
        <p className="text-sm text-rh-text-secondary mt-1">Manage your connected accounts</p>
      </div>

      {/* Message */}
      {message && (
        <div className={`p-4 rounded-xl text-sm font-medium ${
          message.type === 'success' ? 'bg-rh-green-glow text-rh-green border border-rh-green/20' :
          message.type === 'error' ? 'bg-rh-red-glow text-rh-red border border-rh-red/20' :
          'bg-rh-card text-rh-text border border-rh-border'
        }`}>
          {message.text}
        </div>
      )}

      {/* Plaid Error Banner */}
      {plaidError && (
        <div className="rounded-xl border border-rh-red/20 bg-rh-red-glow overflow-hidden">
          <div className="p-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-rh-red">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-rh-red">{plaidError.message}</p>
                <p className="text-xs text-rh-text-secondary mt-1">{plaidError.detail}</p>
                {plaidError.type === 'api_keys' && (
                  <div className="mt-3 flex flex-col gap-2">
                    <div className="text-xs text-rh-text-muted">
                      <span className="font-medium text-rh-text-secondary">Steps to fix:</span>
                      <ol className="list-decimal list-inside mt-1 space-y-0.5">
                        <li>Sign up / log in at <span className="text-rh-text font-medium">dashboard.plaid.com</span></li>
                        <li>Copy your <span className="text-rh-text font-medium">Client ID</span> and <span className="text-rh-text font-medium">Secret</span></li>
                        <li>Update <code className="bg-rh-black/60 px-1.5 py-0.5 rounded text-rh-text-secondary">backend/.env</code> with your credentials</li>
                        <li>Restart the backend server</li>
                      </ol>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Connect Account */}
      <div className="bg-rh-card rounded-2xl p-6 border border-rh-border shadow-card">
        <h2 className="text-base font-semibold text-rh-text mb-1.5">Connect Account</h2>
        <p className="text-sm text-rh-text-secondary mb-5">
          Link your bank accounts, credit cards, and investment accounts using Plaid's secure connection.
        </p>

        <button
          onClick={() => open()}
          disabled={!ready || !!plaidError}
          className={`flex items-center gap-2 px-6 py-3 font-semibold rounded-xl transition-all ${
            !ready || plaidError
              ? 'bg-rh-border text-rh-text-muted cursor-not-allowed'
              : 'bg-rh-green hover:bg-rh-green-dark text-black hover:scale-[1.02] active:scale-[0.98] shadow-glow-green'
          }`}
        >
          {plaidError ? (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
              Plaid Not Configured
            </>
          ) : !ready ? (
            <>
              <div className="spinner-sm" />
              Initializing...
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="5" width="20" height="14" rx="2" />
                <line x1="2" y1="10" x2="22" y2="10" />
              </svg>
              Connect a Bank Account
            </>
          )}
        </button>

        <p className="text-xs text-rh-text-muted mt-4">
          Your credentials are never stored. Plaid uses bank-level encryption to securely connect your accounts.
        </p>
      </div>

      {/* Connected Accounts */}
      <div className="bg-rh-card rounded-2xl p-6 border border-rh-border shadow-card">
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-base font-semibold text-rh-text">Connected Accounts</h2>
          <button
            onClick={handleSync}
            disabled={syncing || accounts.length === 0}
            className="flex items-center gap-2 px-4 py-3 border border-rh-border text-sm font-medium text-rh-text rounded-xl hover:bg-rh-border/50 hover:scale-[1.02] transition-all duration-250 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            {syncing ? (
              <>
                <div className="spinner-sm" />
                Syncing...
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="23 4 23 10 17 10" />
                  <polyline points="1 20 1 14 7 14" />
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                </svg>
                Sync All
              </>
            )}
          </button>
        </div>

        {accounts.length === 0 ? (
          <div className="text-center py-10 text-rh-text-secondary">
            <div className="w-12 h-12 rounded-full bg-rh-border/50 flex items-center justify-center mx-auto mb-3">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-rh-text-muted">
                <rect x="2" y="5" width="20" height="14" rx="2" />
                <line x1="2" y1="10" x2="22" y2="10" />
              </svg>
            </div>
            <p className="font-medium">No accounts connected yet</p>
            <p className="text-sm mt-1 text-rh-text-muted">Click "Connect a Bank Account" to get started.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {accounts.map((account) => (
              <div
                key={account.id}
                className="flex justify-between items-center p-4 rounded-xl bg-rh-black/30 hover:bg-rh-black/50 hover:scale-[1.01] active:scale-[0.99] transition-all duration-250"
              >
                <div className="flex items-center">
                  <div className="w-10 h-10 rounded-xl bg-rh-border/40 flex items-center justify-center mr-3.5">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-rh-text-secondary">
                      <rect x="2" y="5" width="20" height="14" rx="2" />
                      <line x1="2" y1="10" x2="22" y2="10" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-sm text-rh-text font-medium">{account.name}</div>
                    <div className="text-xs text-rh-text-muted mt-0.5">
                      {account.institution_name} · {account.account_type.replace('_', ' ')} · ••••{account.mask}
                    </div>
                  </div>
                </div>
                <div className="text-sm text-rh-text font-semibold">
                  {account.current_balance !== null
                    ? new Intl.NumberFormat('en-US', {
                        style: 'currency',
                        currency: 'USD',
                      }).format(account.current_balance)
                    : '-'
                  }
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* About */}
      <div className="bg-rh-card rounded-2xl p-6 border border-rh-border shadow-card">
        <h2 className="text-base font-semibold text-rh-text mb-4">About</h2>

        <div className="space-y-4 text-sm text-rh-text-secondary">
          <p>
            <strong className="text-rh-text font-semibold">NetWorth Calculator</strong> helps you track your financial health
            by aggregating all your accounts in one place.
          </p>

          <div className="pt-1">
            <h3 className="text-rh-text font-medium mb-2">Features</h3>
            <ul className="space-y-1.5">
              {[
                'Track net worth over time',
                'Monitor investment holdings',
                'Analyze spending by category',
                'Set budgets and track frivolous spending',
                'Automatic daily refresh',
              ].map((feature, i) => (
                <li key={i} className="flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00D632" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="pt-1">
            <h3 className="text-rh-text font-medium mb-2">Supported Institutions</h3>
            <p>Works with thousands of banks, credit unions, and brokerages including Chase, PNC, Robinhood, and more.</p>
          </div>
        </div>
      </div>

      {/* Data & Privacy */}
      <div className="bg-rh-card rounded-2xl p-6 border border-rh-border shadow-card">
        <h2 className="text-base font-semibold text-rh-text mb-4">Data & Privacy</h2>

        <div className="space-y-3 text-sm text-rh-text-secondary">
          <p>
            All your financial data is stored locally on your computer. No data is sent to external servers
            except for Plaid's secure API to fetch your account information.
          </p>

          <p>
            Your database is located at: <code className="bg-rh-black/60 px-2 py-1 rounded-lg text-rh-text-secondary text-xs">networth.db</code>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Settings;
