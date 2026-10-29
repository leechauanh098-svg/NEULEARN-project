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
            with patch("learning_api._rest_rows", side_effect=[courses, []]) as supabase_request:
                response = self.client.get(
                    "/api/learning",
                    headers={"Authorization": "Bearer access-token"},
                )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.get_json()["courses"]), 18)
        for call in supabase_request.call_args_list:
            self.assertEqual(call.kwargs["access_token"], "access-token")

    def test_signed_pdf_url_uses_authenticated_user_credentials(self):
        user = {
            "id": "student-id",
            "token": "access-token",
            "profile": {"role": "student"},
        }
        with patch("learning_api._current_user", return_value=user):
            with patch("learning_api._owned_row", return_value={"file_path": "lecturer-id/file.pdf"}) as owned_row:
                with patch("learning_api._storage_request", return_value={"signedURL": "/object/sign/file?token=abc"}) as storage_request:
                    response = self.client.get("/api/materials/material-id/signed-url")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.get_json()["signedUrl"],
            "https://example.supabase.co/storage/v1/object/sign/file?token=abc",
        )
        owned_row.assert_called_once_with(
            "lecture_materials",
            "material-id",
            "file_path",
            access_token="access-token",
        )
        self.assertEqual(storage_request.call_args.kwargs["access_token"], "access-token")

    def test_admin_uploads_pdf_using_their_authenticated_session(self):
        user = {
            "id": "lecturer-id",
            "token": "access-token",
            "profile": {"role": "admin", "full_name": "Admin"},
        }
        course = {
            "id": "course-id",
            "created_by": "another-lecturer-id",
        }
        material = {
            "id": "material-id",
            "course_id": "course-id",
            "title": "Lecture",
        }
        with patch("learning_api._current_user", return_value=user):
            with patch("learning_api._owned_row", return_value=course):
                with patch("learning_api._storage_request") as storage_request:
                    with patch("learning_api._rest_rows", return_value=[material]) as rest_rows:
                        response = self.client.post(
                            "/api/materials",
                            data={
                                "courseId": "course-id",
                                "title": "Lecture",
                                "chapter": "Chapter 1",
                                "description": "",
                                "slideCount": "1",
                                "file": (BytesIO(b"%PDF-1.4 test"), "lecture.pdf"),
                            },
                        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.get_json(), {"material": material})
        self.assertEqual(storage_request.call_args.kwargs["access_token"], "access-token")
        self.assertEqual(rest_rows.call_args.kwargs["access_token"], "access-token")

    def test_authenticated_storage_request_does_not_require_service_role_key(self):
        app.config["SUPABASE_SERVICE_ROLE_KEY"] = None
        response = MagicMock()
        response.__enter__.return_value.read.return_value = b"{}"

        with app.app_context():
            with patch("urllib.request.urlopen", return_value=response) as urlopen:
                result = _storage_request(
                    "POST",
                    "/storage/v1/object/lecture-materials/file.pdf",
                    b"%PDF-1.4 test",
                    "application/pdf",
                    access_token="user-access-token",
                )

        self.assertEqual(result, {})
        upstream_request = urlopen.call_args.args[0]
        self.assertEqual(upstream_request.get_header("Apikey"), "test-anon-key")
        self.assertEqual(upstream_request.get_header("Authorization"), "Bearer user-access-token")

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
