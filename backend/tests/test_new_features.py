"""
Backend tests for new features: fonts, world crisis/hotspots, DAGRCMD, Finnhub stocks.
Covers requested endpoints per iteration_2 review request.
"""
import re
import uuid
import pytest
import base64

TIMEOUT_SHORT = 30
TIMEOUT_LONG = 60


# ---------- Fonts ----------
class TestFonts:
    def test_ionicons_ttf(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/fonts/ionicons.ttf", timeout=TIMEOUT_SHORT)
        assert r.status_code == 200, r.text
        ctype = r.headers.get("content-type", "")
        assert "font/ttf" in ctype or "font" in ctype, f"unexpected content-type: {ctype}"
        # TTF magic 0x00010000 or "OTTO"/"true"; ionicons is typically ~389KB
        assert len(r.content) > 100_000, f"font too small: {len(r.content)} bytes"
        # First 4 bytes should be valid font signature
        sig = r.content[:4]
        assert sig in (b"\x00\x01\x00\x00", b"OTTO", b"true", b"typ1"), f"bad font sig: {sig!r}"


# ---------- World Crisis + Hotspots ----------
class TestWorldCrisis:
    def test_crisis_all(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/world/crisis",
                           params={"category": "all", "limit": 10}, timeout=TIMEOUT_SHORT)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "items" in d and isinstance(d["items"], list)
        assert d["category"] == "all"
        if not d["items"]:
            pytest.skip("Finnhub general news returned empty (3rd-party fallback acceptable)")
        # Items length should be <= limit
        assert len(d["items"]) <= 10
        valid_cats = {"MILITARY", "GUERRILLA", "UNREST", "CRISIS", "OTHER"}
        for it in d["items"]:
            assert "title" in it
            assert "category" in it and it["category"] in valid_cats
            assert "hotspots" in it and isinstance(it["hotspots"], list)

    def test_crisis_military(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/world/crisis",
                           params={"category": "military", "limit": 5}, timeout=TIMEOUT_SHORT)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["category"] == "military"
        # When filtering by military, items should all be MILITARY (if any present)
        for it in d["items"]:
            # spec: filter to military-only
            assert it["category"] == "MILITARY", f"Non-military item in military filter: {it.get('title')}"

    def test_hotspots(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/world/hotspots", timeout=TIMEOUT_SHORT)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "hotspots" in d and isinstance(d["hotspots"], list)
        assert len(d["hotspots"]) >= 20, f"expected 20+ hotspots, got {len(d['hotspots'])}"
        time_re = re.compile(r"^\d{2}:\d{2}$")
        offset_re = re.compile(r"^[+-]\d{2}:\d{2}$")
        weekday_re = re.compile(r"^[A-Z]{3}$")
        for h in d["hotspots"]:
            assert "name" in h and "region" in h
            assert time_re.match(h["local_time"]), f"bad local_time: {h.get('local_time')}"
            assert offset_re.match(h["offset"]), f"bad offset: {h.get('offset')}"
            assert weekday_re.match(h["weekday"]), f"bad weekday: {h.get('weekday')}"


# ---------- Stocks live (Finnhub) ----------
class TestStocksFinnhub:
    def test_quotes_live(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/stocks/quotes",
                           params={"symbols": "AAPL,TSLA,NVDA"}, timeout=TIMEOUT_SHORT)
        assert r.status_code == 200, r.text
        d = r.json()
        assert len(d["quotes"]) == 3
        live_count = 0
        for q in d["quotes"]:
            assert "price" in q and isinstance(q["price"], (int, float))
            assert "change_pct" in q
            assert "sparkline" in q and len(q["sparkline"]) > 0
            if q.get("is_live"):
                live_count += 1
                assert q["price"] > 0
        # Spec: Finnhub free tier should work → expect is_live=True for all 3
        assert live_count == 3, f"Expected 3 live quotes (Finnhub), got {live_count}/3"

    def test_intraday_points(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/stocks/intraday/AAPL", timeout=TIMEOUT_SHORT)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["symbol"] == "AAPL"
        assert isinstance(d["points"], list) and len(d["points"]) > 0
        for p in d["points"][:5]:
            assert "t" in p and "price" in p
            assert isinstance(p["price"], (int, float)) and p["price"] > 0


# ---------- DAGRCMD ----------
@pytest.fixture(scope="module")
def officer_alpha():
    return {
        "callsign": f"TEST_ALPHA_{uuid.uuid4().hex[:4].upper()}",
        "auth_code": "secret-alpha-123",
        "public_key": base64.b64encode(b"a" * 32).decode(),
    }


@pytest.fixture(scope="module")
def officer_bravo():
    return {
        "callsign": f"TEST_BRAVO_{uuid.uuid4().hex[:4].upper()}",
        "auth_code": "secret-bravo-456",
        "public_key": base64.b64encode(b"b" * 32).decode(),
    }


class TestDAGRCMD:
    state = {}

    def test_register_officer_alpha(self, api_client, base_url, officer_alpha):
        r = api_client.post(f"{base_url}/api/dagrcmd/officers/register",
                            json=officer_alpha, timeout=TIMEOUT_SHORT)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["callsign"] == officer_alpha["callsign"].upper()
        assert d["rotated"] is False

    def test_register_officer_bravo(self, api_client, base_url, officer_bravo):
        r = api_client.post(f"{base_url}/api/dagrcmd/officers/register",
                            json=officer_bravo, timeout=TIMEOUT_SHORT)
        assert r.status_code == 200, r.text
        assert r.json()["rotated"] is False

    def test_register_rotate_key(self, api_client, base_url, officer_alpha):
        rotated = {**officer_alpha,
                   "public_key": base64.b64encode(b"z" * 32).decode()}
        r = api_client.post(f"{base_url}/api/dagrcmd/officers/register",
                            json=rotated, timeout=TIMEOUT_SHORT)
        assert r.status_code == 200, r.text
        assert r.json()["rotated"] is True

    def test_register_conflict_bad_auth(self, api_client, base_url, officer_alpha):
        bad = {**officer_alpha, "auth_code": "WRONG_PASS_999"}
        r = api_client.post(f"{base_url}/api/dagrcmd/officers/register",
                            json=bad, timeout=TIMEOUT_SHORT)
        assert r.status_code == 409, f"expected 409 on conflicting auth, got {r.status_code}: {r.text}"

    def test_login_officer(self, api_client, base_url, officer_alpha):
        r = api_client.post(f"{base_url}/api/dagrcmd/officers/login",
                            json={"callsign": officer_alpha["callsign"],
                                  "auth_code": officer_alpha["auth_code"]},
                            timeout=TIMEOUT_SHORT)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["callsign"] == officer_alpha["callsign"].upper()
        assert "auth_hash" not in d, "auth_hash should NOT be exposed"
        assert "public_key" in d

    def test_login_bad_auth(self, api_client, base_url, officer_alpha):
        r = api_client.post(f"{base_url}/api/dagrcmd/officers/login",
                            json={"callsign": officer_alpha["callsign"],
                                  "auth_code": "wrong"},
                            timeout=TIMEOUT_SHORT)
        assert r.status_code == 401

    def test_list_officers_directory(self, api_client, base_url, officer_alpha, officer_bravo):
        callsigns = f"{officer_alpha['callsign']},{officer_bravo['callsign']}"
        r = api_client.get(f"{base_url}/api/dagrcmd/officers",
                           params={"callsigns": callsigns}, timeout=TIMEOUT_SHORT)
        assert r.status_code == 200
        d = r.json()
        names = {o["callsign"] for o in d["officers"]}
        assert officer_alpha["callsign"].upper() in names
        assert officer_bravo["callsign"].upper() in names
        for o in d["officers"]:
            assert "public_key" in o
            assert "auth_hash" not in o

    def test_create_channel(self, api_client, base_url, officer_alpha, officer_bravo):
        payload = {
            "name": "TEST_CMD_NET",
            "owner": officer_alpha["callsign"],
            "auth_code": officer_alpha["auth_code"],
            "members": [officer_bravo["callsign"]],
        }
        r = api_client.post(f"{base_url}/api/dagrcmd/channels",
                            json=payload, timeout=TIMEOUT_SHORT)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["name"] == "TEST_CMD_NET"
        assert d["owner"] == officer_alpha["callsign"].upper()
        assert officer_alpha["callsign"].upper() in d["members"]
        assert officer_bravo["callsign"].upper() in d["members"]
        # join_code: 6 hex chars
        assert re.match(r"^[0-9A-F]{6}$", d["join_code"]), f"bad join_code: {d['join_code']}"
        TestDAGRCMD.state["channel"] = d

    def test_list_channels_for_member(self, api_client, base_url, officer_alpha):
        cs = officer_alpha["callsign"].upper()
        r = api_client.get(f"{base_url}/api/dagrcmd/channels/{cs}", timeout=TIMEOUT_SHORT)
        assert r.status_code == 200
        d = r.json()
        chan_ids = {c["id"] for c in d["channels"]}
        assert TestDAGRCMD.state["channel"]["id"] in chan_ids

    def test_join_channel_bad_code(self, api_client, base_url, officer_bravo):
        r = api_client.post(f"{base_url}/api/dagrcmd/channels/join",
                            json={"callsign": officer_bravo["callsign"],
                                  "auth_code": officer_bravo["auth_code"],
                                  "join_code": "ZZZZZZ"},
                            timeout=TIMEOUT_SHORT)
        assert r.status_code == 404, r.text

    def test_join_channel_bad_auth(self, api_client, base_url, officer_bravo):
        code = TestDAGRCMD.state["channel"]["join_code"]
        r = api_client.post(f"{base_url}/api/dagrcmd/channels/join",
                            json={"callsign": officer_bravo["callsign"],
                                  "auth_code": "WRONG",
                                  "join_code": code},
                            timeout=TIMEOUT_SHORT)
        assert r.status_code == 401, r.text

    def test_send_message_and_retrieve(self, api_client, base_url,
                                       officer_alpha, officer_bravo):
        chan = TestDAGRCMD.state["channel"]
        alpha_cs = officer_alpha["callsign"].upper()
        bravo_cs = officer_bravo["callsign"].upper()
        msg = {
            "channel_id": chan["id"],
            "sender": alpha_cs,
            "sender_pubkey": officer_alpha["public_key"],
            "kind": "text",
            "ciphertexts": {
                alpha_cs: {"ct": "CIPHER_FOR_ALPHA", "nonce": "NONCE_A"},
                bravo_cs: {"ct": "CIPHER_FOR_BRAVO", "nonce": "NONCE_B"},
            },
        }
        r = api_client.post(f"{base_url}/api/dagrcmd/messages",
                            json=msg, timeout=TIMEOUT_SHORT)
        assert r.status_code == 200, r.text
        sent = r.json()
        assert sent["sender"] == alpha_cs
        assert "id" in sent
        # Retrieve as bravo
        r2 = api_client.get(f"{base_url}/api/dagrcmd/messages/{chan['id']}",
                            params={"callsign": bravo_cs}, timeout=TIMEOUT_SHORT)
        assert r2.status_code == 200, r2.text
        d2 = r2.json()
        assert "messages" in d2 and len(d2["messages"]) >= 1
        # Last msg should have ciphertext_for_me populated for bravo
        last = d2["messages"][-1]
        assert last["ciphertext_for_me"] is not None
        assert last["ciphertext_for_me"]["ct"] == "CIPHER_FOR_BRAVO"
        assert last["ciphertext_for_me"]["nonce"] == "NONCE_B"
        # Retrieve as alpha (sender)
        r3 = api_client.get(f"{base_url}/api/dagrcmd/messages/{chan['id']}",
                            params={"callsign": alpha_cs}, timeout=TIMEOUT_SHORT)
        assert r3.status_code == 200
        d3 = r3.json()
        assert len(d3["messages"]) >= 1
        last_a = d3["messages"][-1]
        assert last_a["ciphertext_for_me"]["ct"] == "CIPHER_FOR_ALPHA"

    def test_message_non_member_forbidden(self, api_client, base_url):
        chan = TestDAGRCMD.state["channel"]
        r = api_client.get(f"{base_url}/api/dagrcmd/messages/{chan['id']}",
                           params={"callsign": "NOT_A_MEMBER_XYZ"},
                           timeout=TIMEOUT_SHORT)
        assert r.status_code == 403, r.text

    def test_cleanup(self, api_client, base_url, officer_alpha, officer_bravo):
        """Best-effort cleanup of TEST_ data via Mongo isn't exposed; relies on prefix isolation."""
        # No DELETE endpoint exposed; rely on TEST_ prefix for isolation
        assert True
