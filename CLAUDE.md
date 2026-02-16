# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

NetWorth Calculator is a personal finance tracking application that aggregates bank accounts, credit cards, and investment accounts via Plaid API. It provides net worth tracking, spending analysis with frivolous vs necessary categorization, budget management, and investment portfolio views.

## Tech Stack

- **Backend**: Python 3.9+, FastAPI, SQLAlchemy, SQLite
- **Frontend**: React 18, Tailwind CSS, Recharts
- **API Integration**: Plaid (banking data aggregation)

## Build & Run Commands

### Backend
```bash
cd backend
pip install -r requirements.txt
cp .env.example .env  # Then edit with your Plaid credentials
python main.py        # Starts server on http://127.0.0.1:8000
```

### Frontend
```bash
cd frontend
npm install
npm start             # Starts dev server on http://localhost:3000
```

### Running Both
Start the backend first (API server), then start the frontend (React dev server).

## Architecture

```
NetWorthCalculator/
├── backend/
│   ├── main.py           # FastAPI app, API endpoints, scheduler
│   ├── models.py         # SQLAlchemy ORM models (Account, Transaction, etc.)
│   ├── services.py       # Business logic (NetWorthService, BudgetService, etc.)
│   ├── plaid_service.py  # Plaid API wrapper
│   └── config.py         # Environment config
└── frontend/
    └── src/
        ├── App.js        # Router and navigation
        ├── api.js        # Backend API client
        └── components/   # React components (Dashboard, Investments, Spending, Budgets, Settings)
```

## Key Concepts

### Frivolous Spending Logic
Transactions are marked frivolous when:
1. The category is discretionary (restaurants, entertainment, shopping, etc.)
2. AND either the category budget OR main budget has been exceeded

Categories are pre-configured in `models.py` as `DEFAULT_DISCRETIONARY_CATEGORIES` and `DEFAULT_ESSENTIAL_CATEGORIES`.

### Data Flow
1. User connects bank via Plaid Link (frontend Settings page)
2. Backend exchanges public token for access token, stores in `PlaidItem`
3. Transactions/balances synced via `sync_item_data()` in `main.py`
4. Daily scheduler runs `daily_refresh_job()` at configured time
5. Net worth snapshots recorded in `NetWorthHistory` table

### Database Schema
- `Account` - Linked financial accounts
- `BalanceHistory` - Daily balance snapshots
- `Holding` / `HoldingHistory` - Investment positions
- `Transaction` - All transactions with Plaid categories
- `Budget` - Main and per-category budgets
- `CategoryConfig` - Discretionary vs essential mapping
- `NetWorthHistory` - Daily net worth snapshots
- `PlaidItem` - Plaid access tokens per institution

## Plaid Setup

1. Create account at https://dashboard.plaid.com
2. Get Client ID and Secret from dashboard
3. Use "sandbox" environment for testing with fake data
4. Request "development" access to connect real accounts (free for personal use)
