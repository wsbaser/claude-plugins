# Mark all notifications as read

Users with many notifications want one action that clears the unread badge instead of opening each notification.
The notifications panel lists a user's notifications newest first and can be filtered by kind (mentions, assignments, digests).
Each notification is marked read today one at a time through `NotificationStore.mark_read` in `src/notifications.py`.
