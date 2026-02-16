// API service for communicating with the backend

import axios from 'axios';

const API_BASE = 'http://127.0.0.1:8000/api';

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Plaid
export const createLinkToken = () => api.post('/plaid/link-token');
export const exchangePublicToken = (publicToken, institutionName) =>
  api.post('/plaid/exchange-token', { public_token: publicToken, institution_name: institutionName });

// Accounts
export const getAccounts = () => api.get('/accounts');

// Net Worth
export const getCurrentNetWorth = () => api.get('/net-worth/current');
export const getNetWorthHistory = (days = 30) => api.get(`/net-worth/history?days=${days}`);

// Holdings
export const getHoldings = () => api.get('/holdings');

// Transactions
export const getTransactions = (year, month, category, frivolousOnly) => {
  const params = new URLSearchParams();
  if (year) params.append('year', year);
  if (month) params.append('month', month);
  if (category) params.append('category', category);
  if (frivolousOnly) params.append('frivolous_only', 'true');
  return api.get(`/transactions?${params}`);
};

export const getSpendingByCategory = (year, month) => {
  const params = new URLSearchParams();
  if (year) params.append('year', year);
  if (month) params.append('month', month);
  return api.get(`/spending/by-category?${params}`);
};

// Budgets
export const getBudgets = () => api.get('/budgets');
export const setBudget = (category, monthlyLimit, isMain = false) =>
  api.post('/budgets', { category, monthly_limit: monthlyLimit, is_main: isMain });
export const getBudgetStatus = (year, month) => {
  const params = new URLSearchParams();
  if (year) params.append('year', year);
  if (month) params.append('month', month);
  return api.get(`/budgets/status?${params}`);
};

// Sync
export const manualSync = () => api.post('/sync');

export default api;
