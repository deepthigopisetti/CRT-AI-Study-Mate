from services.ai_service import call_ai


def test_call_ai_returns_fallback_when_ollama_unavailable(monkeypatch):
    def fake_call_ollama(prompt):
        return None

    monkeypatch.setattr("services.ai_service.call_ollama_api", fake_call_ollama)
    assert call_ai("hello") is None
