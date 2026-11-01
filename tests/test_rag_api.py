import unittest
from unittest.mock import patch

import pymupdf as fitz

from app import app
from rag_api import _build_quiz_context, _clean_history, build_citations, normalize_quiz
from rag_indexer import chunk_pages, extract_pages

USER = {"id": "u1", "token": "t", "profile": {"id": "u1", "role": "student", "email": "", "full_name": ""}}


class ChunkingTests(unittest.TestCase):
    def test_empty_pages_are_skipped_and_page_numbers_kept(self):
        chunks = chunk_pages([(1, "  \n "), (2, "Xin chÃ o\nTháº¿ giá»›i")])
        self.assertEqual(len(chunks), 1)
        self.assertEqual(chunks[0]["page_number"], 2)

    def test_long_page_is_split_within_limit(self):
        text = "\n".join(f"DÃ²ng sá»‘ {i} " + "x" * 50 for i in range(60))
        chunks = chunk_pages([(3, text)], max_chars=300)
        self.assertGreater(len(chunks), 1)
        self.assertTrue(all(len(c["content"]) <= 300 for c in chunks))
        self.assertEqual([c["chunk_index"] for c in chunks], list(range(len(chunks))))

    def test_extract_pages_reads_real_pdf(self):
        doc = fitz.open()
        doc.new_page().insert_text((72, 72), "Hello C language")
        doc.new_page().insert_text((72, 72), "Second page")
        pages = extract_pages(doc.tobytes())
        self.assertEqual([p[0] for p in pages], [1, 2])
        self.assertIn("Hello", pages[0][1])


class CitationTests(unittest.TestCase):
    def test_only_valid_referenced_sources_become_citations(self):
        chunks = [
            {"page_number": 4, "content": "Ná»™i dung A"},
            {"page_number": 9, "content": "Ná»™i dung B"},
        ]
        citations = build_citations("Ã má»™t [2]. Ã hai [2][1]. Bá»‹a [7].", chunks)
        self.assertEqual([c["id"] for c in citations], [2, 1])
        self.assertEqual([c["page"] for c in citations], [9, 4])

    def test_history_is_alternating_and_drops_trailing_user_turn(self):
        history = [
            {"role": "assistant", "text": "chÃ o"},
            {"role": "student", "text": "q1"},
            {"role": "assistant", "text": "a1"},
            {"role": "student", "text": "q2"},
        ]
        self.assertEqual(
            _clean_history(history),
            [{"role": "user", "text": "q1"}, {"role": "model", "text": "a1"}],
        )


class ChatEndpointTests(unittest.TestCase):
    def setUp(self):
        app.config.update(TESTING=True, SUPABASE_URL="https://x.supabase.co", GEMINI_API_KEY="k")
        self.client = app.test_client()

    def test_requires_login(self):
        self.assertEqual(self.client.post("/api/materials/m1/chat", json={"question": "a"}).status_code, 401)

    def test_pending_material_is_indexed_before_chat(self):
        with patch("rag_api._current_user", return_value=USER), patch(
            "rag_api._owned_row",
            return_value={"id": "m1", "title": "T", "file_path": "m1.pdf", "index_status": "pending", "index_error": ""},
        ), patch("rag_api._download_pdf", return_value=b"%PDF"), patch(
            "rag_api.index_material", return_value="ready"
        ), patch("rag_api._supabase_request", return_value=[]):
            response = self.client.post("/api/materials/m1/chat", json={"question": "a"})
        self.assertEqual(response.status_code, 200)

    def test_answer_includes_citations(self):
        chunks = [{"page_number": 5, "content": "Biáº¿n lÃ  vÃ¹ng nhá»›"}]
        with patch("rag_api._current_user", return_value=USER), patch(
            "rag_api._owned_row", return_value={"id": "m1", "title": "T", "index_status": "ready"}
        ), patch("rag_api._supabase_request", return_value=chunks), patch(
            "rag_api.generate_answer", return_value="Biáº¿n lÃ  vÃ¹ng nhá»› [1]."
        ) as llm:
            response = self.client.post("/api/materials/m1/chat", json={"question": "Biáº¿n lÃ  gÃ¬?"})
        self.assertEqual(response.status_code, 200)
        body = response.get_json()
        self.assertEqual(body["citations"][0]["page"], 5)
        self.assertIn("Biáº¿n lÃ  gÃ¬?", llm.call_args[0][1][-1]["text"])

    def test_no_match_skips_llm(self):
        with patch("rag_api._current_user", return_value=USER), patch(
            "rag_api._owned_row", return_value={"id": "m1", "title": "T", "index_status": "ready"}
        ), patch("rag_api._supabase_request", return_value=[]), patch("rag_api.generate_answer") as llm:
            response = self.client.post("/api/materials/m1/chat", json={"question": "abc"})
        self.assertEqual(response.get_json()["citations"], [])
        llm.assert_not_called()


class QuizTests(unittest.TestCase):
    def test_build_quiz_context_spreads_across_whole_pdf(self):
        chunks = [{"page_number": p, "content": f"Trang {p} noi dung quan trong"} for p in range(1, 21)]
        context = _build_quiz_context(chunks, target_count=5)
        self.assertIn("TRANG 1", context)
        self.assertIn("TRANG 20", context)
        self.assertEqual(context.count("[MỤC "), 5)

    def test_normalize_quiz_requires_exactly_five_questions(self):
        raw_quiz = {
            "title": "Kiem tra 5 cau",
            "questions": [
                {
                    "prompt": f"Cau hoi {i}?",
                    "choices": ["A", "B", "C", "D"],
                    "correctIndex": 0,
                    "explanation": "Dung vi...",
                    "page": i * 2,
                }
                for i in range(1, 6)
            ],
        }
        normalized = normalize_quiz(raw_quiz)
        self.assertEqual(len(normalized["questions"]), 5)
        self.assertEqual(normalized["questions"][0]["correctId"], "A")
        self.assertEqual(normalized["questions"][4]["page"], 10)


if __name__ == "__main__":
    unittest.main()
