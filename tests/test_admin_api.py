import unittest
from unittest.mock import patch

from app import app


class AdminApiTests(unittest.TestCase):
    admin_id = "11111111-1111-4111-8111-111111111111"
    target_id = "22222222-2222-4222-8222-222222222222"

    def setUp(self):
        app.config.update(
            TESTING=True,
            SUPABASE_URL="https://example.supabase.co",
            SUPABASE_ANON_KEY="test-anon-key",
            SUPABASE_SERVICE_ROLE_KEY="test-service-role-key",
        )
        self.client = app.test_client()

    def _mock_admin_session(self, target_profile=None, admin_count=None):
        def fake_request(method, path, payload=None, access_token=None):
            if path == "/auth/v1/user":
                return {"id": self.admin_id}
            if path == f"/rest/v1/profiles?select=id,email,full_name,role&id=eq.{self.admin_id}":
                return [{"id": self.admin_id, "email": "admin@example.com", "full_name": "Admin", "role": "admin"}]
            if path.startswith("/rest/v1/profiles?select=id,email,full_name,role,created_at&id=eq."):
                return [target_profile] if target_profile else []
            if path == "/rest/v1/profiles?select=id&role=eq.admin":
                return admin_count or [{"id": self.admin_id}]
            return None

        return patch("admin_api._supabase_request", side_effect=fake_request)

    def test_user_api_requires_bearer_token(self):
        with patch("admin_api._supabase_request") as supabase_request:
            response = self.client.get("/api/admin/users")

        self.assertEqual(response.status_code, 401)
        supabase_request.assert_not_called()

    def test_admin_users_page_is_served_by_flask(self):
        response = self.client.get("/admin/users")
        self.assertEqual(response.status_code, 200)
        response.close()

    def test_user_api_rejects_non_admin_role(self):
        def fake_request(method, path, payload=None, access_token=None):
            if path == "/auth/v1/user":
                return {"id": "student-user"}
            if path == "/rest/v1/profiles?select=id,email,full_name,role&id=eq.student-user":
                return [{"id": "student-user", "email": "student@example.com", "full_name": "Student", "role": "student"}]
            self.fail(f"Unexpected Supabase request: {method} {path}")

        with patch("admin_api._supabase_request", side_effect=fake_request):
            response = self.client.get("/api/admin/users", headers={"Authorization": "Bearer user-token"})

        self.assertEqual(response.status_code, 403)

    def test_admin_cannot_delete_last_admin(self):
        target = {
            "id": self.target_id,
            "email": "target@example.com",
            "full_name": "Target",
            "role": "admin",
            "created_at": "2026-01-01T00:00:00Z",
        }
        with self._mock_admin_session(target, [{"id": self.target_id}]) as supabase_request:
            response = self.client.delete(
                f"/api/admin/users/{self.target_id}",
                headers={"Authorization": "Bearer admin-token"},
            )

        self.assertEqual(response.status_code, 409)
        self.assertEqual(len(supabase_request.call_args_list), 4)

    def test_delete_transfers_only_target_users_content_before_removing_auth_user(self):
        target = {
            "id": self.target_id,
            "email": "target@example.com",
            "full_name": "Target",
            "role": "student",
            "created_at": "2026-01-01T00:00:00Z",
        }

        def fake_request(method, path, payload=None, access_token=None):
            if path == "/auth/v1/user":
                return {"id": self.admin_id}
            if path == f"/rest/v1/profiles?select=id,email,full_name,role&id=eq.{self.admin_id}":
                return [{"id": self.admin_id, "email": "admin@example.com", "full_name": "Admin", "role": "admin"}]
            if path.startswith("/rest/v1/profiles?select=id,email,full_name,role,created_at&id=eq."):
                return [target]
            if path == f"/rest/v1/courses?select=id&created_by=eq.{self.target_id}":
                return [{"id": "target-course"}]
            if path == f"/rest/v1/lecture_materials?select=id&uploaded_by=eq.{self.target_id}":
                return [{"id": "target-material"}]
            return None

        with patch("admin_api._supabase_request", side_effect=fake_request) as supabase_request:
            response = self.client.delete(
                f"/api/admin/users/{self.target_id}",
                headers={"Authorization": "Bearer admin-token"},
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json(), {"deleted": True, "transferredContent": True})
        calls = [
            (call.args[0], call.args[1], call.args[2] if len(call.args) > 2 else None)
            for call in supabase_request.call_args_list
        ]
        self.assertIn(("PATCH", "/rest/v1/courses?id=in.(target-course)", {"created_by": self.admin_id}), calls)
        self.assertIn(("PATCH", "/rest/v1/lecture_materials?id=in.(target-material)", {"uploaded_by": self.admin_id}), calls)
        self.assertIn((
            "POST",
            "/rest/v1/rpc/transfer_learning_storage_ownership",
            {
                "p_from_user": self.target_id,
                "p_to_user": self.admin_id,
                "p_folder_user": self.target_id,
            },
        ), calls)
        self.assertIn(("DELETE", f"/auth/v1/admin/users/{self.target_id}", None), calls)


if __name__ == "__main__":
    unittest.main()
