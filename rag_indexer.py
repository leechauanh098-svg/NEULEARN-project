"""TrÃ­ch text PDF theo trang, chia chunk vÃ  lÆ°u vÃ o báº£ng material_chunks."""

import re
from urllib.parse import quote

from admin_api import AdminApiError, _supabase_request

MAX_CHUNK_CHARS = 800
INSERT_BATCH_SIZE = 200


def extract_pages(file_bytes):
    """Tráº£ vá» danh sÃ¡ch (sá»‘ trang báº¯t Ä‘áº§u tá»« 1, text) cho má»—i trang PDF."""
    import pymupdf as fitz  # PyMuPDF

    try:
        document = fitz.open(stream=file_bytes, filetype="pdf")
    except Exception as error:  # PyMuPDF nÃ©m nhiá»u loáº¡i lá»—i khÃ¡c nhau
        raise AdminApiError(400, "KhÃ´ng Ä‘á»c Ä‘Æ°á»£c ná»™i dung PDF.") from error
    try:
        return [(index + 1, page.get_text("text")) for index, page in enumerate(document)]
    finally:
        document.close()


def _clean(text):
    text = text.replace("\x00", " ")
    text = re.sub(r"[ \t\u00a0]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _split_text(text, max_chars):
    """Chia text thÃ nh cÃ¡c Ä‘oáº¡n <= max_chars, Æ°u tiÃªn cáº¯t táº¡i xuá»‘ng dÃ²ng/dáº¥u cÃ¢u."""
    if len(text) <= max_chars:
        return [text]
    chunks, current = [], ""
    for line in text.split("\n"):
        line = line.strip()
        if not line:
            continue
        while len(line) > max_chars:
            cut = max(line.rfind(". ", 0, max_chars), line.rfind(" ", 0, max_chars))
            cut = cut + 1 if cut > 0 else max_chars
            if current:
                chunks.append(current)
                current = ""
            chunks.append(line[:cut].strip())
            line = line[cut:].strip()
        if current and len(current) + len(line) + 1 > max_chars:
            chunks.append(current)
            current = line
        else:
            current = f"{current}\n{line}" if current else line
    if current:
        chunks.append(current)
    return chunks


def chunk_pages(pages, max_chars=MAX_CHUNK_CHARS):
    """Tráº£ vá» danh sÃ¡ch dict {page_number, chunk_index, content}; bá» trang khÃ´ng cÃ³ text."""
    result = []
    for page_number, raw_text in pages:
        text = _clean(raw_text)
        if not text:
            continue
        for chunk_index, content in enumerate(_split_text(text, max_chars)):
            if content.strip():
                result.append({"page_number": page_number, "chunk_index": chunk_index, "content": content})
    return result


def _set_status(material_id, status, error=""):
    _supabase_request(
        "PATCH",
        f"/rest/v1/lecture_materials?id=eq.{quote(material_id, safe='')}",
        {"index_status": status, "index_error": error[:300]},
    )


def index_material(material_id, file_bytes):
    """Láº­p chá»‰ má»¥c láº¡i toÃ n bá»™ tÃ i liá»‡u. KhÃ´ng nÃ©m lá»—i; tráº£ vá» tráº¡ng thÃ¡i cuá»‘i cÃ¹ng."""
    try:
        chunks = chunk_pages(extract_pages(file_bytes))
        if not chunks:
            raise AdminApiError(422, "PDF khÃ´ng cÃ³ vÄƒn báº£n cÃ³ thá»ƒ Ä‘á»c (cÃ³ thá»ƒ lÃ  áº£nh scan).")
        _supabase_request("DELETE", f"/rest/v1/material_chunks?material_id=eq.{quote(material_id, safe='')}")
        for start in range(0, len(chunks), INSERT_BATCH_SIZE):
            batch = [{"material_id": material_id, **chunk} for chunk in chunks[start:start + INSERT_BATCH_SIZE]]
            _supabase_request("POST", "/rest/v1/material_chunks", batch)
        _set_status(material_id, "ready")
        return "ready"
    except AdminApiError as error:
        message = error.message
    except Exception as error:  # khÃ´ng Ä‘á»ƒ lá»—i láº­p chá»‰ má»¥c lÃ m há»ng upload
        message = f"Lá»—i láº­p chá»‰ má»¥c: {error}"
    try:
        _set_status(material_id, "failed", message)
    except AdminApiError:
        pass
    return "failed"
