# FastAPI application for NetWorthCalculator

from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from datetime import date, datetime
from contextlib import asynccontextmanager

from apscheduler.schedulers.background import BackgroundScheduler

from config import settings
from models import (
    init_db, get_session, seed_default_categories,
    Account, PlaidItem, Holding, Transaction, NetWorthHistory, Budget
)
from services import (
    AccountService, BalanceService, TransactionService,
    HoldingService, NetWorthService, BudgetService
)
from plaid_service import plaid_service


# Database setup
engine = init_db(settings.DATABASE_PATH)

def get_db():
    session = get_session(engine)
    try:
        yield session
    finally:
        session.close()


# Scheduled job for daily refresh
def daily_refresh_job():
    """Refresh all accounts daily"""
    session = get_session(engine)
    try:
        items = session.query(PlaidItem).filter_by(status="active").all()
        for item in items:
            try:
                sync_item_data(session, item)
            except Exception as e:
                print(f"Error syncing item {item.id}: {e}")

        # Record net worth snapshot
        NetWorthService.record_net_worth_snapshot(session)

        # Recalculate frivolous spending
        today = date.today()
        TransactionService.calculate_frivolous_spending(session, today.year, today.month)
    finally:
        session.close()


def sync_item_data(session, item: PlaidItem):
    """Sync all data for a Plaid item"""
    # Get accounts and balances
    accounts_data = plaid_service.get_accounts(item.access_token)

    for acc in accounts_data["accounts"]:
        account = AccountService.create_or_update_account(
            session,
            plaid_account_id=acc["account_id"],
            plaid_item_id=item.plaid_item_id,
            institution_name=item.institution_name,
            name=acc["name"],
            account_type=acc["type"],
            official_name=acc["official_name"],
            mask=acc["mask"],
        )

        # Record balance
        BalanceService.record_balance(
            session,
            account_id=account.id,
            current_balance=acc["balances"]["current"] or 0,
            available_balance=acc["balances"]["available"],
            credit_limit=acc["balances"]["limit"],
        )

    # Sync transactions
    txn_data = plaid_service.sync_transactions(item.access_token)
    for txn in txn_data["transactions"]:
        account = session.query(Account).filter_by(
            plaid_account_id=txn["account_id"]
        ).first()
        if account:
            pfc = txn.get("personal_finance_category") or {}
            TransactionService.create_or_update_transaction(
                session,
                account_id=account.id,
                plaid_transaction_id=txn["transaction_id"],
                txn_date=date.fromisoformat(txn["date"]),
                amount=txn["amount"],
                merchant_name=txn["merchant_name"],
                description=txn["name"],
                category_primary=pfc.get("primary"),
                category_detailed=pfc.get("detailed"),
                pending=txn["pending"],
            )

    # Sync investments if available
    try:
        holdings_data = plaid_service.get_investment_holdings(item.access_token)
        for holding in holdings_data["holdings"]:
            account = session.query(Account).filter_by(
                plaid_account_id=holding["account_id"]
            ).first()
            if account:
                HoldingService.update_holdings(session, account.id, [holding])
    except Exception:
        pass  # Not all accounts have investments

    # Update last sync time
    item.last_successful_sync = datetime.utcnow()
    session.commit()


# Scheduler setup
scheduler = BackgroundScheduler()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    session = get_session(engine)
    seed_default_categories(session)
    session.close()

    # Schedule daily refresh
    scheduler.add_job(
        daily_refresh_job,
        'cron',
        hour=settings.DAILY_REFRESH_HOUR,
        minute=settings.DAILY_REFRESH_MINUTE
    )
    scheduler.start()

    yield

    # Shutdown
    scheduler.shutdown()


# FastAPI app
app = FastAPI(
    title="NetWorth Calculator API",
    description="Personal finance tracking with Plaid integration",
    version="1.0.0",
    lifespan=lifespan
)

# CORS for React frontend
import os
cors_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]
# Allow Railway frontend domain via env var
frontend_url = os.getenv("FRONTEND_URL", "")
if frontend_url:
    cors_origins.append(frontend_url)

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Pydantic models for API
class LinkTokenResponse(BaseModel):
    link_token: str

class PublicTokenRequest(BaseModel):
    public_token: str
    institution_name: str

class BudgetRequest(BaseModel):
    category: Optional[str] = None
    monthly_limit: float
    is_main: bool = False

class AccountResponse(BaseModel):
    id: int
    institution_name: str
    name: str
    account_type: str
    mask: Optional[str]
    current_balance: Optional[float]

class HoldingResponse(BaseModel):
    symbol: str
    name: Optional[str]
    quantity: float
    cost_basis: Optional[float]
    current_price: Optional[float]
    current_value: Optional[float]
    gain_loss: Optional[float]
    gain_loss_percent: Optional[float]

class TransactionResponse(BaseModel):
    id: int
    date: str
    amount: float
    merchant_name: Optional[str]
    description: Optional[str]
    category: Optional[str]
    is_frivolous: bool

class NetWorthResponse(BaseModel):
    date: str
    total_cash: float
    total_investments: float
    total_assets: float
    total_credit_card_debt: float
    total_liabilities: float
    net_worth: float


# ============== PLAID ENDPOINTS ==============

@app.post("/api/plaid/link-token", response_model=LinkTokenResponse)
async def create_link_token():
    """Create a Plaid Link token for connecting a new account"""
    try:
        result = plaid_service.create_link_token()
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/plaid/exchange-token")
async def exchange_public_token(request: PublicTokenRequest, session=Depends(get_db)):
    """Exchange public token for access token and save the item"""
    try:
        result = plaid_service.exchange_public_token(request.public_token)

        # Save the Plaid item
        item = PlaidItem(
            plaid_item_id=result["item_id"],
            access_token=result["access_token"],
            institution_name=request.institution_name,
        )
        session.add(item)
        session.commit()

        # Initial sync
        sync_item_data(session, item)
        NetWorthService.record_net_worth_snapshot(session)

        return {"success": True, "item_id": result["item_id"]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============== ACCOUNT ENDPOINTS ==============

@app.get("/api/accounts", response_model=List[AccountResponse])
async def get_accounts(session=Depends(get_db)):
    """Get all linked accounts with current balances"""
    accounts = AccountService.get_all_accounts(session)
    result = []

    for acc in accounts:
        balance = session.query(BalanceService).filter_by(
            account_id=acc.id
        ).order_by(BalanceService.date.desc()).first() if hasattr(BalanceService, 'query') else None

        # Get latest balance differently
        from models import BalanceHistory
        balance = session.query(BalanceHistory).filter_by(
            account_id=acc.id
        ).order_by(BalanceHistory.date.desc()).first()

        result.append(AccountResponse(
            id=acc.id,
            institution_name=acc.institution_name,
            name=acc.name,
            account_type=acc.account_type.value,
            mask=acc.mask,
            current_balance=balance.current_balance if balance else None,
        ))

    return result


# ============== NET WORTH ENDPOINTS ==============

@app.get("/api/net-worth/current", response_model=NetWorthResponse)
async def get_current_net_worth(session=Depends(get_db)):
    """Get current net worth breakdown"""
    return NetWorthService.calculate_net_worth(session)


@app.get("/api/net-worth/history")
async def get_net_worth_history(days: int = 30, session=Depends(get_db)):
    """Get net worth history for charting"""
    history = NetWorthService.get_net_worth_history(session, days)
    return [
        {
            "date": h.date.isoformat(),
            "net_worth": h.net_worth,
            "total_assets": h.total_assets,
            "total_liabilities": h.total_liabilities,
        }
        for h in history
    ]


# ============== HOLDINGS ENDPOINTS ==============

@app.get("/api/holdings", response_model=List[HoldingResponse])
async def get_holdings(session=Depends(get_db)):
    """Get all investment holdings"""
    holdings = session.query(Holding).all()
    result = []

    for h in holdings:
        gain_loss = None
        gain_loss_percent = None
        if h.cost_basis and h.current_value:
            gain_loss = h.current_value - h.cost_basis
            gain_loss_percent = (gain_loss / h.cost_basis) * 100 if h.cost_basis > 0 else 0

        result.append(HoldingResponse(
            symbol=h.symbol,
            name=h.name,
            quantity=h.quantity,
            cost_basis=h.cost_basis,
            current_price=h.current_price,
            current_value=h.current_value,
            gain_loss=gain_loss,
            gain_loss_percent=gain_loss_percent,
        ))

    return result


# ============== TRANSACTION ENDPOINTS ==============

@app.get("/api/transactions")
async def get_transactions(
    year: Optional[int] = None,
    month: Optional[int] = None,
    category: Optional[str] = None,
    frivolous_only: bool = False,
    session=Depends(get_db)
):
    """Get transactions with optional filters"""
    today = date.today()
    year = year or today.year
    month = month or today.month

    transactions = TransactionService.get_transactions_for_month(session, year, month)

    if category:
        transactions = [t for t in transactions if t.plaid_category_primary == category]

    if frivolous_only:
        transactions = [t for t in transactions if t.is_frivolous]

    return [
        {
            "id": t.id,
            "date": t.date.isoformat(),
            "amount": t.amount,
            "merchant_name": t.merchant_name,
            "description": t.description,
            "category": t.plaid_category_primary,
            "category_detailed": t.plaid_category_detailed,
            "is_discretionary": t.is_discretionary,
            "is_frivolous": t.is_frivolous,
            "pending": t.pending,
        }
        for t in transactions
    ]


@app.get("/api/spending/by-category")
async def get_spending_by_category(
    year: Optional[int] = None,
    month: Optional[int] = None,
    session=Depends(get_db)
):
    """Get spending breakdown by category"""
    today = date.today()
    year = year or today.year
    month = month or today.month

    transactions = TransactionService.get_transactions_for_month(session, year, month)

    categories = {}
    for t in transactions:
        if t.amount > 0:  # Only outgoing
            cat = t.plaid_category_primary or "Uncategorized"
            if cat not in categories:
                categories[cat] = {
                    "category": cat,
                    "total": 0,
                    "necessary": 0,
                    "frivolous": 0,
                    "count": 0,
                }
            categories[cat]["total"] += t.amount
            categories[cat]["count"] += 1
            if t.is_frivolous:
                categories[cat]["frivolous"] += t.amount
            else:
                categories[cat]["necessary"] += t.amount

    return sorted(categories.values(), key=lambda x: x["total"], reverse=True)


# ============== BUDGET ENDPOINTS ==============

@app.post("/api/budgets")
async def set_budget(request: BudgetRequest, session=Depends(get_db)):
    """Set a main or category budget"""
    if request.is_main:
        budget = BudgetService.set_main_budget(session, request.monthly_limit)
    else:
        if not request.category:
            raise HTTPException(status_code=400, detail="Category required for category budgets")
        budget = BudgetService.set_category_budget(session, request.category, request.monthly_limit)

    return {"success": True, "budget_id": budget.id}


@app.get("/api/budgets")
async def get_budgets(session=Depends(get_db)):
    """Get all budgets"""
    budgets = BudgetService.get_all_budgets(session)
    return [
        {
            "id": b.id,
            "category": b.category,
            "monthly_limit": b.monthly_limit,
            "is_main": b.is_main_budget,
        }
        for b in budgets
    ]


@app.get("/api/budgets/status")
async def get_budget_status(
    year: Optional[int] = None,
    month: Optional[int] = None,
    session=Depends(get_db)
):
    """Get current budget status with spending"""
    today = date.today()
    year = year or today.year
    month = month or today.month

    return BudgetService.get_budget_status(session, year, month)


# ============== SYNC ENDPOINTS ==============

@app.post("/api/sync")
async def manual_sync(session=Depends(get_db)):
    """Manually trigger a sync of all accounts"""
    try:
        items = session.query(PlaidItem).filter_by(status="active").all()
        for item in items:
            sync_item_data(session, item)

        NetWorthService.record_net_worth_snapshot(session)

        today = date.today()
        TransactionService.calculate_frivolous_spending(session, today.year, today.month)

        return {"success": True, "message": "Sync completed"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============== RUN SERVER ==============

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=settings.API_HOST, port=settings.API_PORT)
