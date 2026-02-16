import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { getCurrentNetWorth, getNetWorthHistory, getAccounts, manualSync } from '../api';
import { format } from 'date-fns';

const formatCurrency = (value) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const formatCurrencyFull = (value) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

function Dashboard() {
  const [netWorth, setNetWorth] = useState(null);
  const [history, setHistory] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [timeRange, setTimeRange] = useState(30);

  useEffect(() => {
    loadData();
  }, [timeRange]);

  const loadData = async () => {
    try {
      const [nwRes, histRes, accRes] = await Promise.all([
        getCurrentNetWorth(),
        getNetWorthHistory(timeRange),
        getAccounts(),
      ]);
      setNetWorth(nwRes.data);
      setHistory(histRes.data);
      setAccounts(accRes.data);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      await manualSync();
      await loadData();
    } catch (error) {
      console.error('Error syncing:', error);
    } finally {
      setSyncing(false);
    }
  };

  // Calculate change
  const getChange = () => {
    if (history.length < 2) return { amount: 0, percent: 0 };
    const first = history[0]?.net_worth || 0;
    const last = history[history.length - 1]?.net_worth || 0;
    const amount = last - first;
    const percent = first > 0 ? (amount / first) * 100 : 0;
    return { amount, percent };
  };

  const change = getChange();
  const isPositive = change.amount >= 0;

  // Pie chart data for asset allocation
  const allocationData = netWorth ? [
    { name: 'Cash', value: netWorth.total_cash, color: '#00D632' },
    { name: 'Investments', value: netWorth.total_investments, color: '#4ADE80' },
  ].filter(d => d.value > 0) : [];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header with Net Worth */}
      <div className="flex justify-between items-start">
        <div>
          <p className="text-sm font-medium text-rh-text-secondary mb-1">Net Worth</p>
          <h1 className="text-4xl font-bold text-rh-text tracking-tight">
            {netWorth ? formatCurrency(netWorth.net_worth) : '$0'}
          </h1>
          <div className={`flex items-center mt-2 ${isPositive ? 'text-rh-green' : 'text-rh-red'}`}>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-sm font-semibold ${
              isPositive ? 'bg-rh-green-glow' : 'bg-rh-red-glow'
            }`}>
              {isPositive ? '+' : ''}{formatCurrencyFull(change.amount)}
              <span className="text-xs font-medium opacity-80">
                ({isPositive ? '+' : ''}{change.percent.toFixed(2)}%)
              </span>
            </span>
            <span className="ml-3 text-rh-text-muted text-sm">
              Past {timeRange} days
            </span>
          </div>
        </div>

        <button
          onClick={handleSync}
          disabled={syncing}
          className="flex items-center gap-2 px-5 py-2.5 bg-rh-green hover:bg-rh-green-dark text-black font-semibold rounded-lg transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100 shadow-glow-green"
        >
          {syncing ? (
            <>
              <div className="spinner-sm" style={{ borderTopColor: '#000' }} />
              Syncing...
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10" />
                <polyline points="1 20 1 14 7 14" />
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
              Refresh
            </>
          )}
        </button>
      </div>

      {/* Net Worth Chart */}
      <div className="bg-rh-card rounded-2xl p-6 border border-rh-border shadow-card">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-base font-semibold text-rh-text">Net Worth</h2>
          <div className="flex bg-rh-black/60 rounded-xl p-1">
            {[7, 30, 90, 365].map((days) => (
              <button
                key={days}
                onClick={() => setTimeRange(days)}
                className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all duration-300 hover:scale-[1.05] active:scale-[0.95] ${
                  timeRange === days
                    ? 'bg-rh-green text-black shadow-sm'
                    : 'text-rh-text-secondary hover:text-rh-text'
                }`}
              >
                {days === 7 ? '1W' : days === 30 ? '1M' : days === 90 ? '3M' : '1Y'}
              </button>
            ))}
          </div>
        </div>

        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={history}>
              <defs>
                <linearGradient id="netWorthGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00D632" stopOpacity={0.15} />
                  <stop offset="100%" stopColor="#00D632" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="date"
                tickFormatter={(date) => format(new Date(date), 'MMM d')}
                stroke="#565B6B"
                tick={{ fill: '#565B6B', fontSize: 11, fontFamily: 'Inter' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={(value) => formatCurrency(value)}
                stroke="#565B6B"
                tick={{ fill: '#565B6B', fontSize: 11, fontFamily: 'Inter' }}
                axisLine={false}
                tickLine={false}
                width={80}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1A1D27',
                  border: '1px solid #262A36',
                  borderRadius: '10px',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
                  fontFamily: 'Inter',
                  fontSize: '13px',
                }}
                labelFormatter={(date) => format(new Date(date), 'MMM d, yyyy')}
                formatter={(value) => [formatCurrencyFull(value), 'Net Worth']}
              />
              <Line
                type="monotone"
                dataKey="net_worth"
                stroke="#00D632"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 5, fill: '#00D632', stroke: '#0F1117', strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Asset Breakdown and Accounts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Asset Allocation */}
        <div className="bg-rh-card rounded-2xl p-6 border border-rh-border shadow-card">
          <h2 className="text-base font-semibold text-rh-text mb-5">Asset Allocation</h2>

          <div className="flex items-center">
            <div className="w-36 h-36">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={allocationData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={56}
                    dataKey="value"
                    stroke="none"
                  >
                    {allocationData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="ml-8 space-y-4">
              {netWorth && (
                <>
                  <div className="flex items-center">
                    <div className="w-3 h-3 rounded-full bg-rh-green mr-3" />
                    <div>
                      <div className="text-xs font-medium text-rh-text-secondary">Cash</div>
                      <div className="text-rh-text font-semibold">{formatCurrency(netWorth.total_cash)}</div>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <div className="w-3 h-3 rounded-full mr-3" style={{ backgroundColor: '#4ADE80' }} />
                    <div>
                      <div className="text-xs font-medium text-rh-text-secondary">Investments</div>
                      <div className="text-rh-text font-semibold">{formatCurrency(netWorth.total_investments)}</div>
                    </div>
                  </div>
                  {netWorth.total_liabilities > 0 && (
                    <div className="flex items-center">
                      <div className="w-3 h-3 rounded-full bg-rh-red mr-3" />
                      <div>
                        <div className="text-xs font-medium text-rh-text-secondary">Credit Card Debt</div>
                        <div className="text-rh-red font-semibold">-{formatCurrency(netWorth.total_credit_card_debt)}</div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Linked Accounts */}
        <div className="bg-rh-card rounded-2xl p-6 border border-rh-border shadow-card">
          <h2 className="text-base font-semibold text-rh-text mb-5">Accounts</h2>

          {accounts.length === 0 ? (
            <div className="text-center py-10 text-rh-text-secondary">
              <div className="w-12 h-12 rounded-full bg-rh-border/50 flex items-center justify-center mx-auto mb-3">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-rh-text-muted">
                  <rect x="2" y="5" width="20" height="14" rx="2" />
                  <line x1="2" y1="10" x2="22" y2="10" />
                </svg>
              </div>
              <p className="font-medium">No accounts linked yet</p>
              <p className="text-sm mt-1 text-rh-text-muted">Go to Settings to connect your bank.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {accounts.map((account) => (
                <div
                  key={account.id}
                  className="flex justify-between items-center p-4 rounded-xl bg-rh-black/40 hover:bg-rh-black/60 hover:scale-[1.01] active:scale-[0.99] transition-all duration-250"
                >
                  <div>
                    <div className="text-sm text-rh-text font-medium">{account.name}</div>
                    <div className="text-xs text-rh-text-muted mt-0.5">
                      {account.institution_name} ••••{account.mask}
                    </div>
                  </div>
                  <div className={`text-right font-semibold text-sm ${
                    account.account_type === 'credit_card' ? 'text-rh-red' : 'text-rh-text'
                  }`}>
                    {account.account_type === 'credit_card' && account.current_balance > 0 ? '-' : ''}
                    {formatCurrencyFull(account.current_balance || 0)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Assets', value: netWorth?.total_assets, color: 'text-rh-text' },
          { label: 'Total Liabilities', value: netWorth?.total_liabilities, color: 'text-rh-red' },
          { label: 'Cash', value: netWorth?.total_cash, color: 'text-rh-text' },
          { label: 'Investments', value: netWorth?.total_investments, color: 'text-rh-text' },
        ].map((card, i) => (
          <div key={i} className="bg-rh-card rounded-2xl p-6 border border-rh-border shadow-card hover:shadow-card-hover hover:border-rh-border-light hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 cursor-default">
            <div className="text-xs font-medium text-rh-text-secondary uppercase tracking-wider">{card.label}</div>
            <div className={`text-xl font-bold mt-2 ${card.color}`}>
              {card.value != null ? formatCurrency(card.value) : '$0'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Dashboard;
