import json
import unittest
from unittest.mock import patch

from app import app
from coding_exercise_schema import validate_exercise_payload


class CodingExerciseTests(unittest.TestCase):
    def setUp(self):
        app.config.update(TESTING=True)
        self.client = app.test_client()

    def test_existing_java_exercises_match_upload_schema(self):
        with open("public/data/java-exercises.json", encoding="utf-8") as exercise_file:
            payload = json.load(exercise_file)

        normalized = validate_exercise_payload(payload)

        self.assertEqual(len(normalized["exercises"]), 2)
        self.assertEqual(normalized["language"], "java")

    def test_invalid_regex_is_rejected(self):
        payload = [{
            "id": "invalid-regex",
            "title": "Bài lỗi",
            "fileName": "Invalid.java",
            "lesson": "Nội dung",
            "starterCode": "class Invalid {}",
            "solutionCode": "class Invalid {}",
            "solutionExplanation": "Giải thích",
            "tasks": [{
                "id": 1,
                "text": "Nhiệm vụ",
                "validation": {"type": "regex", "pattern": "["},
            }],
        }]

        with self.assertRaisesRegex(Exception, "Regex pattern"):
            validate_exercise_payload(payload)

    def test_student_cannot_upload_exercise_set(self):
        user = {"id": "student-id", "token": "token", "profile": {"role": "student"}}
        with patch("coding_api._current_user", return_value=user):
            response = self.client.post("/api/coding/exercise-sets")

        self.assertEqual(response.status_code, 403)


if __name__ == "__main__":
    unittest.main()
