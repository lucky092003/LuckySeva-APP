from types import SimpleNamespace

from app.routers import admin


class Query:
    def __init__(self, rows=None):
        self.rows = rows or []
        self.filters = []
        self.update_values = None

    def select(self, *args, **kwargs):
        return self

    def order(self, *args, **kwargs):
        return self

    def limit(self, *args, **kwargs):
        return self

    def update(self, values):
        self.update_values = values
        return self

    def eq(self, field, value):
        self.filters.append((field, value))
        return self

    def execute(self):
        return SimpleNamespace(data=self.rows)


class FakeSupabase:
    def __init__(self, rows=None):
        self.query = Query(rows)

    def table(self, name):
        assert name == "notifications"
        return self.query


def test_admin_notifications_uses_separate_read_state(monkeypatch):
    fake = FakeSupabase([{"id": "n1", "read": False, "admin_read": True}])
    monkeypatch.setattr(admin, "db", lambda: fake)

    rows = admin.admin_notifications(status="unread")

    assert rows[0]["read"] is True
    assert ("admin_read", False) in fake.query.filters
    assert ("read", False) not in fake.query.filters


def test_admin_mark_all_does_not_change_customer_provider_read_flag(monkeypatch):
    fake = FakeSupabase([{"id": "n1"}, {"id": "n2"}])
    monkeypatch.setattr(admin, "db", lambda: fake)

    result = admin.mark_all_notifications_read()

    assert result == {"ok": True, "updated": 2}
    assert fake.query.update_values == {"admin_read": True}
    assert ("admin_read", False) in fake.query.filters
    assert ("read", False) not in fake.query.filters


def test_admin_mark_one_updates_only_admin_read_flag(monkeypatch):
    fake = FakeSupabase([{"id": "n1", "read": False, "admin_read": True}])
    monkeypatch.setattr(admin, "db", lambda: fake)

    result = admin.mark_notification_read("n1")

    assert result["read"] is True
    assert fake.query.update_values == {"admin_read": True}
    assert ("id", "n1") in fake.query.filters
