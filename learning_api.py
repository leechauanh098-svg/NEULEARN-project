import json
import re
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from uuid import uuid4

from flask import Blueprint, current_app, jsonify, request

from admin_api import AdminApiError, _current_user, _supabase_request

learning_api = Blueprint("learning_api", __name__, url_prefix="/api")
MAX_PDF_SIZE = 50 * 1024 * 1024
MATERIAL_SELECT = "id,course_id,title,chapter,description,teacher_name,file_path,slide_count,created_at,uploaded_by"
COURSE_SELECT = "id,name,category,description,created_by"


def _rest_rows(path, method="GET", payload=None, access_token=None):
    result = _supabase_request(method, path, payload, access_token=access_token)
    if result is None:
        return []
    if isinstance(result, list):
        return result
    raise AdminApiError(502, "Supabase trả về danh sách dữ liệu không hợp lệ.")


def _json_body():
    body = request.get_json(silent=True)
    if not isinstance(body, dict):
        raise AdminApiError(400, "Dữ liệu gửi lên không hợp lệ.")
    return body


def _required_text(body, field, label, max_length):
    value = body.get(field)
    if not isinstance(value, str) or not value.strip():
        raise AdminApiError(400, f"Vui lòng nhập {label}.")
    value = value.strip()
    if len(value) > max_length:
        raise AdminApiError(400, f"{label.capitalize()} không được dài quá {max_length} ký tự.")
    return value


def _require_manager(user):
    role = user["profile"].get("role")
    if role not in {"lecturer", "admin"}:
        raise AdminApiError(403, "Bạn không có quyền quản lý học liệu.")
    return role


def _owned_row(table, row_id, select, access_token=None):
    rows = _rest_rows(
        f"/rest/v1/{table}?select={select}&id=eq.{quote(row_id, safe='')}",
        access_token=access_token,
    )
    if not rows:
        raise AdminApiError(404, "Không tìm thấy nội dung cần thao tác.")
    return rows[0]


def _require_content_owner(user, row, owner_field):
    role = _require_manager(user)
    if role != "admin" and row.get(owner_field) != user["id"]:
        raise AdminApiError(403, "Bạn chỉ được sửa nội dung do mình tạo.")


def _storage_request(method, path, data=None, content_type="application/json", access_token=None):
    base_url = current_app.config.get("SUPABASE_URL")
    service_key = current_app.config.get("SUPABASE_SERVICE_ROLE_KEY")
    anon_key = current_app.config.get("SUPABASE_ANON_KEY")
    key = anon_key if access_token else service_key
    if not base_url or not key or (not access_token and not service_key):
        raise AdminApiError(503, "Flask chưa được cấu hình đầy đủ thông tin Supabase Storage.")

    headers = {
        "apikey": key,
        "Authorization": f"Bearer {access_token or service_key}",
        "Accept": "application/json",
    }
    if data is not None:
        headers["Content-Type"] = content_type
    from urllib.request import Request, urlopen

    remote_request = Request(
        f"{base_url.rstrip('/')}{path}",
        data=data,
        headers=headers,
        method=method,
    )
    try:
        with urlopen(remote_request, timeout=60) as response:
            response_body = response.read()
    except HTTPError as error:
        body = error.read().decode("utf-8", errors="replace")
        try:
            details = json.loads(body)
        except json.JSONDecodeError:
            details = {}
        if not isinstance(details, dict):
            details = {}
        message = details.get("message") or details.get("error") or details.get("statusCode") or "Storage từ chối yêu cầu."
        raise AdminApiError(error.code if 400 <= error.code < 500 else 502, str(message)) from error
    except (TimeoutError, URLError) as error:
        raise AdminApiError(502, "Không thể kết nối Supabase Storage.") from error

    if not response_body:
        return None
    try:
        return json.loads(response_body)
    except json.JSONDecodeError:
        return response_body.decode("utf-8", errors="replace")


def _remove_storage_file(file_path, access_token=None):
    return _storage_request(
        "DELETE",
        "/storage/v1/object/lecture-materials",
        json.dumps({"prefixes": [file_path]}).encode("utf-8"),
        access_token=access_token,
    )


def _course_permission(user, course):
    _require_content_owner(user, course, "created_by")


@learning_api.errorhandler(AdminApiError)
def handle_learning_api_error(error):
    return jsonify(error=error.message), error.status_code


@learning_api.get("/profile")
def get_profile():
    user = _current_user()
    profile = user["profile"]
    return jsonify(
        profile={
            "id": user["id"],
            "email": profile.get("email") or "",
            "full_name": profile.get("full_name") or "",
            "role": profile.get("role") or "student",
        }
    )


@learning_api.patch("/profile")
def update_profile():
    user = _current_user()
    body = _json_body()
    full_name = _required_text(body, "fullName", "họ tên", 160)
    rows = _rest_rows(
        f"/rest/v1/profiles?id=eq.{quote(user['id'], safe='')}",
        method="PATCH",
        payload={"full_name": full_name},
        access_token=user["token"],
    )
    if not rows:
        raise AdminApiError(404, "Không tìm thấy hồ sơ để cập nhật.")
    profile = rows[0]
    return jsonify(
        profile={
            "id": user["id"],
            "email": profile.get("email") or user["profile"].get("email") or "",
            "full_name": profile.get("full_name") or "",
            "role": profile.get("role") or "student",
        }
    )


@learning_api.get("/learning")
def get_learning_content():
    user = _current_user()
    courses = _rest_rows(
        f"/rest/v1/courses?select={COURSE_SELECT}&order=name",
        access_token=user["token"],
    )
    materials = _rest_rows(
        f"/rest/v1/lecture_materials?select={MATERIAL_SELECT}&order=created_at.desc",
        access_token=user["token"],
    )
    return jsonify(courses=courses, materials=materials)


@learning_api.get("/study/history")
def get_study_history():
    user = _current_user()
    history = _rest_rows(
        "/rest/v1/study_history?select=resource_id,study_seconds,question_count,last_accessed_at"
        f"&user_id=eq.{quote(user['id'], safe='')}",
        access_token=user["token"],
    )
    return jsonify(history=history)


@learning_api.get("/study/daily")
def get_daily_study_activity():
    user = _current_user()
    first_date = request.args.get("from", "")
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", first_date):
        raise AdminApiError(400, "Ngày bắt đầu thống kê không hợp lệ.")
    rows = _rest_rows(
        "/rest/v1/study_activity_daily?select=activity_date,resource_id,study_seconds,was_accessed"
        f"&user_id=eq.{quote(user['id'], safe='')}"
        f"&activity_date=gte.{quote(first_date, safe='')}",
        access_token=user["token"],
    )
    return jsonify(activity=rows)


@learning_api.delete("/study/daily")
def cleanup_daily_study_activity():
    user = _current_user()
    first_date = request.args.get("from", "")
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", first_date):
        raise AdminApiError(400, "Ngày bắt đầu thống kê không hợp lệ.")
    _rest_rows(
        f"/rest/v1/study_activity_daily?user_id=eq.{quote(user['id'], safe='')}"
        f"&activity_date=lt.{quote(first_date, safe='')}",
        method="DELETE",
        access_token=user["token"],
    )
    return jsonify(deleted=True)


@learning_api.post("/study/activity")
def record_study_activity():
    user = _current_user()
    body = _json_body()
    resource_id = _required_text(body, "resourceId", "mã tài liệu", 180)
    study_seconds = body.get("studySeconds", 0)
    question_count = body.get("questionCount", 0)
    accessed = body.get("accessed", False)
    if type(study_seconds) is not int or study_seconds < 0:
        raise AdminApiError(400, "Thời gian học không hợp lệ.")
    if type(question_count) is not int or question_count < 0:
        raise AdminApiError(400, "Số câu hỏi không hợp lệ.")
    if not isinstance(accessed, bool):
        raise AdminApiError(400, "Trạng thái truy cập không hợp lệ.")

    _supabase_request(
        "POST",
        "/rest/v1/rpc/record_study_activity",
        {
            "p_resource_id": resource_id,
            "p_study_seconds": study_seconds,
            "p_question_count": question_count,
            "p_accessed": accessed,
        },
        access_token=user["token"],
    )
    return jsonify(saved=True)


@learning_api.get("/materials/<material_id>/signed-url")
def get_material_signed_url(material_id):
    user = _current_user()
    material = _owned_row("lecture_materials", material_id, "file_path", access_token=user["token"])
    encoded_path = quote(material["file_path"], safe="/")
    result = _storage_request(
        "POST",
        f"/storage/v1/object/sign/lecture-materials/{encoded_path}",
        json.dumps({"expiresIn": 3600}).encode("utf-8"),
        access_token=user["token"],
    )
    signed_url = result.get("signedURL") if isinstance(result, dict) else None
    if not isinstance(signed_url, str) or not signed_url:
        raise AdminApiError(502, "Supabase không trả về liên kết PDF.")
    base_url = current_app.config["SUPABASE_URL"].rstrip("/")
    if signed_url.startswith("/"):
        signed_url = f"{base_url}/storage/v1{signed_url}"
    elif signed_url.startswith("object/"):
        signed_url = f"{base_url}/storage/v1/{signed_url}"
    return jsonify(signedUrl=signed_url)


@learning_api.post("/courses")
def create_course():
    user = _current_user()
    _require_manager(user)
    body = _json_body()
    course = {
        "name": _required_text(body, "name", "tên môn", 120),
        "category": _required_text(body, "category", "nhóm môn", 80),
        "description": str(body.get("description", "")).strip()[:500],
        "created_by": user["id"],
    }
    rows = _rest_rows(
        f"/rest/v1/courses?select={COURSE_SELECT}",
        method="POST",
        payload=course,
        access_token=user["token"],
    )
    if not rows:
        raise AdminApiError(502, "Không tạo được môn học.")
    return jsonify(course=rows[0]), 201


@learning_api.post("/courses/import")
def import_courses():
    user = _current_user()
    _require_manager(user)
    body = _json_body()
    inputs = body.get("courses")
    if not isinstance(inputs, list) or not inputs:
        raise AdminApiError(400, "Danh sách môn học không hợp lệ.")
    if len(inputs) > 200:
        raise AdminApiError(400, "Mỗi lần chỉ nhập tối đa 200 môn học.")

    existing_rows = _rest_rows(
        f"/rest/v1/courses?select=name",
        access_token=user["token"],
    )
    known_names = {str(item["name"]).casefold() for item in existing_rows}
    created, skipped, failed = [], 0, []
    for item in inputs:
        try:
            if not isinstance(item, dict):
                raise AdminApiError(400, "Dòng môn học không hợp lệ.")
            name = _required_text(item, "course", "tên môn", 120)
            category = _required_text(item, "category", "nhóm môn", 80)
            description = str(item.get("description", "")).strip()[:500]
            key = name.casefold()
            if key in known_names:
                skipped += 1
                continue
            rows = _rest_rows(
                f"/rest/v1/courses?select={COURSE_SELECT}",
                method="POST",
                payload={"name": name, "category": category, "description": description, "created_by": user["id"]},
                access_token=user["token"],
            )
            if not rows:
                raise AdminApiError(502, "Máy chủ không trả về môn học vừa tạo.")
            created.append(rows[0])
            known_names.add(key)
        except AdminApiError as error:
            if error.status_code == 409:
                skipped += 1
                continue
            failed.append(f"{item.get('course', 'Môn học') if isinstance(item, dict) else 'Môn học'}: {error.message}")
    return jsonify(created=created, skipped=skipped, failed=failed)


@learning_api.patch("/courses/<course_id>")
def update_course(course_id):
    user = _current_user()
    current = _owned_row("courses", course_id, "id,created_by", access_token=user["token"])
    _course_permission(user, current)
    body = _json_body()
    values = {
        "name": _required_text(body, "name", "tên môn", 120),
        "category": _required_text(body, "category", "nhóm môn", 80),
        "description": str(body.get("description", "")).strip()[:500],
    }
    rows = _rest_rows(
        f"/rest/v1/courses?select={COURSE_SELECT}&id=eq.{quote(course_id, safe='')}",
        method="PATCH",
        payload=values,
        access_token=user["token"],
    )
    if not rows:
        raise AdminApiError(404, "Không tìm thấy môn học cần cập nhật.")
    return jsonify(course=rows[0])


@learning_api.delete("/courses/<course_id>")
def delete_course(course_id):
    user = _current_user()
    current = _owned_row("courses", course_id, "id,created_by", access_token=user["token"])
    _course_permission(user, current)
    materials = _rest_rows(
        f"/rest/v1/lecture_materials?select=id&course_id=eq.{quote(course_id, safe='')}",
        access_token=user["token"],
    )
    if materials:
        raise AdminApiError(409, "Môn này còn tài liệu. Hãy xóa tài liệu trước.")
    rows = _rest_rows(
        f"/rest/v1/courses?id=eq.{quote(course_id, safe='')}",
        method="DELETE",
        access_token=user["token"],
    )
    if rows == []:
        return jsonify(deleted=True)
    return jsonify(deleted=True)


@learning_api.post("/materials")
def upload_material():
    user = _current_user()
    _require_manager(user)
    uploaded_file = request.files.get("file")
    if uploaded_file is None or not uploaded_file.filename:
        raise AdminApiError(400, "Chọn một file PDF trước khi tải lên.")
    if not uploaded_file.filename.lower().endswith(".pdf"):
        raise AdminApiError(400, "Chỉ hỗ trợ file PDF.")
    file_bytes = uploaded_file.read(MAX_PDF_SIZE + 1)
    if not file_bytes or len(file_bytes) > MAX_PDF_SIZE:
        raise AdminApiError(413, "File PDF phải nhỏ hơn hoặc bằng 50 MB.")
    if not file_bytes.startswith(b"%PDF-"):
        raise AdminApiError(400, "File được chọn không phải PDF hợp lệ.")

    course_id = request.form.get("courseId", "")
    course = _owned_row("courses", course_id, COURSE_SELECT, access_token=user["token"])
    _course_permission(user, course)
    title = request.form.get("title", "").strip()
    chapter = request.form.get("chapter", "").strip()
    description = request.form.get("description", "").strip()
    try:
        slide_count = int(request.form.get("slideCount", "0"))
    except ValueError as error:
        raise AdminApiError(400, "Số trang PDF không hợp lệ.") from error
    if not title or len(title) > 180:
        raise AdminApiError(400, "Tên tài liệu phải có từ 1 đến 180 ký tự.")
    if len(chapter) > 120 or len(description) > 1000 or slide_count < 1:
        raise AdminApiError(400, "Thông tin tài liệu không hợp lệ.")

    file_path = f"{user['id']}/{uuid4()}.pdf"
    _storage_request(
        "POST",
        f"/storage/v1/object/lecture-materials/{quote(file_path, safe='/')}",
        file_bytes,
        "application/pdf",
        access_token=user["token"],
    )
    row = {
        "course_id": course["id"],
        "title": title,
        "chapter": chapter,
        "description": description,
        "teacher_name": user["profile"].get("full_name") or user["profile"].get("email") or "",
        "file_path": file_path,
        "file_name": uploaded_file.filename[:255],
        "file_size": len(file_bytes),
        "slide_count": slide_count,
        "uploaded_by": user["id"],
    }
    try:
        rows = _rest_rows(
            f"/rest/v1/lecture_materials?select={MATERIAL_SELECT}",
            method="POST",
            payload=row,
            access_token=user["token"],
        )
    except AdminApiError as error:
        try:
            _remove_storage_file(file_path, access_token=user["token"])
        except AdminApiError as cleanup_error:
            current_app.logger.error("Could not remove unregistered uploaded PDF: %s", cleanup_error.message)
        raise error
    if not rows:
        raise AdminApiError(502, "Không lưu được thông tin PDF.")
    return jsonify(material=rows[0]), 201


@learning_api.patch("/materials/<material_id>")
def update_material(material_id):
    user = _current_user()
    current = _owned_row(
        "lecture_materials",
        material_id,
        "id,uploaded_by",
        access_token=user["token"],
    )
    _require_content_owner(user, current, "uploaded_by")
    body = _json_body()
    slide_count = body.get("slideCount")
    if type(slide_count) is not int or slide_count < 1:
        raise AdminApiError(400, "Số trang PDF không hợp lệ.")
    values = {
        "title": _required_text(body, "title", "tên tài liệu", 180),
        "chapter": _required_text(body, "chapter", "chương", 120),
        "description": str(body.get("description", "")).strip()[:1000],
        "slide_count": slide_count,
    }
    rows = _rest_rows(
        f"/rest/v1/lecture_materials?select={MATERIAL_SELECT}&id=eq.{quote(material_id, safe='')}",
        method="PATCH",
        payload=values,
        access_token=user["token"],
    )
    if not rows:
        raise AdminApiError(404, "Không tìm thấy tài liệu cần cập nhật.")
    return jsonify(material=rows[0])


@learning_api.delete("/materials/<material_id>")
def delete_material(material_id):
    user = _current_user()
    current = _owned_row(
        "lecture_materials",
        material_id,
        "id,uploaded_by,file_path",
        access_token=user["token"],
    )
    _require_content_owner(user, current, "uploaded_by")
    rows = _rest_rows(
        f"/rest/v1/lecture_materials?id=eq.{quote(material_id, safe='')}",
        method="DELETE",
        access_token=user["token"],
    )
    if not rows:
        raise AdminApiError(404, "Không tìm thấy tài liệu cần xóa.")
    try:
        _remove_storage_file(current["file_path"], access_token=user["token"])
    except AdminApiError as error:
        raise AdminApiError(502, f"Đã xóa thông tin tài liệu nhưng không xóa được file PDF: {error.message}") from error
    return jsonify(deleted=True)
