"""Regression tests for Hunter domain-search billing behavior.

Hunter's current API documentation says a successful Domain Search is one query
and Free accounts may retrieve up to 10 results in that query.  Do not turn one
query into one internal credit per returned email.
"""

from __future__ import annotations

import unittest
from unittest.mock import patch

from app.services import email_finder
from app.services.runtime_settings import EDITABLE


class _Response:
    def __init__(self, emails: list[dict]):
        self._emails = emails

    def raise_for_status(self) -> None:
        return None

    def json(self) -> dict:
        return {"data": {"emails": self._emails}}


class HunterDomainSearchTests(unittest.TestCase):
    def test_successful_domain_search_returns_up_to_ten_people_for_one_credit(self):
        emails = [
            {
                "value": f"person{i}@example.com",
                "first_name": f"Person{i}",
                "last_name": "Example",
                "position": "Marketing",
                "confidence": 90,
            }
            for i in range(10)
        ]
        requested_params: dict = {}

        def fake_get(_url, *, params, timeout):
            requested_params.update(params)
            return _Response(emails)

        with patch.object(email_finder.settings, "HUNTER_API_KEY", "test-key"), patch.object(
            email_finder.httpx, "get", side_effect=fake_get
        ):
            people, search_credits = email_finder.hunter_domain_search(
                "example.com", limit=10
            )

        self.assertEqual(10, requested_params["limit"])
        self.assertEqual(10, len(people))
        self.assertEqual(1, search_credits)

    def test_default_company_result_limit_uses_free_plan_maximum(self):
        self.assertEqual("10", EDITABLE["HUNTER_EMAILS_PER_COMPANY"]["default"])


if __name__ == "__main__":
    unittest.main()
