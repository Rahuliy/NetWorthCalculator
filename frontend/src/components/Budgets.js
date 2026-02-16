import React, { useState, useEffect } from 'react';
import { getBudgets, setBudget, getBudgetStatus } from '../api';
import { format } from 'date-fns';

const formatCurrency = (value) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const SUGGESTED_CATEGORIES = [
  'Food and Drink',
  'Restaurants',
  'Shopping',
  'Entertainment',
  'Travel',
  'Personal Care',
  'Groceries',
  'Transportation',
];

function Budgets() {
  const [budgets, setBudgets] = useState([]);
  const [budgetStatus, setBudgetStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newBudget, setNewBudget] = useState({ category: '', limit: '', isMain: false });
  const [selectedMonth] = useState(new Date());

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const year = selectedMonth.getFullYear();
      const month = selectedMonth.getMonth() + 1;

      const [budgetsRes, statusRes] = await Promise.all([
        getBudgets(),
        getBudgetStatus(year, month),
      ]);

      setBudgets(budgetsRes.data);
      setBudgetStatus(statusRes.data);
    } catch (error) {
      console.error('Error loading budgets:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddBudget = async (e) => {
    e.preventDefault();
    try {
      await setBudget(
        newBudget.isMain ? 'MAIN' : newBudget.category,
        parseFloat(newBudget.limit),
        newBudget.isMain
      );
      setNewBudget({ category: '', limit: '', isMain: false });
      setShowAddForm(false);
      loadData();
    } catch (error) {
      console.error('Error adding budget:', error);
    }
  };

  const getProgressColor = (percentage) => {
    if (percentage >= 100) return 'bg-rh-red';
    if (percentage >= 80) return 'bg-yellow-500';
    return 'bg-rh-green';
  };

  const getProgressGlow = (percentage) => {
    if (percentage >= 100) return 'shadow-glow-red';
    return '';
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
          <h1 className="text-2xl font-bold text-rh-text tracking-tight">Budgets</h1>
          <p className="text-sm text-rh-text-secondary mt-1">
            {format(selectedMonth, 'MMMM yyyy')} — Manage your spending limits
          </p>
        </div>

        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-rh-green hover:bg-rh-green-dark text-black font-semibold rounded-lg transition-all hover:scale-[1.02] active:scale-[0.98] shadow-glow-green"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add Budget
        </button>
      </div>

      {/* Main Budget Card */}
      {budgetStatus?.main_budget && (
        <div className={`bg-rh-card rounded-2xl p-6 border border-rh-border shadow-card ${getProgressGlow(budgetStatus.main_budget.percentage)}`}>
          <div className="flex justify-between items-start mb-5">
            <div>
              <h2 className="text-base font-semibold text-rh-text">Main Budget</h2>
              <p className="text-xs text-rh-text-muted mt-0.5">Total monthly spending limit</p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-rh-text tracking-tight">
                {formatCurrency(budgetStatus.main_budget.spent)}
              </div>
              <div className="text-xs text-rh-text-muted mt-0.5">
                of {formatCurrency(budgetStatus.main_budget.limit)}
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-3 bg-rh-border/60 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-400 ${getProgressColor(budgetStatus.main_budget.percentage)}`}
              style={{ width: `${Math.min(budgetStatus.main_budget.percentage, 100)}%` }}
            />
          </div>

          <div className="flex justify-between mt-3 text-sm">
            <span className={`font-medium ${budgetStatus.main_budget.remaining >= 0 ? 'text-rh-green' : 'text-rh-red'}`}>
              {budgetStatus.main_budget.remaining >= 0
                ? `${formatCurrency(budgetStatus.main_budget.remaining)} remaining`
                : `${formatCurrency(Math.abs(budgetStatus.main_budget.remaining))} over budget`}
            </span>
            <span className="text-rh-text-muted font-medium">
              {budgetStatus.main_budget.percentage.toFixed(0)}%
            </span>
          </div>
        </div>
      )}

      {/* Category Budgets */}
      <div className="bg-rh-card rounded-2xl p-6 border border-rh-border shadow-card">
        <h2 className="text-base font-semibold text-rh-text mb-5">Category Budgets</h2>

        {!budgetStatus?.category_budgets || budgetStatus.category_budgets.length === 0 ? (
          <div className="text-center py-10 text-rh-text-secondary">
            <div className="w-12 h-12 rounded-full bg-rh-border/50 flex items-center justify-center mx-auto mb-3">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-rh-text-muted">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="12" x2="15" y2="15" />
              </svg>
            </div>
            <p className="font-medium">No category budgets set</p>
            <p className="text-sm mt-1 text-rh-text-muted">Add budgets to track spending by category.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {budgetStatus.category_budgets.map((budget, index) => (
              <div key={index} className="p-4 rounded-xl bg-rh-black/30 hover:bg-rh-black/50 hover:scale-[1.01] active:scale-[0.99] transition-all duration-300">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-sm text-rh-text font-semibold">{budget.category}</span>
                  <div className="text-right">
                    <span className="text-sm text-rh-text font-semibold">{formatCurrency(budget.spent)}</span>
                    <span className="text-xs text-rh-text-muted"> / {formatCurrency(budget.limit)}</span>
                  </div>
                </div>

                <div className="h-2 bg-rh-border/60 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-400 ${getProgressColor(budget.percentage)}`}
                    style={{ width: `${Math.min(budget.percentage, 100)}%` }}
                  />
                </div>

                <div className="flex justify-between mt-2 text-xs">
                  <span className={`font-medium ${budget.remaining >= 0 ? 'text-rh-green' : 'text-rh-red'}`}>
                    {budget.remaining >= 0
                      ? `${formatCurrency(budget.remaining)} left`
                      : `${formatCurrency(Math.abs(budget.remaining))} over`}
                  </span>
                  <span className="text-rh-text-muted font-medium">{budget.percentage.toFixed(0)}%</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* All Budgets List */}
      <div className="bg-rh-card rounded-2xl p-6 border border-rh-border shadow-card">
        <h2 className="text-base font-semibold text-rh-text mb-5">All Budget Rules</h2>

        {budgets.length === 0 ? (
          <div className="text-center py-10 text-rh-text-secondary">
            <p className="text-sm">No budgets configured</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs font-medium text-rh-text-muted uppercase tracking-wider border-b border-rh-border">
                  <th className="pb-3">Type</th>
                  <th className="pb-3">Category</th>
                  <th className="pb-3 text-right">Monthly Limit</th>
                </tr>
              </thead>
              <tbody>
                {budgets.map((budget) => (
                  <tr key={budget.id} className="border-b border-rh-border/30 hover:bg-rh-black/30 transition-colors">
                    <td className="py-3.5">
                      {budget.is_main ? (
                        <span className="px-2.5 py-1 text-xs font-medium rounded-lg bg-rh-green-glow text-rh-green">
                          Main
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 text-xs font-medium rounded-lg bg-rh-border text-rh-text-secondary">
                          Category
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 text-sm text-rh-text font-medium">
                      {budget.is_main ? 'Total Spending' : budget.category}
                    </td>
                    <td className="py-3.5 text-right text-sm text-rh-text font-semibold">
                      {formatCurrency(budget.monthly_limit)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Budget Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-rh-card rounded-2xl p-8 w-full max-w-md border border-rh-border shadow-card-hover">
            <h2 className="text-lg font-bold text-rh-text mb-6">Add Budget</h2>

            <form onSubmit={handleAddBudget} className="space-y-5">
              {/* Budget Type */}
              <div>
                <label className="flex items-center cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={newBudget.isMain}
                    onChange={(e) => setNewBudget({ ...newBudget, isMain: e.target.checked })}
                    className="sr-only"
                  />
                  <div className={`w-10 h-6 rounded-full transition-colors ${
                    newBudget.isMain ? 'bg-rh-green' : 'bg-rh-border'
                  }`}>
                    <div className={`w-4 h-4 mt-1 ml-1 bg-white rounded-full transition-transform shadow-sm ${
                      newBudget.isMain ? 'translate-x-4' : ''
                    }`} />
                  </div>
                  <span className="ml-3 text-sm text-rh-text group-hover:text-rh-green transition-colors">Main Budget (total monthly limit)</span>
                </label>
              </div>

              {/* Category Selection */}
              {!newBudget.isMain && (
                <div>
                  <label className="block text-xs font-medium text-rh-text-secondary uppercase tracking-wider mb-2">Category</label>
                  <select
                    value={newBudget.category}
                    onChange={(e) => setNewBudget({ ...newBudget, category: e.target.value })}
                    className="w-full bg-rh-black border border-rh-border rounded-xl px-4 py-2.5 text-sm text-rh-text cursor-pointer"
                    required={!newBudget.isMain}
                  >
                    <option value="">Select a category</option>
                    {SUGGESTED_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Monthly Limit */}
              <div>
                <label className="block text-xs font-medium text-rh-text-secondary uppercase tracking-wider mb-2">Monthly Limit</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-rh-text-muted text-sm">$</span>
                  <input
                    type="number"
                    value={newBudget.limit}
                    onChange={(e) => setNewBudget({ ...newBudget, limit: e.target.value })}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    className="w-full bg-rh-black border border-rh-border rounded-xl pl-8 pr-4 py-2.5 text-sm text-rh-text"
                    required
                  />
                </div>
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="flex-1 px-4 py-2.5 border border-rh-border text-sm text-rh-text font-medium rounded-xl hover:bg-rh-border/50 transition-all active:scale-[0.98]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2.5 bg-rh-green hover:bg-rh-green-dark text-black text-sm font-semibold rounded-xl transition-all hover:scale-[1.01] active:scale-[0.98]"
                >
                  Add Budget
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Budgets;
