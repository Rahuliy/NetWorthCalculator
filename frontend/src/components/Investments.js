import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { getHoldings } from '../api';

const formatCurrency = (value) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

const formatPercent = (value) => {
  const prefix = value >= 0 ? '+' : '';
  return `${prefix}${value.toFixed(2)}%`;
};

// Color palette for holdings
const COLORS = ['#00D632', '#4ADE80', '#34D399', '#2DD4BF', '#22D3EE', '#60A5FA', '#818CF8', '#A78BFA'];

function Investments() {
  const [holdings, setHoldings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('value'); // value, gainLoss, symbol

  useEffect(() => {
    loadHoldings();
  }, []);

  const loadHoldings = async () => {
    try {
      const response = await getHoldings();
      setHoldings(response.data);
    } catch (error) {
      console.error('Error loading holdings:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate totals
  const totalValue = holdings.reduce((sum, h) => sum + (h.current_value || 0), 0);
  const totalCostBasis = holdings.reduce((sum, h) => sum + (h.cost_basis || 0), 0);
  const totalGainLoss = totalValue - totalCostBasis;
  const totalGainLossPercent = totalCostBasis > 0 ? (totalGainLoss / totalCostBasis) * 100 : 0;

  // Sort holdings
  const sortedHoldings = [...holdings].sort((a, b) => {
    switch (sortBy) {
      case 'value':
        return (b.current_value || 0) - (a.current_value || 0);
      case 'gainLoss':
        return (b.gain_loss || 0) - (a.gain_loss || 0);
      case 'symbol':
        return a.symbol.localeCompare(b.symbol);
      default:
        return 0;
    }
  });

  // Pie chart data
  const pieData = holdings
    .filter(h => h.current_value > 0)
    .map((h, index) => ({
      name: h.symbol,
      value: h.current_value,
      color: COLORS[index % COLORS.length],
    }));

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
      <div>
        <h1 className="text-2xl font-bold text-rh-text tracking-tight">Investments</h1>
        <p className="text-sm text-rh-text-secondary mt-1">Track your portfolio performance</p>
      </div>

      {/* Portfolio Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-rh-card rounded-2xl p-6 border border-rh-border shadow-card">
          <div className="flex justify-between items-start mb-8">
            <div>
              <div className="text-xs font-medium text-rh-text-secondary uppercase tracking-wider">Total Portfolio Value</div>
              <div className="text-3xl font-bold text-rh-text mt-1 tracking-tight">{formatCurrency(totalValue)}</div>
              <div className={`flex items-center mt-2 ${totalGainLoss >= 0 ? 'text-rh-green' : 'text-rh-red'}`}>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-sm font-semibold ${
                  totalGainLoss >= 0 ? 'bg-rh-green-glow' : 'bg-rh-red-glow'
                }`}>
                  {formatCurrency(totalGainLoss)}
                  <span className="text-xs font-medium opacity-80">({formatPercent(totalGainLossPercent)})</span>
                </span>
                <span className="ml-3 text-rh-text-muted text-sm">All time</span>
              </div>
            </div>
          </div>

          {/* Holdings Table */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-semibold text-rh-text">Holdings</h3>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-rh-black border border-rh-border rounded-lg px-4 py-2 text-xs font-medium text-rh-text-secondary cursor-pointer hover:border-rh-border-light hover:scale-[1.02] transition-all duration-250"
              >
                <option value="value">Sort by Value</option>
                <option value="gainLoss">Sort by Gain/Loss</option>
                <option value="symbol">Sort by Symbol</option>
              </select>
            </div>

            {holdings.length === 0 ? (
              <div className="text-center py-10 text-rh-text-secondary">
                <div className="w-12 h-12 rounded-full bg-rh-border/50 flex items-center justify-center mx-auto mb-3">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-rh-text-muted">
                    <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
                    <polyline points="16 7 22 7 22 13" />
                  </svg>
                </div>
                <p className="font-medium">No investment holdings found</p>
                <p className="text-sm mt-1 text-rh-text-muted">Connect a brokerage account to see your holdings.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-xs font-medium text-rh-text-muted uppercase tracking-wider border-b border-rh-border">
                      <th className="pb-3">Symbol</th>
                      <th className="pb-3 text-right">Shares</th>
                      <th className="pb-3 text-right">Price</th>
                      <th className="pb-3 text-right">Value</th>
                      <th className="pb-3 text-right">Cost Basis</th>
                      <th className="pb-3 text-right">Gain/Loss</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedHoldings.map((holding, index) => (
                      <tr key={index} className="border-b border-rh-border/30 hover:bg-rh-black/30 transition-colors">
                        <td className="py-4">
                          <div className="font-semibold text-sm text-rh-text">{holding.symbol}</div>
                          <div className="text-xs text-rh-text-muted truncate max-w-xs mt-0.5">
                            {holding.name}
                          </div>
                        </td>
                        <td className="py-4 text-right text-sm text-rh-text-secondary">
                          {holding.quantity?.toFixed(4)}
                        </td>
                        <td className="py-4 text-right text-sm text-rh-text-secondary">
                          {holding.current_price ? formatCurrency(holding.current_price) : '-'}
                        </td>
                        <td className="py-4 text-right text-sm text-rh-text font-semibold">
                          {holding.current_value ? formatCurrency(holding.current_value) : '-'}
                        </td>
                        <td className="py-4 text-right text-sm text-rh-text-muted">
                          {holding.cost_basis ? formatCurrency(holding.cost_basis) : '-'}
                        </td>
                        <td className={`py-4 text-right font-semibold text-sm ${
                          (holding.gain_loss || 0) >= 0 ? 'text-rh-green' : 'text-rh-red'
                        }`}>
                          {holding.gain_loss !== null ? (
                            <div>
                              <div>{formatCurrency(holding.gain_loss)}</div>
                              <div className="text-xs font-medium opacity-75">
                                {formatPercent(holding.gain_loss_percent || 0)}
                              </div>
                            </div>
                          ) : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Allocation Chart */}
        <div className="bg-rh-card rounded-2xl p-6 border border-rh-border shadow-card">
          <h3 className="text-base font-semibold text-rh-text mb-5">Allocation</h3>

          {pieData.length > 0 ? (
            <>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={70}
                      dataKey="value"
                      stroke="none"
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

              <div className="space-y-2.5 mt-5">
                {pieData.slice(0, 6).map((item, index) => {
                  const percent = totalValue > 0 ? (item.value / totalValue) * 100 : 0;
                  return (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div
                          className="w-2.5 h-2.5 rounded-full mr-2.5"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="text-sm text-rh-text font-medium">{item.name}</span>
                      </div>
                      <span className="text-sm text-rh-text-secondary font-medium">{percent.toFixed(1)}%</span>
                    </div>
                  );
                })}
                {pieData.length > 6 && (
                  <div className="text-xs text-rh-text-muted text-center pt-2">
                    +{pieData.length - 6} more
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="text-center py-10 text-rh-text-secondary">
              <p className="text-sm">No holdings to display</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Investments;
