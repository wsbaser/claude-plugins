# Open points before merging the invoice discount

Review id: `task-412-invoice-discount`
Review title: `Task 412 "Apply the customer discount to invoice totals"`
Code: `src/billing.py` (the discount is `calc`, applied in `compute_invoice_total`).

1. The discount is rounded with round() while every other amount uses to_cents
2. A discount above 30 percent is silently capped at 30 instead of being refused
