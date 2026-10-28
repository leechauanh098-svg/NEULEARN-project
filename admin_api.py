import json
import re
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen
from uuid import UUID

from flask import Blueprint, current_app, jsonify, request

admin_api = Blueprint("admin_api", __name__, url_prefix="/api/admin")
VALID_ROLES = {"student", "lecturer", "admin"}


class AdminApiError(Exception):
    def __init__(self, status_code, message, upstream_status=None):
        super().__init__(message)
        self.status_code = status_code
        self.message = message
        self.upstream_status = upstream_status


def _supabase_config():
    url = current_app.config.get("SUPABASE_URL")
    service_key = current_app.config.get("SUPABASE_SERVICE_ROLE_KEY")
    anon_key = current_app.config.get("SUPABASE_ANON_KEY")
    if not url or not service_key or not anon_key:
        raise AdminApiError(503, "Flask chưa được cấu hình đầy đủ thông tin Supabase cho quản trị.")
    return url.rstrip("/"), service_key, anon_key


def _supabase_request(method, path, payload=None, access_token=None):
    url, service_key, anon_key = _supabase_config()
    key = anon_key if access_token else service_key
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {access_token or service_key}",
        "Accept": "application/json",
    }
    data = None
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"
    if method in {"POST", "PATCH", "PUT"}:
        headers["Prefer"] = "return=representation"

    upstream_request = Request(f"{url}{path}", data=data, headers=headers, method=method)
    try:
        with urlopen(upstream_request, timeout=15) as response:
            response_body = response.read()
    except HTTPError as error:
        body = error.read().decode("utf-8", errors="replace")
        try:
            details = json.loads(body)
        except json.JSONDecodeError:
            details = {}
        if not isinstance(details, dict):
            details = {}
        message = details.get("msg") or details.get("message") or details.get("error_description") or "Supabase từ chối yêu cầu."
        response_status = error.code if 400 <= error.code < 500 else 502
        raise AdminApiError(response_status, str(message), upstream_status=error.code) from error
    except (TimeoutError, URLError) as error:
        raise AdminApiError(502, "Không thể kết nối Supabase. Vui lòng thử lại.") from error

    if not response_body:
        return None
    try:
        return json.loads(response_body)
    except json.JSONDecodeError as error:
        raise AdminApiError(502, "Supabase trả về dữ liệu không hợp lệ.") from error


def _current_user():
    authorization = request.headers.get("Authorization", "")
    scheme, separator, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not separator or not token.strip():
        raise AdminApiError(401, "Phiên đăng nhập không hợp lệ. Hãy đăng nhập lại.")

    try:
        auth_user = _supabase_request("GET", "/auth/v1/user", access_token=token.strip())
    except AdminApiError as error:
        if error.upstream_status in {400, 401, 403}:
            raise AdminApiError(401, "Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.") from error
        raise

    user_id = auth_user.get("id") if isinstance(auth_user, dict) else None
    if not user_id:
        raise AdminApiError(401, "Không xác định được tài khoản đăng nhập.")

    profile_filter = quote(str(user_id), safe="")
    profiles = _supabase_request(
        "GET",
        f"/rest/v1/profiles?select=id,email,full_name,role&id=eq.{profile_filter}",
    )
    if not profiles:
        raise AdminApiError(403, "Tài khoản chưa có hồ sơ trong hệ thống.")
    return {
        "id": str(user_id),
        "token": token.strip(),
        "profile": profiles[0],
    }


def _current_admin():
    current_user = _current_user()
    if current_user["profile"].get("role") != "admin":
        raise AdminApiError(403, "Bạn không có quyền quản trị người dùng.")
    return current_user["id"]


def _json_body():
    body = request.get_json(silent=True)
    if not isinstance(body, dict):
        raise AdminApiError(400, "Dữ liệu gửi lên không hợp lệ.")
    return body


def _required_text(body, key, label, max_length):
    value = body.get(key)
    if not isinstance(value, str) or not value.strip():
        raise AdminApiError(400, f"Vui lòng nhập {label}.")
    value = value.strip()
    if len(value) > max_length:
        raise AdminApiError(400, f"{label.capitalize()} không được dài quá {max_length} ký tự.")
    return value


def _validated_email(body):
    email = _required_text(body, "email", "email", 254).lower()
    if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
        raise AdminApiError(400, "Địa chỉ email không hợp lệ.")
    return email


def _validated_role(body):
    role = body.get("role")
    if not isinstance(role, str) or role not in VALID_ROLES:
        raise AdminApiError(400, "Vai trò phải là sinh viên, giảng viên hoặc quản trị viên.")
    return role


def _validated_password(body):
    password = body.get("password")
    if not isinstance(password, str) or not password.strip():
        raise AdminApiError(400, "Vui lòng nhập mật khẩu.")
    if len(password) < 8:
        raise AdminApiError(400, "Mật khẩu phải có ít nhất 8 ký tự.")
    if len(password) > 128:
        raise AdminApiError(400, "Mật khẩu không được dài quá 128 ký tự.")
    return password


def _validated_user_id(raw_user_id):
    try:
        return str(UUID(raw_user_id))
    except (ValueError, TypeError, AttributeError) as error:
        raise AdminApiError(400, "Mã người dùng không hợp lệ.") from error


def _profile(user_id):
    rows = _supabase_request(
        "GET",
        f"/rest/v1/profiles?select=id,email,full_name,role,created_at&id=eq.{quote(user_id, safe='')}",
    )
    if not rows:
        raise AdminApiError(404, "Không tìm thấy hồ sơ người dùng.")
    return rows[0]


def _admin_count():
    rows = _supabase_request("GET", "/rest/v1/profiles?select=id&role=eq.admin")
    return len(rows)


def _ensure_not_last_admin(profile, new_role=None):
    if profile["role"] == "admin" and new_role != "admin" and _admin_count() <= 1:
        raise AdminApiError(409, "Không thể hạ quyền quản trị viên cuối cùng.")


@admin_api.errorhandler(AdminApiError)
def handle_admin_api_error(error):
    return jsonify(error=error.message), error.status_code


@admin_api.get("/users")
def list_users():
    _current_admin()
    users = _supabase_request(
        "GET",
        "/rest/v1/profiles?select=id,email,full_name,role,created_at&order=created_at.desc",
    )
    return jsonify(users=users)


@admin_api.post("/users")
def create_user():
    _current_admin()
    body = _json_body()
    email = _validated_email(body)
    full_name = _required_text(body, "fullName", "họ tên", 160)
    role = _validated_role(body)
    password = _validated_password(body)

    created_user = _supabase_request(
        "POST",
        "/auth/v1/admin/users",
        {
            "email": email,
            "password": password,
            "email_confirm": True,
            "user_metadata": {"full_name": full_name},
        },
    )
    user_id = created_user.get("id") if isinstance(created_user, dict) else None
    if not user_id:
        raise AdminApiError(502, "Supabase không trả về mã tài khoản vừa tạo.")

    try:
        _supabase_request(
            "PATCH",
            f"/rest/v1/profiles?id=eq.{quote(str(user_id), safe='')}",
            {"email": email, "full_name": full_name, "role": role},
        )
        return jsonify(user=_profile(str(user_id))), 201
    except AdminApiError as profile_error:
        try:
            _supabase_request("DELETE", f"/auth/v1/admin/users/{quote(str(user_id), safe='')}")
        except AdminApiError as cleanup_error:
            current_app.logger.error("Could not roll back newly created auth user: %s", cleanup_error.message)
            raise AdminApiError(
                502,
                "Tài khoản đã được tạo nhưng chưa đồng bộ được hồ sơ. Hãy kiểm tra danh sách người dùng.",
            ) from profile_error
        raise profile_error


@admin_api.patch("/users/<raw_user_id>")
def update_user(raw_user_id):
    admin_id = _current_admin()
    user_id = _validated_user_id(raw_user_id)
    body = _json_body()
    email = _validated_email(body)
    full_name = _required_text(body, "fullName", "họ tên", 160)
    role = _validated_role(body)
    existing = _profile(user_id)
    _ensure_not_last_admin(existing, role)
    if user_id == admin_id and role != existing["role"]:
        raise AdminApiError(409, "Không thể tự thay đổi vai trò của chính mình.")

    _supabase_request(
        "PUT",
        f"/auth/v1/admin/users/{quote(user_id, safe='')}",
        {
            "email": email,
            "email_confirm": True,
            "user_metadata": {"full_name": full_name},
        },
    )
    try:
        _supabase_request(
            "PATCH",
            f"/rest/v1/profiles?id=eq.{quote(user_id, safe='')}",
            {"email": email, "full_name": full_name, "role": role},
        )
    except AdminApiError as profile_error:
        try:
            _supabase_request(
                "PUT",
                f"/auth/v1/admin/users/{quote(user_id, safe='')}",
                {
                    "email": existing["email"],
                    "email_confirm": True,
                    "user_metadata": {"full_name": existing["full_name"]},
                },
            )
        except AdminApiError as rollback_error:
            current_app.logger.error("Could not roll back auth user update: %s", rollback_error.message)
            raise AdminApiError(
                502,
                "Không đồng bộ được hồ sơ và không thể hoàn tác email. Hãy kiểm tra lại tài khoản này.",
            ) from profile_error
        raise profile_error

    return jsonify(user=_profile(user_id))


@admin_api.delete("/users/<raw_user_id>")
def remove_user(raw_user_id):
    admin_id = _current_admin()
    user_id = _validated_user_id(raw_user_id)
    if user_id == admin_id:
        raise AdminApiError(409, "Không thể xóa tài khoản quản trị viên đang đăng nhập.")

    existing = _profile(user_id)
    _ensure_not_last_admin(existing)

    owner_filter = quote(user_id, safe="")
    courses = _supabase_request(
        "GET",
        f"/rest/v1/courses?select=id&created_by=eq.{owner_filter}",
    )
    materials = _supabase_request(
        "GET",
        f"/rest/v1/lecture_materials?select=id&uploaded_by=eq.{owner_filter}",
    )
    course_ids = [str(course["id"]) for course in courses]
    material_ids = [str(material["id"]) for material in materials]
    course_filter = f"id=in.({','.join(course_ids)})" if course_ids else ""
    material_filter = f"id=in.({','.join(material_ids)})" if material_ids else ""
    storage_transferred = False

    try:
        if course_filter:
            _supabase_request(
                "PATCH",
                f"/rest/v1/courses?{course_filter}",
                {"created_by": admin_id},
            )
        if material_filter:
            _supabase_request(
                "PATCH",
                f"/rest/v1/lecture_materials?{material_filter}",
                {"uploaded_by": admin_id},
            )
        _supabase_request(
            "POST",
            "/rest/v1/rpc/transfer_learning_storage_ownership",
            {
                "p_from_user": user_id,
                "p_to_user": admin_id,
                "p_folder_user": user_id,
            },
        )
        storage_transferred = True
        _supabase_request("DELETE", f"/auth/v1/admin/users/{owner_filter}")
    except AdminApiError as delete_error:
        rollback_errors = []
        if course_filter:
            try:
                _supabase_request(
                    "PATCH",
                    f"/rest/v1/courses?{course_filter}",
                    {"created_by": user_id},
                )
            except AdminApiError as rollback_error:
                rollback_errors.append(rollback_error.message)
        if material_filter:
            try:
                _supabase_request(
                    "PATCH",
                    f"/rest/v1/lecture_materials?{material_filter}",
                    {"uploaded_by": user_id},
                )
            except AdminApiError as rollback_error:
                rollback_errors.append(rollback_error.message)
        if storage_transferred:
            try:
                _supabase_request(
                    "POST",
                    "/rest/v1/rpc/transfer_learning_storage_ownership",
                    {
                        "p_from_user": admin_id,
                        "p_to_user": user_id,
                        "p_folder_user": user_id,
                    },
                )
            except AdminApiError as rollback_error:
                rollback_errors.append(rollback_error.message)
        if rollback_errors:
            current_app.logger.error("Could not fully restore user-owned learning content: %s", "; ".join(rollback_errors))
            raise AdminApiError(
                502,
                "Không hoàn tất xóa tài khoản và một phần học liệu có thể đã chuyển quyền cho quản trị viên hiện tại.",
            ) from delete_error
        raise delete_error

    return jsonify(deleted=True, transferredContent=True)
