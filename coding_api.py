"""Blueprint Flask cho chức năng luyện tập lập trình Java (sử dụng dữ liệu JSON, không gọi AI)."""

import json
from pathlib import Path
from flask import Blueprint, jsonify, request
from admin_api import AdminApiError, _current_user

coding_api = Blueprint("coding_api", __name__, url_prefix="/api/coding")
EXERCISES_PATH = Path(__file__).resolve().parent / "public" / "data" / "java-exercises.json"


def _load_exercises():
    if not EXERCISES_PATH.is_file():
        alt = Path(__file__).resolve().parent / "lib" / "data" / "java-exercises.json"
        if alt.is_file():
            return json.loads(alt.read_text(encoding="utf-8"))
        return []
    return json.loads(EXERCISES_PATH.read_text(encoding="utf-8"))


@coding_api.errorhandler(AdminApiError)
def handle_error(error):
    return jsonify(error=error.message), error.status_code


@coding_api.get("/exercises")
def get_exercises():
    """Lấy danh sách các bài tập Java từ file JSON."""
    _current_user()  # xác thực đăng nhập
    exercises = _load_exercises()
    return jsonify(exercises=exercises)
