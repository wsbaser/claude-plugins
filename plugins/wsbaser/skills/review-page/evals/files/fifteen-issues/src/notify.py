import logging
import smtplib
import time

log = logging.getLogger(__name__)

SMTP_HOST = "smtp.internal"
RETRIES = 3


class Notifier:
    def __init__(self, repo):
        self.repo = repo

    def send_overdue_reminders(self, today):
        for invoice in self.repo.all_invoices():
            if invoice.due_date < today and not invoice.paid:
                self.send(invoice.customer.email, "Invoice overdue",
                          "Invoice " + invoice.number + " is overdue.")

    def send(self, to, subject, body):
        for attempt in range(RETRIES):
            try:
                with smtplib.SMTP(SMTP_HOST) as smtp:
                    smtp.sendmail("billing@example.com", to, "Subject: " + subject + "\n\n" + body)
                return True
            except Exception as e:
                log.info("Retrying send to %s: %s", to, e)
                time.sleep(2)
        return False
