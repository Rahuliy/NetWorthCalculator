# Plaid API integration service

import plaid
from plaid.api import plaid_api
from plaid.model.link_token_create_request import LinkTokenCreateRequest
from plaid.model.link_token_create_request_user import LinkTokenCreateRequestUser
from plaid.model.item_public_token_exchange_request import ItemPublicTokenExchangeRequest
from plaid.model.accounts_get_request import AccountsGetRequest
from plaid.model.transactions_sync_request import TransactionsSyncRequest
from plaid.model.investments_holdings_get_request import InvestmentsHoldingsGetRequest
from plaid.model.investments_transactions_get_request import InvestmentsTransactionsGetRequest
from plaid.model.products import Products
from plaid.model.country_code import CountryCode

from datetime import datetime, date, timedelta
from typing import Optional
from config import settings, PLAID_ENV_URLS


class PlaidService:
    """Service for interacting with Plaid API"""

    def __init__(self):
        # Configure Plaid client
        configuration = plaid.Configuration(
            host=PLAID_ENV_URLS[settings.PLAID_ENV],
            api_key={
                "clientId": settings.PLAID_CLIENT_ID,
                "secret": settings.PLAID_SECRET,
            }
        )
        api_client = plaid.ApiClient(configuration)
        self.client = plaid_api.PlaidApi(api_client)

    def create_link_token(self, user_id: str = "user-1") -> dict:
        """
        Create a Link token for initializing Plaid Link in the frontend.
        This is the first step to connect a new bank account.
        """
        products = []
        for product in settings.PLAID_PRODUCTS:
            products.append(Products(product))

        request = LinkTokenCreateRequest(
            user=LinkTokenCreateRequestUser(client_user_id=user_id),
            client_name="NetWorth Calculator",
            products=products,
            country_codes=[CountryCode("US")],
            language="en",
        )

        response = self.client.link_token_create(request)
        return {"link_token": response.link_token}

    def exchange_public_token(self, public_token: str) -> dict:
        """
        Exchange a public token (from Plaid Link) for an access token.
        The access token is used for all subsequent API calls.
        """
        request = ItemPublicTokenExchangeRequest(public_token=public_token)
        response = self.client.item_public_token_exchange(request)

        return {
            "access_token": response.access_token,
            "item_id": response.item_id,
        }

    def get_accounts(self, access_token: str) -> dict:
        """Get all accounts associated with an access token"""
        request = AccountsGetRequest(access_token=access_token)
        response = self.client.accounts_get(request)

        accounts = []
        for account in response.accounts:
            accounts.append({
                "account_id": account.account_id,
                "name": account.name,
                "official_name": account.official_name,
                "type": account.type.value,
                "subtype": account.subtype.value if account.subtype else None,
                "mask": account.mask,
                "balances": {
                    "current": account.balances.current,
                    "available": account.balances.available,
                    "limit": account.balances.limit,
                    "currency": account.balances.iso_currency_code,
                }
            })

        return {
            "accounts": accounts,
            "item": {
                "item_id": response.item.item_id,
                "institution_id": response.item.institution_id,
            }
        }

    def sync_transactions(self, access_token: str, cursor: Optional[str] = None) -> dict:
        """
        Sync transactions using Plaid's transactions/sync endpoint.
        This is more efficient than the older transactions/get endpoint.
        """
        all_added = []
        all_modified = []
        all_removed = []
        has_more = True
        next_cursor = cursor

        while has_more:
            request = TransactionsSyncRequest(
                access_token=access_token,
                cursor=next_cursor if next_cursor else "",
            )
            response = self.client.transactions_sync(request)

            all_added.extend(response.added)
            all_modified.extend(response.modified)
            all_removed.extend(response.removed)

            has_more = response.has_more
            next_cursor = response.next_cursor

        # Format transactions
        transactions = []
        for txn in all_added + all_modified:
            transactions.append({
                "transaction_id": txn.transaction_id,
                "account_id": txn.account_id,
                "date": txn.date.isoformat() if isinstance(txn.date, date) else txn.date,
                "amount": txn.amount,
                "merchant_name": txn.merchant_name,
                "name": txn.name,
                "category": txn.category,  # List like ["Food and Drink", "Restaurants"]
                "category_id": txn.category_id,
                "pending": txn.pending,
                "personal_finance_category": {
                    "primary": txn.personal_finance_category.primary if txn.personal_finance_category else None,
                    "detailed": txn.personal_finance_category.detailed if txn.personal_finance_category else None,
                } if txn.personal_finance_category else None,
            })

        return {
            "transactions": transactions,
            "removed": [r.transaction_id for r in all_removed],
            "cursor": next_cursor,
        }

    def get_investment_holdings(self, access_token: str) -> dict:
        """Get current investment holdings"""
        request = InvestmentsHoldingsGetRequest(access_token=access_token)
        response = self.client.investments_holdings_get(request)

        # Build security lookup
        securities = {}
        for security in response.securities:
            securities[security.security_id] = {
                "symbol": security.ticker_symbol,
                "name": security.name,
                "type": security.type,
                "close_price": security.close_price,
            }

        holdings = []
        for holding in response.holdings:
            security = securities.get(holding.security_id, {})
            holdings.append({
                "account_id": holding.account_id,
                "security_id": holding.security_id,
                "symbol": security.get("symbol"),
                "name": security.get("name"),
                "quantity": holding.quantity,
                "cost_basis": holding.cost_basis,
                "current_price": security.get("close_price"),
                "current_value": holding.institution_value,
                "currency": holding.iso_currency_code,
            })

        return {
            "holdings": holdings,
            "accounts": [
                {
                    "account_id": acc.account_id,
                    "name": acc.name,
                    "type": acc.type.value,
                    "balances": {
                        "current": acc.balances.current,
                    }
                }
                for acc in response.accounts
            ]
        }

    def get_liabilities(self, access_token: str) -> dict:
        """Get credit card and loan information"""
        # Note: This requires the "liabilities" product
        # For now, we get credit card balances from accounts_get
        # Full liabilities endpoint provides more detail (APR, minimum payment, etc.)
        return self.get_accounts(access_token)


# Singleton instance
plaid_service = PlaidService()
