# Configuration settings for NetWorthCalculator

import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()


class Settings:
    # Plaid API credentials (get these from https://dashboard.plaid.com)
    PLAID_CLIENT_ID: str = os.getenv("PLAID_CLIENT_ID", "")
    PLAID_SECRET: str = os.getenv("PLAID_SECRET", "")

    # Plaid environment: "sandbox", "development", or "production"
    # Use "sandbox" for testing with fake data
    # Use "development" for real accounts (free, requires approval)
    PLAID_ENV: str = os.getenv("PLAID_ENV", "sandbox")

    # Plaid products to request
    PLAID_PRODUCTS: list = ["transactions", "investments", "liabilities"]

    # Plaid country codes
    PLAID_COUNTRY_CODES: list = ["US"]

    # Database path
    DATABASE_PATH: str = os.getenv("DATABASE_PATH", "networth.db")

    # API settings
    API_HOST: str = os.getenv("API_HOST", "127.0.0.1")
    API_PORT: int = int(os.getenv("API_PORT", "8000"))

    # Daily refresh time (24-hour format)
    DAILY_REFRESH_HOUR: int = int(os.getenv("DAILY_REFRESH_HOUR", "6"))
    DAILY_REFRESH_MINUTE: int = int(os.getenv("DAILY_REFRESH_MINUTE", "0"))


settings = Settings()


# Plaid environment URLs
PLAID_ENV_URLS = {
    "sandbox": "https://sandbox.plaid.com",
    "development": "https://development.plaid.com",
    "production": "https://production.plaid.com",
}
