import os
from pathlib import Path

from admin_api import admin_api
from dotenv import load_dotenv
from flask import Flask, abort, jsonify, request, send_from_directory
from learning_api import learning_api
from werkzeug.utils import safe_join

ROOT_DIR = Path(__file__).resolve().parent
load_dotenv(ROOT_DIR / ".env.local")

EXPORT_DIR = ROOT_DIR / "out"
INDEX_FILE = EXPORT_DIR / "index.html"

app = Flask(__name__, static_folder=None)
app.config.update(
    SUPABASE_URL=os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL"),
    SUPABASE_ANON_KEY=(
        os.environ.get("SUPABASE_ANON_KEY")
        or os.environ.get("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY")
        or os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    ),
    SUPABASE_SERVICE_ROLE_KEY=os.environ.get("SUPABASE_SERVICE_ROLE_KEY"),
)
app.register_blueprint(admin_api)
app.register_blueprint(learning_api)
app.config["MAX_CONTENT_LENGTH"] = 51 * 1024 * 1024


@app.after_request
def add_security_headers(response):
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["X-Frame-Options"] = "SAMEORIGIN"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    allowed_origins = {
        origin.strip()
        for origin in os.environ.get(
            "FLASK_CORS_ORIGINS",
            "http://localhost:3000,http://127.0.0.1:3000,http://localhost:3001,http://127.0.0.1:3001",
        ).split(",")
        if origin.strip()
    }
    request_origin = request.headers.get("Origin")
    if request_origin in allowed_origins and request.path.startswith("/api/"):
        response.headers["Access-Control-Allow-Origin"] = request_origin
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PATCH, DELETE, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "Authorization, Content-Type"
        response.headers["Access-Control-Max-Age"] = "600"
        response.headers.add("Vary", "Origin")
    if request.is_secure:
        response.headers["Strict-Transport-Security"] = "max-age=63072000"
    return response


@app.errorhandler(413)
def request_entity_too_large(_error):
    if request.path.startswith("/api/"):
        return jsonify(error="Yêu cầu vượt quá dung lượng cho phép."), 413
    return "Request too large", 413


@app.get("/healthz")
def health_check():
    return jsonify(status="ok", built=INDEX_FILE.is_file())


@app.get("/")
@app.get("/home")
@app.get("/course")
@app.get("/documents")
@app.get("/study-stats")
@app.get("/guide")
@app.get("/teacher")
@app.get("/admin/users")
@app.get("/study")
@app.get("/code")
@app.get("/login")
@app.get("/reset-password")
def index():
    if not INDEX_FILE.is_file():
        abort(503, description="Frontend export is missing. Run `npm run build` first.")
    return send_from_directory(EXPORT_DIR, "index.html")


@app.get("/<path:requested_path>")
def serve_export(requested_path):
    if requested_path == "api" or requested_path.startswith("api/"):
        return jsonify(error="Không tìm thấy API Flask."), 404

    if not INDEX_FILE.is_file():
        abort(503, description="Frontend export is missing. Run `npm run build` first.")

    safe_path = safe_join(str(EXPORT_DIR), requested_path)
    if safe_path and Path(safe_path).is_file():
        return send_from_directory(EXPORT_DIR, requested_path)

    if Path(requested_path).suffix:
        abort(404)

    return send_from_directory(EXPORT_DIR, "index.html")


if __name__ == "__main__":
    app.run(
        host=os.environ.get("FLASK_HOST", "127.0.0.1"),
        port=int(os.environ.get("FLASK_PORT", "5000")),
        debug=os.environ.get("FLASK_DEBUG", "").lower() == "true",
    )
