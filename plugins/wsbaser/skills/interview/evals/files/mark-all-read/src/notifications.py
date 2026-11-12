from dataclasses import dataclass
from datetime import datetime, timezone


@dataclass
class Notification:
    id: int
    user_id: int
    kind: str  # "mention", "assignment" or "digest"
    text: str
    created_at: datetime
    read_at: datetime | None = None


class NotificationStore:
    """In-memory store; production uses the same interface over the notifications table."""

    def __init__(self):
        self._items: dict[int, Notification] = {}

    def add(self, n: Notification) -> None:
        self._items[n.id] = n

    def list_for(self, user_id: int, kind: str | None = None, unread_only: bool = False) -> list[Notification]:
        items = [n for n in self._items.values() if n.user_id == user_id]
        if kind is not None:
            items = [n for n in items if n.kind == kind]
        if unread_only:
            items = [n for n in items if n.read_at is None]
        return sorted(items, key=lambda n: n.created_at, reverse=True)

    def unread_count(self, user_id: int) -> int:
        return len(self.list_for(user_id, unread_only=True))

    def mark_read(self, notification_id: int, user_id: int) -> bool:
        n = self._items.get(notification_id)
        if n is None or n.user_id != user_id:
            return False
        if n.read_at is None:
            n.read_at = datetime.now(timezone.utc)
        return True
