import json
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from uuid import uuid4

from flask import Blueprint, current_app, jsonify, request

from admin_api import AdminApiError, _current_user, _supabase_request
from coding_exercise_schema import MAX_JSON_SIZE, validate_exercise_payload

coding_api = Blueprint("coding_api", __name__, url_prefix="/api/coding")
EXERCISES_PATH = Path(__file__).resolve().parent / "public" / "data" / "java-exercises.json"
SET_SELECT = "id,course_id,title,language,version,file_path,file_name,file_size,exercise_count,payload,status,uploaded_by,created_at,published_at"


def _rows(path, method="GET", payload=None, access_token=None):
    result = _supabase_request(method, path, payload, access_token=access_token)
    if result is None:
        return []
    if not isinstance(result, list):
        raise AdminApiError(502, "Supabase trả về danh sách đề không hợp lệ.")
    return result


def _owned_course(user, course_id):
    rows = _rows(
        f"/rest/v1/courses?select=id,created_by&id=eq.{quote(course_id, safe='')}",
        access_token=user["token"],
    )
    if not rows:
        raise AdminApiError(404, "Không tìm thấy môn học.")
    if user["profile"].get("role") != "admin" and rows[0].get("created_by") != user["id"]:
        raise AdminApiError(403, "Bạn chỉ được quản lý đề trong môn học do mình tạo.")
    return rows[0]


def _storage_request(method, path, data=None, content_type="application/json", access_token=None):
    base_url = current_app.config.get("SUPABASE_URL")
    key = current_app.config.get("SUPABASE_ANON_KEY")
    if not base_url or not key or not access_token:
        raise AdminApiError(503, "Flask chưa được cấu hình đầy đủ Supabase Storage.")
    headers = {"apikey": key, "Authorization": f"Bearer {access_token}", "Accept": "application/json"}
    if data is not None:
        headers["Content-Type"] = content_type
    try:
        with urlopen(Request(f"{base_url.rstrip('/')}{path}", data=data, headers=headers, method=method), timeout=60) as response:
            body = response.read()
    except HTTPError as error:
        message = error.read().decode("utf-8", errors="replace")
        raise AdminApiError(error.code if error.code < 500 else 502, message or "Storage từ chối yêu cầu.") from error
    except (TimeoutError, URLError) as error:
        raise AdminApiError(502, "Không thể kết nối Supabase Storage.") from error
    if not body:
        return None
    try:
        return json.loads(body)
    except json.JSONDecodeError:
        return body.decode("utf-8", errors="replace")


def _remove_file(file_path, access_token):
    return _storage_request(
        "DELETE",
        "/storage/v1/object/coding-exercises",
        json.dumps({"prefixes": [file_path]}).encode("utf-8"),
        access_token=access_token,
    )


def _load_static_exercises():
    if not EXERCISES_PATH.is_file():
        return []
    try:
        data = json.loads(EXERCISES_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return []
    return data if isinstance(data, list) else []


@coding_api.errorhandler(AdminApiError)
def handle_error(error):
    return jsonify(error=error.message), error.status_code


@coding_api.get("/exercises")
def get_exercises():
    user = _current_user()
    course_id = request.args.get("courseId", "").strip()
    language = request.args.get("language", "java").strip().lower()
    if not course_id:
        return jsonify(exercises=_load_static_exercises())
    filters = (
        f"course_id=eq.{quote(course_id, safe='')}"
        f"&language=eq.{quote(language, safe='')}&status=eq.published&order=published_at.desc&limit=1"
    )
    rows = _rows(f"/rest/v1/coding_exercise_sets?select={SET_SELECT}&{filters}", access_token=user["token"])
    if not rows:
        return jsonify(exercises=[], source="published")
    return jsonify(exercises=rows[0]["payload"].get("exercises", []), source="published", setId=rows[0]["id"])


@coding_api.get("/exercise-sets")
def list_exercise_sets():
    user = _current_user()
    if user["profile"].get("role") not in {"lecturer", "admin"}:
        raise AdminApiError(403, "Bạn không có quyền quản lý bộ đề.")
    rows = _rows(
        f"/rest/v1/coding_exercise_sets?select={SET_SELECT}&order=created_at.desc",
        access_token=user["token"],
    )
    return jsonify(sets=rows)


@coding_api.post("/exercise-sets")
def upload_exercise_set():
    user = _current_user()
    if user["profile"].get("role") not in {"lecturer", "admin"}:
        raise AdminApiError(403, "Bạn không có quyền tải đề luyện code.")
    uploaded_file = request.files.get("file")
    if uploaded_file is None or not uploaded_file.filename:
        raise AdminApiError(400, "Chọn một file JSON trước khi tải lên.")
    if not uploaded_file.filename.lower().endswith(".json"):
        raise AdminApiError(400, "Chỉ hỗ trợ file JSON.")
    raw_bytes = uploaded_file.read(MAX_JSON_SIZE + 1)
    if not raw_bytes or len(raw_bytes) > MAX_JSON_SIZE:
        raise AdminApiError(413, "File JSON phải nhỏ hơn hoặc bằng 5 MB.")
    try:
        payload = json.loads(raw_bytes.decode("utf-8-sig"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise AdminApiError(400, "File JSON không hợp lệ hoặc không dùng UTF-8.") from error
    normalized = validate_exercise_payload(payload)
    course = _owned_course(user, request.form.get("courseId", "").strip())
    title = request.form.get("title", "").strip()
    language = request.form.get("language", normalized["language"]).strip().lower()
    if not title or len(title) > 180:
        raise AdminApiError(400, "Tên bộ đề phải có từ 1 đến 180 ký tự.")
    if language != normalized["language"]:
        raise AdminApiError(400, "Ngôn ngữ trong form không khớp với JSON.")

    course_filter = quote(course["id"], safe="")
    language_filter = quote(language, safe="")
    _rows(
        f"/rest/v1/coding_exercise_sets?course_id=eq.{course_filter}&language=eq.{language_filter}&status=eq.published",
        method="PATCH",
        payload={"status": "archived"},
        access_token=user["token"],
    )
    set_id = str(uuid4())
    file_path = f"{user['id']}/{course['id']}/{set_id}.json"
    _storage_request(
        "POST",
        f"/storage/v1/object/coding-exercises/{quote(file_path, safe='/')}",
        raw_bytes,
        "application/json",
        access_token=user["token"],
    )
    row = {
        "id": set_id,
        "course_id": course["id"],
        "title": title,
        "language": language,
        "version": normalized.get("version", 1),
        "file_path": file_path,
        "file_name": uploaded_file.filename[:255],
        "file_size": len(raw_bytes),
        "exercise_count": len(normalized["exercises"]),
        "payload": normalized,
        "status": "published",
        "uploaded_by": user["id"],
        "published_at": datetime.now(timezone.utc).isoformat(),
    }
    try:
        rows = _rows(
            f"/rest/v1/coding_exercise_sets?select={SET_SELECT}",
            method="POST",
            payload=row,
            access_token=user["token"],
        )
    except AdminApiError as error:
        try:
            _remove_file(file_path, user["token"])
        except AdminApiError as cleanup_error:
            current_app.logger.error("Could not remove unregistered coding exercise file: %s", cleanup_error.message)
        raise error
    if not rows:
        raise AdminApiError(502, "Không lưu được bộ đề.")
    return jsonify(set=rows[0]), 201


@coding_api.post("/exercise-sets/<set_id>/publish")
def publish_exercise_set(set_id):
    user = _current_user()
    if user["profile"].get("role") not in {"lecturer", "admin"}:
        raise AdminApiError(403, "Bạn không có quyền phát hành bộ đề.")
    current = _rows(
        f"/rest/v1/coding_exercise_sets?select={SET_SELECT}&id=eq.{quote(set_id, safe='')}",
        access_token=user["token"],
    )
    if not current:
        raise AdminApiError(404, "Không tìm thấy bộ đề.")
    _owned_course(user, current[0]["course_id"])
    course_id = quote(current[0]["course_id"], safe="")
    language = quote(current[0]["language"], safe="")
    _rows(
        f"/rest/v1/coding_exercise_sets?course_id=eq.{course_id}&language=eq.{language}&status=eq.published&id=neq.{quote(set_id, safe='')}",
        method="PATCH",
        payload={"status": "archived"},
        access_token=user["token"],
    )
    rows = _rows(
        f"/rest/v1/coding_exercise_sets?select={SET_SELECT}&id=eq.{quote(set_id, safe='')}",
        method="PATCH",
        payload={"status": "published", "published_at": "now()"},
        access_token=user["token"],
    )
    if not rows:
        raise AdminApiError(502, "Không phát hành được bộ đề.")
    return jsonify(set=rows[0])


@coding_api.delete("/exercise-sets/<set_id>")
def delete_exercise_set(set_id):
    user = _current_user()
    if user["profile"].get("role") not in {"lecturer", "admin"}:
        raise AdminApiError(403, "Bạn không có quyền xóa bộ đề.")
    current = _rows(
        f"/rest/v1/coding_exercise_sets?select=id,course_id,file_path&id=eq.{quote(set_id, safe='')}",
        access_token=user["token"],
    )
    if not current:
        raise AdminApiError(404, "Không tìm thấy bộ đề.")
    _owned_course(user, current[0]["course_id"])
    rows = _rows(
        f"/rest/v1/coding_exercise_sets?id=eq.{quote(set_id, safe='')}",
        method="DELETE",
        access_token=user["token"],
    )
    if not rows:
        raise AdminApiError(404, "Không tìm thấy bộ đề cần xóa.")
    try:
        _remove_file(current[0]["file_path"], user["token"])
    except AdminApiError as error:
        raise AdminApiError(502, f"Đã xóa thông tin bộ đề nhưng không xóa được file JSON: {error.message}") from error
    return jsonify(deleted=True)
