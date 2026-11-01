"""Bá»c lá»i gá»i Gemini API (generateContent) báº±ng thÆ° viá»‡n chuáº©n."""

import json
import re
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from flask import current_app

from admin_api import AdminApiError

GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"


def generate_answer(system_prompt, turns, generation_config=None, timeout=45):
    """turns: list[{"role": "user"|"model", "text": str}]. Tráº£ vá» text cÃ¢u tráº£ lá»i."""
    api_key = current_app.config.get("GEMINI_API_KEY")
    if not api_key:
        raise AdminApiError(503, "Flask chÆ°a Ä‘Æ°á»£c cáº¥u hÃ¬nh GEMINI_API_KEY.")
    model = current_app.config.get("GEMINI_MODEL") or "gemini-3.5-flash"
    payload = {
        "systemInstruction": {"parts": [{"text": system_prompt}]},
        "contents": [{"role": turn["role"], "parts": [{"text": turn["text"]}]} for turn in turns],
        "generationConfig": generation_config or {"temperature": 0.2, "maxOutputTokens": 1500},
    }
    remote_request = Request(
        GEMINI_ENDPOINT.format(model=model),
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", "x-goog-api-key": api_key},
        method="POST",
    )
    try:
        with urlopen(remote_request, timeout=timeout) as response:
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


def generate_json(system_prompt, turns, schema, timeout=90):
    """Gọi Gemini và parse JSON. schema là responseSchema của generateContent."""
    text = generate_answer(
        system_prompt,
        turns,
        generation_config={
            "temperature": 0.35,
            "maxOutputTokens": 4096,
            "responseMimeType": "application/json",
            "responseSchema": schema,
        },
        timeout=timeout,
    )
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", cleaned, flags=re.IGNORECASE | re.DOTALL).strip()
    try:
        parsed = json.loads(cleaned)
    except json.JSONDecodeError as error:
        raise AdminApiError(502, "Trợ lý AI không trả về JSON hợp lệ.") from error
    return parsed
