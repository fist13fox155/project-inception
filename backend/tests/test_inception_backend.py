"""
Backend tests for Project Inception
Covers: health, chat, stocks (quotes/intraday/quarterly/news/recommendation),
document gen (pdf/pptx) CRUD, watchlist, TTS.
"""
import base64
import uuid
import pytest

TIMEOUT_SHORT = 30
TIMEOUT_LONG = 120  # for AI calls


# ---------- Health ----------
class TestHealth:
    def test_health_root(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/", timeout=TIMEOUT_SHORT)
        assert r.status_code == 200
        d = r.json()
        assert d["status"] == "ok"
        assert d["alpha_vantage_configured"] is True
        assert d["llm_configured"] is True


# ---------- Chat ----------
class TestChat:
    session_id = f"TEST_sess_{uuid.uuid4().hex[:8]}"

    def test_chat_send(self, api_client, base_url):
        payload = {"session_id": self.session_id, "message": "Hello JARVIS, give me a one-sentence greeting."}
        r = api_client.post(f"{base_url}/api/chat", json=payload, timeout=TIMEOUT_LONG)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "reply" in d and isinstance(d["reply"], str) and len(d["reply"]) > 0
        assert "message_id" in d
        assert "timestamp" in d

    def test_chat_history(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/chat/history/{self.session_id}", timeout=TIMEOUT_SHORT)
        assert r.status_code == 200
        d = r.json()
        assert "messages" in d and isinstance(d["messages"], list)
        # At least the user + assistant from previous test (if ordering allows)
        assert len(d["messages"]) >= 2
        roles = {m["role"] for m in d["messages"]}
        assert "user" in roles and "assistant" in roles


# ---------- Stocks ----------
class TestStocks:
    def _validate_quote(self, q):
        assert "symbol" in q
        assert isinstance(q["price"], (int, float))
        assert "change" in q
        assert "change_pct" in q
        assert isinstance(q["sparkline"], list) and len(q["sparkline"]) > 0
        assert "is_live" in q

    def test_quotes_batch(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/stocks/quotes", params={"symbols": "AAPL,TSLA,NVDA"}, timeout=TIMEOUT_SHORT)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "quotes" in d
        assert len(d["quotes"]) == 3
        for q in d["quotes"]:
            self._validate_quote(q)
        symbols = {q["symbol"] for q in d["quotes"]}
        assert symbols == {"AAPL", "TSLA", "NVDA"}

    def test_intraday(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/stocks/intraday/AAPL", timeout=TIMEOUT_SHORT)
        assert r.status_code == 200
        d = r.json()
        assert d["symbol"] == "AAPL"
        assert isinstance(d["points"], list) and len(d["points"]) > 0
        for p in d["points"]:
            assert "t" in p and "price" in p

    def test_quarterly(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/stocks/quarterly/AAPL", timeout=TIMEOUT_SHORT)
        assert r.status_code == 200
        d = r.json()
        assert d["symbol"] == "AAPL"
        assert isinstance(d["points"], list) and len(d["points"]) > 0
        for p in d["points"]:
            assert "t" in p and "price" in p

    def test_news(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/stocks/news/AAPL", timeout=TIMEOUT_SHORT)
        assert r.status_code == 200
        d = r.json()
        assert d["symbol"] == "AAPL"
        assert isinstance(d["items"], list) and len(d["items"]) > 0
        item = d["items"][0]
        for k in ("title", "summary", "source", "sentiment"):
            assert k in item

    def test_recommendation(self, api_client, base_url):
        r = api_client.post(f"{base_url}/api/stocks/recommendation", json={"symbol": "AAPL"}, timeout=TIMEOUT_LONG)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["action"] in {"BUY", "HOLD", "SELL"}
        assert 0 <= int(d["confidence"]) <= 100
        assert d["horizon"] in {"short", "medium", "long"}
        assert isinstance(d["reasoning"], str) and len(d["reasoning"]) > 5
        assert d["symbol"] == "AAPL"
        assert "snapshot" in d and "price" in d["snapshot"]


# ---------- Documents ----------
class TestDocuments:
    created_ids = []

    def _validate_b64(self, b64_str, min_bytes=100):
        raw = base64.b64decode(b64_str)
        assert len(raw) >= min_bytes
        return raw

    def test_generate_pdf(self, api_client, base_url):
        payload = {"prompt": "TEST short pitch deck for AI fitness app", "format": "pdf"}
        r = api_client.post(f"{base_url}/api/documents/generate", json=payload, timeout=TIMEOUT_LONG)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["format"] == "pdf"
        assert d["size_bytes"] > 0
        assert "outline" in d
        assert "file_b64" in d
        raw = self._validate_b64(d["file_b64"], min_bytes=500)
        assert raw.startswith(b"%PDF"), "PDF magic header missing"
        TestDocuments.created_ids.append(d["id"])

    def test_generate_pptx(self, api_client, base_url):
        payload = {"prompt": "TEST short pitch deck for AI fitness app", "format": "pptx"}
        r = api_client.post(f"{base_url}/api/documents/generate", json=payload, timeout=TIMEOUT_LONG)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["format"] == "pptx"
        assert d["size_bytes"] > 0
        raw = self._validate_b64(d["file_b64"], min_bytes=500)
        # PPTX is a ZIP archive (PK header)
        assert raw[:2] == b"PK", "PPTX zip header missing"
        TestDocuments.created_ids.append(d["id"])

    def test_list_documents(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/documents", timeout=TIMEOUT_SHORT)
        assert r.status_code == 200
        d = r.json()
        assert "documents" in d and isinstance(d["documents"], list)
        # Created ones should appear; file_b64 should NOT be in list response
        for doc in d["documents"]:
            assert "file_b64" not in doc
        listed_ids = {doc["id"] for doc in d["documents"]}
        for cid in TestDocuments.created_ids:
            assert cid in listed_ids

    def test_get_single_document(self, api_client, base_url):
        assert TestDocuments.created_ids, "No created docs to fetch"
        doc_id = TestDocuments.created_ids[0]
        r = api_client.get(f"{base_url}/api/documents/{doc_id}", timeout=TIMEOUT_SHORT)
        assert r.status_code == 200
        d = r.json()
        assert d["id"] == doc_id
        assert "file_b64" in d and len(d["file_b64"]) > 100

    def test_delete_document(self, api_client, base_url):
        assert TestDocuments.created_ids, "Nothing to delete"
        # Delete all created
        for doc_id in list(TestDocuments.created_ids):
            r = api_client.delete(f"{base_url}/api/documents/{doc_id}", timeout=TIMEOUT_SHORT)
            assert r.status_code == 200
            assert r.json()["deleted"] == 1
            # Verify gone
            r2 = api_client.get(f"{base_url}/api/documents/{doc_id}", timeout=TIMEOUT_SHORT)
            assert r2.status_code == 404


# ---------- Watchlist ----------
class TestWatchlist:
    def test_default_watchlist(self, api_client, base_url):
        # Use a fresh user id so the default is returned
        uid = f"TEST_user_{uuid.uuid4().hex[:6]}"
        r = api_client.get(f"{base_url}/api/watchlist/{uid}", timeout=TIMEOUT_SHORT)
        assert r.status_code == 200
        d = r.json()
        assert set(d["symbols"]) >= {"AAPL", "TSLA", "NVDA", "MSFT", "GOOGL"}

    def test_put_and_get_watchlist(self, api_client, base_url):
        uid = "local-user"
        payload = {"user_id": uid, "symbols": ["AAPL", "AMZN"]}
        r = api_client.put(f"{base_url}/api/watchlist", json=payload, timeout=TIMEOUT_SHORT)
        assert r.status_code == 200
        d = r.json()
        assert d["symbols"] == ["AAPL", "AMZN"]
        # verify persistence
        r2 = api_client.get(f"{base_url}/api/watchlist/{uid}", timeout=TIMEOUT_SHORT)
        assert r2.status_code == 200
        assert r2.json()["symbols"] == ["AAPL", "AMZN"]


# ---------- TTS ----------
class TestTTS:
    def test_tts_basic(self, api_client, base_url):
        r = api_client.post(f"{base_url}/api/tts", json={"text": "hello"}, timeout=TIMEOUT_LONG)
        if r.status_code != 200:
            pytest.skip(f"TTS gateway not available (known limitation): {r.status_code} {r.text[:200]}")
        d = r.json()
        assert "audio_b64" in d
        raw = base64.b64decode(d["audio_b64"])
        assert len(raw) > 200
