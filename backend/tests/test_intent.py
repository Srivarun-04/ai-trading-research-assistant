import time
import pytest
from app.services.intent import check_intent, has_trading_signals


def test_case_1_normal_ambiguous_question():
    """Case 1: Does buying NIFTY after a sharp fall work?"""
    q = "Does buying NIFTY after a sharp fall work?"
    is_research, msg = check_intent(q)
    assert is_research is True
    assert msg is None


def test_case_2_specific_question():
    """Case 2: Does buying NIFTY after a 2% one-day fall and holding for 5 days generate positive returns?"""
    q = "Does buying NIFTY after a 2% one-day fall and holding for 5 days generate positive returns?"
    is_research, msg = check_intent(q)
    assert is_research is True
    assert msg is None


def test_case_3_ambiguous_research_question():
    """Case 3: Is buying after a crash profitable?"""
    q = "Is buying after a crash profitable?"
    is_research, msg = check_intent(q)
    assert is_research is True
    assert msg is None


def test_case_4_greeting():
    """Case 4: Hello"""
    q = "Hello"
    is_research, msg = check_intent(q)
    assert is_research is False
    assert "Hi!" in msg
    assert "testable experiments" in msg


def test_case_5_personal_question():
    """Case 5: What is my name?"""
    q = "What is my name?"
    is_research, msg = check_intent(q)
    assert is_research is False
    assert "don't have your name" in msg.lower()


def test_case_6_general_knowledge():
    """Case 6: What is Python?"""
    q = "What is Python?"
    is_research, msg = check_intent(q)
    assert is_research is False
    assert "structured experiments" in msg.lower()


def test_case_7_joke():
    """Case 7: Tell me a joke."""
    q = "Tell me a joke."
    is_research, msg = check_intent(q)
    assert is_research is False
    assert "jokes" in msg.lower()


def test_case_8_unusual_research_question():
    """Case 8: Does NIFTY perform differently after three consecutive negative days?"""
    q = "Does NIFTY perform differently after three consecutive negative days?"
    is_research, msg = check_intent(q)
    assert is_research is True
    assert msg is None


def test_additional_unusual_research_questions():
    questions = [
        "Does the market recover after three consecutive down days?",
        "Is there an edge to buying after high volatility?",
        "What happens if I buy NIFTY after a 5% fall?",
        "Does momentum work better during low volatility?",
        "Is there a Monday effect in NIFTY returns?",
    ]
    for q in questions:
        is_research, msg = check_intent(q)
        assert is_research is True, f"Failed for query: {q}"
        assert msg is None


def test_additional_irrelevant_questions():
    queries = [
        ("hi", "Hi!"),
        ("hey", "Hi!"),
        ("good morning", "Hi!"),
        ("who are you?", "trading research assistant"),
        ("make me laugh", "jokes"),
    ]
    for q, expected_snippet in queries:
        is_research, msg = check_intent(q)
        assert is_research is False, f"Should be classified as irrelevant: {q}"
        assert expected_snippet.lower() in msg.lower()


def test_latency_is_negligible():
    """Intent gate must run in sub-millisecond time (< 1ms per query)."""
    q = "Does buying NIFTY after a 2% one-day fall and holding for 5 days generate positive returns?"
    
    # Warmup
    check_intent(q)
    
    # 1,000 iterations
    t0 = time.perf_counter()
    for _ in range(1000):
        check_intent(q)
    t1 = time.perf_counter()
    
    avg_duration_ms = ((t1 - t0) / 1000.0) * 1000.0
    print(f"Average intent check duration: {avg_duration_ms:.4f} ms")
    assert avg_duration_ms < 1.0  # Must be well under 1ms
