# Database models for NetWorthCalculator
# Using SQLite with SQLAlchemy ORM

from datetime import datetime, date
from typing import Optional
from sqlalchemy import (
    create_engine, Column, Integer, String, Float, Boolean,
    Date, DateTime, ForeignKey, Enum as SQLEnum
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship, sessionmaker
import enum

Base = declarative_base()


class AccountType(enum.Enum):
    CHECKING = "checking"
    SAVINGS = "savings"
    CREDIT_CARD = "credit_card"
    BROKERAGE = "brokerage"
    RETIREMENT = "retirement"  # 401k, IRA, etc.


class Account(Base):
    """Linked financial accounts from Plaid"""
    __tablename__ = "accounts"

    id = Column(Integer, primary_key=True)
    plaid_account_id = Column(String, unique=True, nullable=False)
    plaid_item_id = Column(String, nullable=False)  # Plaid's institution link ID
    institution_name = Column(String, nullable=False)  # "Chase", "PNC", "Robinhood"
    name = Column(String, nullable=False)  # "Checking Account", "Brokerage"
    official_name = Column(String)  # Full official name from bank
    account_type = Column(SQLEnum(AccountType), nullable=False)
    mask = Column(String)  # Last 4 digits: "1234"
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    balances = relationship("BalanceHistory", back_populates="account")
    holdings = relationship("Holding", back_populates="account")
    transactions = relationship("Transaction", back_populates="account")


class BalanceHistory(Base):
    """Daily balance snapshots for historical tracking"""
    __tablename__ = "balance_history"

    id = Column(Integer, primary_key=True)
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=False)
    date = Column(Date, nullable=False)
    current_balance = Column(Float, nullable=False)  # Current balance
    available_balance = Column(Float)  # Available (for credit: available credit)
    credit_limit = Column(Float)  # For credit cards only
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    account = relationship("Account", back_populates="balances")


class Holding(Base):
    """Investment positions (stocks, ETFs, etc.)"""
    __tablename__ = "holdings"

    id = Column(Integer, primary_key=True)
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=False)
    plaid_security_id = Column(String)
    symbol = Column(String, nullable=False)  # "AAPL", "VOO"
    name = Column(String)  # "Apple Inc.", "Vanguard S&P 500 ETF"
    quantity = Column(Float, nullable=False)
    cost_basis = Column(Float)  # Total cost basis
    current_price = Column(Float)
    current_value = Column(Float)
    iso_currency_code = Column(String, default="USD")
    as_of_date = Column(Date, nullable=False)  # When this snapshot was taken
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    account = relationship("Account", back_populates="holdings")


class HoldingHistory(Base):
    """Historical holding snapshots for tracking investment growth"""
    __tablename__ = "holding_history"

    id = Column(Integer, primary_key=True)
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=False)
    symbol = Column(String, nullable=False)
    quantity = Column(Float, nullable=False)
    current_price = Column(Float)
    current_value = Column(Float)
    date = Column(Date, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class Transaction(Base):
    """All transactions (spending, income, transfers)"""
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True)
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=False)
    plaid_transaction_id = Column(String, unique=True, nullable=False)

    # Transaction details
    date = Column(Date, nullable=False)
    amount = Column(Float, nullable=False)  # Positive = money out, Negative = money in (Plaid convention)
    merchant_name = Column(String)
    description = Column(String)  # Original transaction name

    # Plaid categorization
    plaid_category_primary = Column(String)  # "Food and Drink"
    plaid_category_detailed = Column(String)  # "Restaurants"
    plaid_category_id = Column(String)

    # Custom categorization
    custom_category = Column(String)  # User override if needed

    # Frivolous tracking
    is_discretionary = Column(Boolean, default=False)  # Category is discretionary
    is_frivolous = Column(Boolean, default=False)  # Exceeded budget

    # Metadata
    pending = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    account = relationship("Account", back_populates="transactions")


class Budget(Base):
    """Monthly budgets - main and per-category"""
    __tablename__ = "budgets"

    id = Column(Integer, primary_key=True)
    category = Column(String, nullable=False)  # "MAIN" for overall, or category name
    monthly_limit = Column(Float, nullable=False)
    is_main_budget = Column(Boolean, default=False)  # True for the main overall budget
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class CategoryConfig(Base):
    """Configuration for which categories are discretionary vs essential"""
    __tablename__ = "category_config"

    id = Column(Integer, primary_key=True)
    plaid_category = Column(String, unique=True, nullable=False)  # Plaid category name
    display_name = Column(String)  # Friendly name for UI
    is_discretionary = Column(Boolean, default=False)  # True = can be frivolous
    created_at = Column(DateTime, default=datetime.utcnow)


class NetWorthHistory(Base):
    """Daily net worth snapshots"""
    __tablename__ = "net_worth_history"

    id = Column(Integer, primary_key=True)
    date = Column(Date, unique=True, nullable=False)

    # Assets
    total_cash = Column(Float, default=0)  # Checking + Savings
    total_investments = Column(Float, default=0)  # Brokerage + Retirement
    total_assets = Column(Float, default=0)

    # Liabilities
    total_credit_card_debt = Column(Float, default=0)
    total_liabilities = Column(Float, default=0)

    # Net worth
    net_worth = Column(Float, default=0)

    created_at = Column(DateTime, default=datetime.utcnow)


class PlaidItem(Base):
    """Plaid Items (institution links) - stores access tokens"""
    __tablename__ = "plaid_items"

    id = Column(Integer, primary_key=True)
    plaid_item_id = Column(String, unique=True, nullable=False)
    access_token = Column(String, nullable=False)  # Encrypted in production
    institution_id = Column(String)
    institution_name = Column(String)
    status = Column(String, default="active")  # active, needs_reauth, error
    last_successful_sync = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# Database initialization
def init_db(db_path: str = "networth.db"):
    """Initialize the database and create all tables"""
    engine = create_engine(f"sqlite:///{db_path}", echo=False)
    Base.metadata.create_all(engine)
    return engine


def get_session(engine):
    """Create a database session"""
    Session = sessionmaker(bind=engine)
    return Session()


# Default category configurations
DEFAULT_DISCRETIONARY_CATEGORIES = [
    "Food and Drink",
    "Restaurants",
    "Fast Food",
    "Coffee Shop",
    "Entertainment",
    "Recreation",
    "Shopping",
    "Clothing",
    "Electronics",
    "Sporting Goods",
    "Travel",
    "Airlines",
    "Hotels",
    "Bars",
    "Alcohol",
    "Tobacco",
    "Gambling",
    "Personal Care",
    "Gyms and Fitness Centers",
]

DEFAULT_ESSENTIAL_CATEGORIES = [
    "Groceries",
    "Supermarkets and Groceries",
    "Rent",
    "Mortgage",
    "Utilities",
    "Gas Stations",
    "Automotive",
    "Insurance",
    "Healthcare",
    "Pharmacy",
    "Medical",
    "Education",
    "Childcare",
    "Government and Non-Profit",
    "Taxes",
    "Bank Fees",
    "Interest",
    "Transfer",
    "Payment",
]


def seed_default_categories(session):
    """Seed the database with default category configurations"""
    existing = session.query(CategoryConfig).first()
    if existing:
        return  # Already seeded

    for cat in DEFAULT_DISCRETIONARY_CATEGORIES:
        config = CategoryConfig(
            plaid_category=cat,
            display_name=cat,
            is_discretionary=True
        )
        session.add(config)

    for cat in DEFAULT_ESSENTIAL_CATEGORIES:
        config = CategoryConfig(
            plaid_category=cat,
            display_name=cat,
            is_discretionary=False
        )
        session.add(config)

    session.commit()
