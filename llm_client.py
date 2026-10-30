"""Bá»c lá»i gá»i Gemini API (generateContent) báº±ng thÆ° viá»‡n chuáº©n."""

import json
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from flask import current_app

from admin_api import AdminApiError

GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"


def generate_answer(system_prompt, turns):
    """turns: list[{"role": "user"|"model", "text": str}]. Tráº£ vá» text cÃ¢u tráº£ lá»i."""
    api_key = current_app.config.get("GEMINI_API_KEY")
    if not api_key:
        raise AdminApiError(503, "Flask chÆ°a Ä‘Æ°á»£c cáº¥u hÃ¬nh GEMINI_API_KEY.")
    model = current_app.config.get("GEMINI_MODEL") or "gemini-3.5-flash"
    payload = {
        "systemInstruction": {"parts": [{"text": system_prompt}]},
        "contents": [{"role": turn["role"], "parts": [{"text": turn["text"]}]} for turn in turns],
        "generationConfig": {"temperature": 0.2, "maxOutputTokens": 1500},
    }
    remote_request = Request(
        GEMINI_ENDPOINT.format(model=model),
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", "x-goog-api-key": api_key},
        method="POST",
    )
    try:
        with urlopen(remote_request, timeout=45) as response:
            result = json.loads(response.read())
    except HTTPError as error:
        current_app.logger.error("Gemini API error %s: %s", error.code, error.read()[:300])
        status = 429 if error.code == 429 else 502
        raise AdminApiError(status, "Trá»£ lÃ½ AI Ä‘ang báº­n hoáº·c tá»« chá»‘i yÃªu cáº§u. Vui lÃ²ng thá»­ láº¡i sau.") from error
    except (TimeoutError, URLError, json.JSONDecodeError) as error:
        raise AdminApiError(502, "KhÃ´ng thá»ƒ káº¿t ná»‘i trá»£ lÃ½ AI. Vui lÃ²ng thá»­ láº¡i.") from error

    try:
        text = "".join(part.get("text", "") for part in result["candidates"][0]["content"]["parts"])
    except (KeyError, IndexError, TypeError) as error:
        raise AdminApiError(502, "Trá»£ lÃ½ AI khÃ´ng tráº£ vá» ná»™i dung.") from error
    if not text.strip():
        raise AdminApiError(502, "Trá»£ lÃ½ AI khÃ´ng tráº£ vá» ná»™i dung.")
    return text.strip()
