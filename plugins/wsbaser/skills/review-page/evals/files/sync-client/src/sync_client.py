import logging
import time

log = logging.getLogger("sync")


class TransportError(Exception):
    pass


class Transport:
    def send(self, payload):
        try:
            return self._post(payload)
        except OSError as exc:
            log.error("transport failed: %s", exc)
            raise TransportError(str(exc)) from exc

    def _post(self, payload):
        raise OSError("connection reset")


class SyncSession:
    def __init__(self, transport, retries=3):
        self.transport = transport
        self.retries = retries

    def push(self, request, payload):
        log.info("push by %s", request.identity.name)
        for attempt in range(1, self.retries + 1):
            try:
                return self.transport.send(payload)
            except TransportError as exc:
                log.warning("attempt %d failed: %s", attempt, exc)
                if attempt == self.retries:
                    log.error("push failed: %s", exc)
                    log.info("Retrying")
                    raise
                time.sleep(1)
