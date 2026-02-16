import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { getTransactions, getSpendingByCategory } from '../api';
import { format } from 'date-fns';

const formatCurrency = (value) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

const CATEGORY_COLORS = {
  'Food and Drink': '#FF6B6B',
  'Restaurants': '#FF6B6B',
  'Shopping': '#4ECDC4',
  'Entertainment': '#9B59B6',
  'Travel': '#3498DB',
  'Transportation': '#F39C12',
  'Groceries': '#2ECC71',
  'Utilities': '#95A5A6',
  'Healthcare': '#E74C3C',
  'Personal Care': '#1ABC9C',
  'default': '#565B6B',
};

function Spending() {
  const [transactions, setTransactions] = useState([]);
  const [categorySpending, setCategorySpending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [showFrivolousOnly, setShowFrivolousOnly] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);

  useEffect(() => {
    loadData();
  }, [selectedMonth, showFrivolousOnly]);

  const loadData = async () => {
    try {
      const year = selectedMonth.getFullYear();
      const month = selectedMonth.getMonth() + 1;

      const [txnRes, catRes] = await Promise.all([
        getTransactions(year, month, selectedCategory, showFrivolousOnly),
        getSpendingByCategory(year, month),
      ]);

      setTransactions(txnRes.data);
      setCategorySpending(catRes.data);
    } catch (error) {
      console.error('Error loading spending data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate totals
  const totalSpending = categorySpending.reduce((sum, c) => sum + c.total, 0);
  const totalFrivolous = categorySpending.reduce((sum, c) => sum + c.frivolous, 0);
  const totalNecessary = categorySpending.reduce((sum, c) => sum + c.necessary, 0);

  // Pie chart data
  const pieData = categorySpending
    .filter(c => c.total > 0)
    .slice(0, 8)
    .map(c => ({
      name: c.category,
      value: c.total,
      color: CATEGORY_COLORS[c.category] || CATEGORY_COLORS.default,
    }));

  // Month navigation
  const prevMonth = () => {
    setSelectedMonth(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() - 1));
  };

  const nextMonth = () => {
    const next = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1);
    if (next <= new Date()) {
      setSelectedMonth(next);
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
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-rh-text tracking-tight">Spending</h1>
          <p className="text-sm text-rh-text-secondary mt-1">Track where your money goes</p>
        </div>

        {/* Month Selector */}
        <div className="flex items-center bg-rh-card rounded-xl border border-rh-border px-2 py-1">
          <button
            onClick={prevMonth}
            className="p-3 rounded-lg text-rh-text-secondary hover:text-rh-text hover:bg-rh-black/50 hover:scale-[1.1] active:scale-[0.9] transition-all duration-250"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <span className="px-3 text-sm font-semibold text-rh-text min-w-[140px] text-center">
            {format(selectedMonth, 'MMMM yyyy')}
          </span>
          <button
            onClick={nextMonth}
            className="p-3 rounded-lg text-rh-text-secondary hover:text-rh-text hover:bg-rh-black/50 hover:scale-[1.1] active:scale-[0.9] transition-all duration-250 disabled:opacity-30 disabled:hover:scale-100"
            disabled={selectedMonth.getMonth() === new Date().getMonth()}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-rh-card rounded-2xl p-6 border border-rh-border shadow-card hover:shadow-card-hover hover:scale-[1.02] transition-all duration-300 cursor-default">
          <div className="text-xs font-medium text-rh-text-secondary uppercase tracking-wider">Total Spending</div>
          <div className="text-2xl font-bold text-rh-text mt-2 tracking-tight">{formatCurrency(totalSpending)}</div>
        </div>
        <div className="bg-rh-card rounded-2xl p-6 border border-rh-border shadow-card hover:shadow-card-hover hover:scale-[1.02] transition-all duration-300 cursor-default">
          <div className="text-xs font-medium text-rh-text-secondary uppercase tracking-wider">Necessary</div>
          <div className="text-2xl font-bold text-rh-green mt-2 tracking-tight">{formatCurrency(totalNecessary)}</div>
        </div>
        <div className="bg-rh-card rounded-2xl p-6 border border-rh-border shadow-card hover:shadow-card-hover hover:scale-[1.02] transition-all duration-300 cursor-default">
          <div className="text-xs font-medium text-rh-text-secondary uppercase tracking-wider">Frivolous</div>
          <div className="text-2xl font-bold text-rh-red mt-2 tracking-tight">{formatCurrency(totalFrivolous)}</div>
        </div>
      </div>

      {/* Category Breakdown and Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category List */}
        <div className="bg-rh-card rounded-2xl p-6 border border-rh-border shadow-card">
          <h2 className="text-base font-semibold text-rh-text mb-5">Spending by Category</h2>

          {categorySpending.length === 0 ? (
            <div className="text-center py-10 text-rh-text-secondary">
              <p className="text-sm">No spending data for this month</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {categorySpending.map((cat, index) => {
                const percent = totalSpending > 0 ? (cat.total / totalSpending) * 100 : 0;
                const color = CATEGORY_COLORS[cat.category] || CATEGORY_COLORS.default;
                const isSelected = selectedCategory === cat.category;

                return (
                  <div
                    key={index}
                    className={`p-4 rounded-xl cursor-pointer transition-all duration-300 hover:scale-[1.01] active:scale-[0.98] ${
                      isSelected
                        ? 'bg-rh-border/40 ring-1 ring-rh-border-light shadow-sm'
                        : 'bg-rh-black/30 hover:bg-rh-black/50'
                    }`}
                    onClick={() => setSelectedCategory(isSelected ? null : cat.category)}
                  >
                    <div className="flex justify-between items-center mb-2.5">
                      <div className="flex items-center">
                        <div
                          className="w-2.5 h-2.5 rounded-full mr-3"
                          style={{ backgroundColor: color }}
                        />
                        <span className="text-sm text-rh-text font-medium">{cat.category}</span>
                      </div>
                      <span className="text-sm text-rh-text font-semibold">{formatCurrency(cat.total)}</span>
                    </div>

                    {/* Progress bar */}
                    <div className="h-1.5 bg-rh-border/60 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-400"
                        style={{
                          width: `${percent}%`,
                          backgroundColor: color,
                        }}
                      />
                    </div>

                    {/* Breakdown */}
                    <div className="flex justify-between mt-2 text-xs text-rh-text-muted">
                      <span>{cat.count} transactions</span>
                      {cat.frivolous > 0 && (
                        <span className="text-rh-red font-medium">
                          {formatCurrency(cat.frivolous)} frivolous
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Pie Chart */}
        <div className="bg-rh-card rounded-2xl p-6 border border-rh-border shadow-card">
          <h2 className="text-base font-semibold text-rh-text mb-5">Distribution</h2>

          {pieData.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    dataKey="value"
                    stroke="none"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1A1D27',
                      border: '1px solid #262A36',
                      borderRadius: '10px',
                      boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
                      fontFamily: 'Inter',
                      fontSize: '13px',
                    }}
                    formatter={(value) => formatCurrency(value)}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-rh-text-secondary">
              <p className="text-sm">No data to display</p>
            </div>
          )}

          {/* Frivolous Toggle */}
          <div className="mt-5 flex items-center justify-center">
            <label className="flex items-center cursor-pointer group">
              <input
                type="checkbox"
                checked={showFrivolousOnly}
                onChange={(e) => setShowFrivolousOnly(e.target.checked)}
                className="sr-only"
              />
              <div className={`w-10 h-6 rounded-full transition-colors ${
                showFrivolousOnly ? 'bg-rh-red' : 'bg-rh-border'
              }`}>
                <div className={`w-4 h-4 mt-1 ml-1 bg-white rounded-full transition-transform shadow-sm ${
                  showFrivolousOnly ? 'translate-x-4' : ''
                }`} />
              </div>
              <span className="ml-3 text-sm text-rh-text-secondary group-hover:text-rh-text transition-colors">Show frivolous only</span>
            </label>
          </div>
        </div>
      </div>

      {/* Transactions List */}
      <div className="bg-rh-card rounded-2xl p-6 border border-rh-border shadow-card">
        <div className="flex items-center gap-3 mb-5">
          <h2 className="text-base font-semibold text-rh-text">Recent Transactions</h2>
          {selectedCategory && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg bg-rh-border text-rh-text-secondary">
              {selectedCategory}
              <button
                onClick={() => setSelectedCategory(null)}
                className="text-rh-text-muted hover:text-rh-text transition-colors"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </span>
          )}
        </div>

        {transactions.length === 0 ? (
          <div className="text-center py-10 text-rh-text-secondary">
            <p className="text-sm">No transactions found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs font-medium text-rh-text-muted uppercase tracking-wider border-b border-rh-border">
                  <th className="pb-3">Date</th>
                  <th className="pb-3">Merchant</th>
                  <th className="pb-3">Category</th>
                  <th className="pb-3 text-right">Amount</th>
                  <th className="pb-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {transactions.slice(0, 20).map((txn) => (
                  <tr key={txn.id} className="border-b border-rh-border/30 hover:bg-rh-black/30 transition-colors">
                    <td className="py-3.5 text-rh-text-muted text-sm">
                      {format(new Date(txn.date), 'MMM d')}
                    </td>
                    <td className="py-3.5">
                      <div className="text-sm text-rh-text font-medium">{txn.merchant_name || txn.description}</div>
                    </td>
                    <td className="py-3.5 text-rh-text-secondary text-sm">
                      {txn.category || 'Uncategorized'}
                    </td>
                    <td className="py-3.5 text-right text-sm text-rh-text font-semibold">
                      {formatCurrency(txn.amount)}
                    </td>
                    <td className="py-3.5 text-center">
                      {txn.is_frivolous ? (
                        <span className="px-2.5 py-1 text-xs font-medium rounded-lg bg-rh-red-glow text-rh-red">
                          Frivolous
                        </span>
                      ) : txn.is_discretionary ? (
                        <span className="px-2.5 py-1 text-xs font-medium rounded-lg bg-yellow-500/10 text-yellow-400">
                          Discretionary
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 text-xs font-medium rounded-lg bg-rh-green-glow text-rh-green">
                          Necessary
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {transactions.length > 20 && (
              <div className="text-center py-4 text-rh-text-muted text-xs font-medium">
                Showing 20 of {transactions.length} transactions
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default Spending;
