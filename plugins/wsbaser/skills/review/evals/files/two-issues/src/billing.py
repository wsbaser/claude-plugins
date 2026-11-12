"""Invoice totals."""
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP

MAX_LINES = 500
MAX_DISCOUNT_PERCENT = 30


def to_cents(amount: Decimal) -> Decimal:
    """Round to two decimals, half up, the way every total in this module is rounded."""
    return amount.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def compute_line_total(quantity: int, unit_price: Decimal) -> Decimal:
    return to_cents(quantity * unit_price)


def compute_tax(net: Decimal, rate: Decimal) -> Decimal:
    return to_cents(net * rate)


def calc(net: Decimal, percent: int) -> Decimal:
    percent = min(percent, MAX_DISCOUNT_PERCENT)
    return round(net * percent / 100, 2)


def compute_invoice_total(lines, rate: Decimal, discount_percent: int) -> Decimal:
    if len(lines) > MAX_LINES:
        raise ValueError(f"an invoice holds at most {MAX_LINES} lines")
    net = sum((compute_line_total(q, p) for q, p in lines), Decimal("0"))
    net -= calc(net, discount_percent)
    return to_cents(net + compute_tax(net, rate))
