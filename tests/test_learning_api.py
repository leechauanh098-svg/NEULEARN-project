import unittest
from io import BytesIO
from unittest.mock import MagicMock, patch

from app import app
from learning_api import _storage_request


class LearningApiTests(unittest.TestCase):
    def setUp(self):
        app.config.update(
            TESTING=True,
            SUPABASE_URL="https://example.supabase.co",
            SUPABASE_ANON_KEY="test-anon-key",
            SUPABASE_SERVICE_ROLE_KEY="test-service-role-key",
        )
        self.client = app.test_client()

    def test_profile_requires_bearer_token(self):
        with patch("learning_api._supabase_request") as supabase_request:
            response = self.client.get("/api/profile")

        self.assertEqual(response.status_code, 401)
        supabase_request.assert_not_called()

    def test_user_can_update_their_display_name_through_flask(self):
        user = {
            "id": "student-id",
            "token": "access-token",
            "profile": {
                "id": "student-id",
                "email": "student@example.com",
                "full_name": "New Name",
                "role": "student",
            },
        }
        updated_profile = {
            "id": "student-id",
            "email": "student@example.com",
            "full_name": "New Name",
            "role": "student",
        }
        with patch("learning_api._current_user", return_value=user):
            with patch("learning_api._rest_rows", return_value=[updated_profile]) as supabase_request:
                response = self.client.patch("/api/profile", json={"fullName": " New Name "})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json(), {"profile": updated_profile})
        supabase_request.assert_called_once_with(
            "/rest/v1/profiles?id=eq.student-id",
            method="PATCH",
            payload={"full_name": "New Name"},
            access_token="access-token",
        )

    def test_profile_name_update_rejects_empty_name(self):
        user = {
            "id": "student-id",
            "token": "access-token",
            "profile": {"role": "student"},
        }
        with patch("learning_api._current_user", return_value=user):
            with patch("learning_api._rest_rows") as supabase_request:
                response = self.client.patch("/api/profile", json={"fullName": "  "})

        self.assertEqual(response.status_code, 400)
        supabase_request.assert_not_called()

    def test_student_cannot_create_course(self):
        user = {
            "id": "student-id",
            "token": "access-token",
            "profile": {"role": "student"},
        }
        with patch("learning_api._current_user", return_value=user):
            with patch("learning_api._rest_rows") as supabase_request:
                response = self.client.post(
                    "/api/courses",
                    json={"name": "Toán", "category": "Cơ sở", "description": ""},
                )

        self.assertEqual(response.status_code, 403)
        supabase_request.assert_not_called()

def test_lecturer_creates_course_through_flask(self):
    user = {
        "id": "lecturer-id",
        "token": "access-token",
        "profile": {"role": "lecturer"},
    }
    created_course = {
        "id": "course-id",
        "name": "Toán",
        "category": "Cơ sở",
        "description": "",
        "created_by": "lecturer-id",
    }
    with patch("learning_api._current_user", return_value=user):
        with patch("learning_api._rest_rows", return_value=[created_course]) as supabase_request:
            response = self.client.post(
                "/api/courses",
                json={"name": " Toán ", "category": "Cơ sở", "description": ""},
            )

    self.assertEqual(response.status_code, 201)
    self.assertEqual(response.get_json(), {"course": created_course})
    supabase_request.assert_called_once_with(
        "/rest/v1/courses?select=id,name,category,description,created_by",
        method="POST",
        payload={
            "name": "Toán",
            "category": "Cơ sở",
            "description": "",
            "created_by": "lecturer-id",
        },
        access_token="access-token",
    )

    def test_learning_endpoint_returns_all_courses(self):
        user = {
            "id": "admin-id",
            "token": "access-token",
            "profile": {"role": "admin"},
        }
        courses = [
            {
                "id": f"course-{index}",
                "name": f"Course {index}",
                "category": "Category",
                "description": "",
                "created_by": "admin-id",
            }
            for index in range(18)
        ]
        with patch("learning_api._current_user", return_value=user):
            with patch("learning_api._rest_rows", side_effect=[courses, []]):
                response = self.client.get(
                    "/api/learning",
                    headers={"Authorization": "Bearer access-token"},
                )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.get_json()["courses"]), 18)

    def test_daily_activity_rejects_invalid_date(self):
        user = {
            "id": "student-id",
            "token": "access-token",
            "profile": {"role": "student"},
        }
        with patch("learning_api._current_user", return_value=user):
            with patch("learning_api._rest_rows") as supabase_request:
                response = self.client.get("/api/study/daily?from=not-a-date")

        self.assertEqual(response.status_code, 400)
        supabase_request.assert_not_called()

    def test_development_frontend_can_reach_flask_api(self):
        response = self.client.options(
            "/api/profile",
            headers={
                "Origin": "http://localhost:3000",
                "Access-Control-Request-Method": "GET",
                "Access-Control-Request-Headers": "authorization",
            },
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers["Access-Control-Allow-Origin"], "http://localhost:3000")
        self.assertIn("Authorization", response.headers["Access-Control-Allow-Headers"])

    def test_unlisted_origin_is_not_allowed_to_call_api(self):
        response = self.client.options(
            "/api/profile",
            headers={
                "Origin": "https://example.com",
                "Access-Control-Request-Method": "GET",
            },
        )

        self.assertNotIn("Access-Control-Allow-Origin", response.headers)


if __name__ == "__main__":
    unittest.main()
