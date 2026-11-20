# Open points on PR #203 "Email reminders for overdue invoices"

Review id: `pr-203-overdue-reminders`
Review title: `PR #203 "Email reminders for overdue invoices"`
Code: `src/notify.py`, a job that emails reminders for overdue invoices. The repository class and the invoice model are not part of this checkout.

Points marked "claim" were written by a reviewer on the PR; quote, author and place are given.

1. send() catches every Exception, including programming errors
2. Failed attempts are logged at info and the final failure is not logged at all
3. Reviewer asks for exponential backoff instead of a fixed two-second sleep
   Claim by reviewer at src/notify.py:29: "A fixed 2s sleep hammers the SMTP server during an outage. Use exponential backoff."
4. send_overdue_reminders ignores the result of send()
5. Reviewer asks to filter overdue invoices in the query instead of in Python
   Claim by reviewer at src/notify.py:16: "all_invoices() loads every invoice ever issued. Filter overdue and unpaid in the repository query."
6. The SMTP host is hard-coded
7. The sender address is hard-coded
8. The message is built by string concatenation with no headers but Subject
9. Notifier both selects overdue invoices and sends mail
10. Reviewer says Notifier has no tests
    Claim by reviewer at src/notify.py:11: "No tests for Notifier at all?"
11. Reviewer says invoice.customer can be None
    Claim by reviewer at src/notify.py:18: "invoice.customer can be None for invoices imported from the old system. This will crash the whole run."
12. Customers get a reminder on every run of the job for as long as the invoice is overdue
13. The reminder text is English only, but customers are in several countries
14. Name of the tenant setting that controls how often reminders are sent
15. time.sleep is called directly, so a test of send() waits six seconds
