# Business logic services for NetWorthCalculator

from datetime import datetime, date, timedelta
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func, and_

from models import (
    Account, AccountType, BalanceHistory, Holding, HoldingHistory,
    Transaction, Budget, CategoryConfig, NetWorthHistory, PlaidItem,
    seed_default_categories
)


class AccountService:
    """Service for managing accounts"""

    @staticmethod
    def create_or_update_account(
        session: Session,
        plaid_account_id: str,
        plaid_item_id: str,
        institution_name: str,
        name: str,
        account_type: str,
        official_name: str = None,
        mask: str = None
    ) -> Account:
        """Create or update an account from Plaid data"""
        type_mapping = {
            "depository": AccountType.CHECKING,
            "checking": AccountType.CHECKING,
            "savings": AccountType.SAVINGS,
            "credit": AccountType.CREDIT_CARD,
            "investment": AccountType.BROKERAGE,
            "brokerage": AccountType.BROKERAGE,
            "retirement": AccountType.RETIREMENT,
        }

        account = session.query(Account).filter_by(plaid_account_id=plaid_account_id).first()

        if not account:
            account = Account(
                plaid_account_id=plaid_account_id,
                plaid_item_id=plaid_item_id,
                institution_name=institution_name,
                name=name,
                official_name=official_name,
                account_type=type_mapping.get(account_type.lower(), AccountType.CHECKING),
                mask=mask,
            )
            session.add(account)
        else:
            account.name = name
            account.official_name = official_name
            account.institution_name = institution_name
            account.updated_at = datetime.utcnow()

        session.commit()
        return account

    @staticmethod
    def get_all_accounts(session: Session) -> List[Account]:
        return session.query(Account).filter_by(is_active=True).all()


class BalanceService:
    """Service for tracking balance history"""

    @staticmethod
    def record_balance(
        session: Session,
        account_id: int,
        current_balance: float,
        available_balance: float = None,
        credit_limit: float = None,
        for_date: date = None
    ) -> BalanceHistory:
        if for_date is None:
            for_date = date.today()

        existing = session.query(BalanceHistory).filter(
            and_(
                BalanceHistory.account_id == account_id,
                BalanceHistory.date == for_date
            )
        ).first()

        if existing:
            existing.current_balance = current_balance
            existing.available_balance = available_balance
            existing.credit_limit = credit_limit
            balance = existing
        else:
            balance = BalanceHistory(
                account_id=account_id,
                date=for_date,
                current_balance=current_balance,
                available_balance=available_balance,
                credit_limit=credit_limit,
            )
            session.add(balance)

        session.commit()
        return balance


class TransactionService:
    """Service for managing transactions"""

    @staticmethod
    def create_or_update_transaction(
        session: Session,
        account_id: int,
        plaid_transaction_id: str,
        txn_date: date,
        amount: float,
        merchant_name: str = None,
        description: str = None,
        category_primary: str = None,
        category_detailed: str = None,
        category_id: str = None,
        pending: bool = False
    ) -> Transaction:
        txn = session.query(Transaction).filter_by(
            plaid_transaction_id=plaid_transaction_id
        ).first()

        is_discretionary = False
        if category_primary:
            cat_config = session.query(CategoryConfig).filter(
                CategoryConfig.plaid_category.ilike(f"%{category_primary}%")
            ).first()
            if cat_config:
                is_discretionary = cat_config.is_discretionary

        if not txn:
            txn = Transaction(
                account_id=account_id,
                plaid_transaction_id=plaid_transaction_id,
                date=txn_date,
                amount=amount,
                merchant_name=merchant_name,
                description=description,
                plaid_category_primary=category_primary,
                plaid_category_detailed=category_detailed,
                plaid_category_id=category_id,
                pending=pending,
                is_discretionary=is_discretionary,
            )
            session.add(txn)
        else:
            txn.amount = amount
            txn.merchant_name = merchant_name
            txn.description = description
            txn.pending = pending
            txn.is_discretionary = is_discretionary
            txn.updated_at = datetime.utcnow()

        session.commit()
        return txn

    @staticmethod
    def get_transactions_for_month(session: Session, year: int, month: int) -> List[Transaction]:
        start_date = date(year, month, 1)
        if month == 12:
            end_date = date(year + 1, 1, 1)
        else:
            end_date = date(year, month + 1, 1)

        return session.query(Transaction).filter(
            and_(
                Transaction.date >= start_date,
                Transaction.date < end_date
            )
        ).order_by(Transaction.date).all()

    @staticmethod
    def calculate_frivolous_spending(session: Session, year: int, month: int):
        """Calculate which transactions are frivolous based on budget rules."""
        transactions = TransactionService.get_transactions_for_month(session, year, month)

        main_budget = session.query(Budget).filter_by(is_main_budget=True, is_active=True).first()
        category_budgets = {
            b.category: b.monthly_limit
            for b in session.query(Budget).filter_by(is_main_budget=False, is_active=True).all()
        }

        main_spending = 0.0
        category_spending = {}

        sorted_txns = sorted(transactions, key=lambda t: (t.date, t.id))

        for txn in sorted_txns:
            if txn.amount <= 0:
                continue

            category = txn.plaid_category_primary or "Uncategorized"

            main_spending += txn.amount
            category_spending[category] = category_spending.get(category, 0) + txn.amount

            is_frivolous = False
            if txn.is_discretionary:
                if category in category_budgets:
                    if category_spending[category] > category_budgets[category]:
                        is_frivolous = True

                if main_budget and main_spending > main_budget.monthly_limit:
                    is_frivolous = True

            txn.is_frivolous = is_frivolous

        session.commit()


class HoldingService:
    """Service for managing investment holdings"""

    @staticmethod
    def update_holdings(session: Session, account_id: int, holdings_data: List[dict]):
        today = date.today()

        session.query(Holding).filter_by(account_id=account_id).delete()

        for h in holdings_data:
            # Handle None symbols (e.g., cash holdings)
            symbol = h.get("symbol") or h.get("name") or "CASH"

            holding = Holding(
                account_id=account_id,
                plaid_security_id=h.get("security_id"),
                symbol=symbol,
                name=h.get("name"),
                quantity=h.get("quantity", 0),
                cost_basis=h.get("cost_basis"),
                current_price=h.get("current_price"),
                current_value=h.get("current_value"),
                iso_currency_code=h.get("currency", "USD"),
                as_of_date=today,
            )
            session.add(holding)

            history = HoldingHistory(
                account_id=account_id,
                symbol=symbol,
                quantity=h.get("quantity", 0),
                current_price=h.get("current_price"),
                current_value=h.get("current_value"),
                date=today,
            )
            session.add(history)

        session.commit()


class NetWorthService:
    """Service for calculating and tracking net worth"""

    @staticmethod
    def calculate_net_worth(session: Session, for_date: date = None) -> dict:
        if for_date is None:
            for_date = date.today()

        accounts = session.query(Account).filter_by(is_active=True).all()

        total_cash = 0.0
        total_investments = 0.0
        total_credit_debt = 0.0

        for account in accounts:
            balance = session.query(BalanceHistory).filter(
                BalanceHistory.account_id == account.id
            ).order_by(BalanceHistory.date.desc()).first()

            if not balance:
                continue

            if account.account_type in [AccountType.CHECKING, AccountType.SAVINGS]:
                total_cash += balance.current_balance
            elif account.account_type in [AccountType.BROKERAGE, AccountType.RETIREMENT]:
                total_investments += balance.current_balance
            elif account.account_type == AccountType.CREDIT_CARD:
                total_credit_debt += balance.current_balance

        total_assets = total_cash + total_investments
        total_liabilities = total_credit_debt
        net_worth = total_assets - total_liabilities

        return {
            "date": for_date.isoformat(),
            "total_cash": total_cash,
            "total_investments": total_investments,
            "total_assets": total_assets,
            "total_credit_card_debt": total_credit_debt,
            "total_liabilities": total_liabilities,
            "net_worth": net_worth,
        }

    @staticmethod
    def record_net_worth_snapshot(session: Session, for_date: date = None):
        if for_date is None:
            for_date = date.today()

        data = NetWorthService.calculate_net_worth(session, for_date)

        existing = session.query(NetWorthHistory).filter_by(date=for_date).first()

        if existing:
            existing.total_cash = data["total_cash"]
            existing.total_investments = data["total_investments"]
            existing.total_assets = data["total_assets"]
            existing.total_credit_card_debt = data["total_credit_card_debt"]
            existing.total_liabilities = data["total_liabilities"]
            existing.net_worth = data["net_worth"]
            snapshot = existing
        else:
            snapshot = NetWorthHistory(
                date=for_date,
                total_cash=data["total_cash"],
                total_investments=data["total_investments"],
                total_assets=data["total_assets"],
                total_credit_card_debt=data["total_credit_card_debt"],
                total_liabilities=data["total_liabilities"],
                net_worth=data["net_worth"],
            )
            session.add(snapshot)

        session.commit()
        return snapshot

    @staticmethod
    def get_net_worth_history(session: Session, days: int = 30) -> List[NetWorthHistory]:
        start_date = date.today() - timedelta(days=days)
        return session.query(NetWorthHistory).filter(
            NetWorthHistory.date >= start_date
        ).order_by(NetWorthHistory.date).all()


class BudgetService:
    """Service for managing budgets"""

    @staticmethod
    def set_main_budget(session: Session, monthly_limit: float) -> Budget:
        budget = session.query(Budget).filter_by(is_main_budget=True).first()

        if budget:
            budget.monthly_limit = monthly_limit
            budget.updated_at = datetime.utcnow()
        else:
            budget = Budget(
                category="MAIN",
                monthly_limit=monthly_limit,
                is_main_budget=True,
            )
            session.add(budget)

        session.commit()
        return budget

    @staticmethod
    def set_category_budget(session: Session, category: str, monthly_limit: float) -> Budget:
        budget = session.query(Budget).filter_by(
            category=category,
            is_main_budget=False
        ).first()

        if budget:
            budget.monthly_limit = monthly_limit
            budget.updated_at = datetime.utcnow()
        else:
            budget = Budget(
                category=category,
                monthly_limit=monthly_limit,
                is_main_budget=False,
            )
            session.add(budget)

        session.commit()
        return budget

    @staticmethod
    def get_all_budgets(session: Session) -> List[Budget]:
        return session.query(Budget).filter_by(is_active=True).all()

    @staticmethod
    def get_budget_status(session: Session, year: int, month: int) -> dict:
        budgets = BudgetService.get_all_budgets(session)
        transactions = TransactionService.get_transactions_for_month(session, year, month)

        category_spending = {}
        total_spending = 0.0

        for txn in transactions:
            if txn.amount > 0:
                category = txn.plaid_category_primary or "Uncategorized"
                category_spending[category] = category_spending.get(category, 0) + txn.amount
                total_spending += txn.amount

        status = {
            "main_budget": None,
            "category_budgets": [],
            "total_spending": total_spending,
        }

        for budget in budgets:
            if budget.is_main_budget:
                status["main_budget"] = {
                    "limit": budget.monthly_limit,
                    "spent": total_spending,
                    "remaining": budget.monthly_limit - total_spending,
                    "percentage": (total_spending / budget.monthly_limit * 100) if budget.monthly_limit > 0 else 0,
                }
            else:
                spent = category_spending.get(budget.category, 0)
                status["category_budgets"].append({
                    "category": budget.category,
                    "limit": budget.monthly_limit,
                    "spent": spent,
                    "remaining": budget.monthly_limit - spent,
                    "percentage": (spent / budget.monthly_limit * 100) if budget.monthly_limit > 0 else 0,
                })

        return status
