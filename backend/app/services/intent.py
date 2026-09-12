"""
Fast, deterministic local intent gate.
Classifies user questions into TRADING_RESEARCH or IRRELEVANT without calling an LLM.

Rules:
1. Latency must be < 1ms (zero external calls, pure regex / set lookups).
2. Never reject legitimate trading research questions (fail-open on uncertainty).
3. Clearly irrelevant inputs (greetings, personal questions, general definitions, jokes)
   bypass the LLM and return concise, helpful guidance immediately.
"""

from __future__ import annotations

import re
from typing import Optional, Tuple

# Fast set of trading / financial domain keywords and roots
TRADING_KEYWORDS = {
    # Instruments & Markets
    "nifty", "banknifty", "sensex", "spx", "spy", "qqq", "stock", "stocks",
    "share", "shares", "equity", "equities", "index", "indices", "etf",
    "market", "markets", "futures", "options", "derivates", "derivative",
    
    # Actions & Strategy
    "buy", "buying", "bought", "sell", "selling", "sold", "short", "shorting",
    "long", "longing", "hold", "holding", "trade", "trading", "trader",
    "invest", "investing", "rebalance", "exit", "entry", "position",
    
    # Price movements & Events
    "crash", "fall", "dip", "drop", "dump", "plunge", "pullback", "drawdown",
    "rally", "surge", "gain", "bounce", "recovery", "recover", "jump",
    "gap", "gap-up", "gap-down", "high", "low", "ath", "all-time",
    
    # Statistical / Quantitative concepts
    "momentum", "volatility", "vol", "mean-reversion", "reversion", "trend",
    "return", "returns", "profit", "profitable", "loss", "alpha", "beta",
    "sharpe", "winrate", "win-rate", "edge", "outperform", "underperform",
    "consecutive", "streak", "overbought", "oversold", "breakout",
    "rsi", "sma", "ema", "macd", "indicator", "backtest", "test", "metric",
    "percentage", "percent", "%", "candle", "candlestick",
}

# Regex pattern for market regex matches (e.g. "2%", "5 days", "gap down", "down days", etc.)
TRADING_PATTERNS = [
    re.compile(r"\b\d+(\.\d+)?\s*%\b", re.IGNORECASE),
    re.compile(r"\b\d+\s*[- ]?(day|days|session|sessions|week|weeks|month|months|year|years)\b", re.IGNORECASE),
    re.compile(r"\b(up|down|positive|negative|red|green)\s+days?\b", re.IGNORECASE),
    re.compile(r"\b(all-time\s+high|52-week|moving\s+average|risk-reward)\b", re.IGNORECASE),
]

# Irrelevant query patterns with dedicated responses
GREETING_PATTERN = re.compile(
    r"^(hello|hi|hey|good\s+(morning|afternoon|evening|day)|greetings|howdy|sup|yo|hola)[\s!.,?]*$",
    re.IGNORECASE
)

PERSONAL_QUERY_PATTERNS = [
    (
        re.compile(r"\b(what\s+is\s+my\s+name|who\s+am\s+i|do\s+you\s+know\s+(my\s+name|me)|how\s+old\s+am\s+i)\b", re.IGNORECASE),
        "I don't have your name from this conversation. If you'd like to research a trading question, enter it above."
    ),
    (
        re.compile(r"\b(who\s+are\s+you|what\s+are\s+you|what\s+is\s+your\s+name|introduce\s+yourself)\b", re.IGNORECASE),
        "I'm an AI trading research assistant designed to turn market hypotheses into structured backtestable experiments."
    ),
]

JOKE_PATTERN = re.compile(
    r"\b(tell\s+(me\s+)?a\s+joke|make\s+me\s+laugh|say\s+something\s+funny|crack\s+a\s+joke)\b",
    re.IGNORECASE
)

GENERAL_KNOWLEDGE_PATTERNS = [
    (
        re.compile(r"\b(what\s+is\s+python|how\s+to\s+(code|program)\s+in\s+python|python\s+programming)\b", re.IGNORECASE),
        "I’m focused on turning trading questions into structured experiments. Try something like: “Does buying NIFTY after a 2% fall produce positive returns?”"
    ),
    (
        re.compile(r"\b(what\s+is\s+(the\s+meaning\s+of\s+life|the\s+capital\s+of|quantum|javascript|html|css|ai|chatgpt))\b", re.IGNORECASE),
        "I’m focused on turning trading questions into structured experiments. Try something like: “Does buying NIFTY after a 2% fall produce positive returns?”"
    ),
    (
        re.compile(r"\b(sing(\s+me)?\s+a\s+song|write\s+(me\s+)?a\s+poem|tell\s+(me\s+)?a\s+story|weather\s+today|recipe\s+for)\b", re.IGNORECASE),
        "I’m specialized in quantitative trading research rather than general creative tasks. Try asking a market research question!"
    ),
]


def has_trading_signals(text: str) -> bool:
    """Check if the text contains any recognizable financial/trading signals."""
    clean_text = text.lower()
    
    # Check regex patterns (e.g. "2%", "5 days", "negative days")
    for pattern in TRADING_PATTERNS:
        if pattern.search(clean_text):
            return True
            
    # Tokenize words and check trading keywords set
    words = re.findall(r"[a-z0-9%]+", clean_text)
    for word in words:
        if word in TRADING_KEYWORDS:
            return True
            
    return False


def check_intent(question: str) -> Tuple[bool, Optional[str]]:
    """
    Classify a user query fast and deterministically.
    
    Returns:
        (is_trading_research: bool, immediate_response: Optional[str])
        
    If is_trading_research is False, immediate_response contains a short, friendly message
    to display to the user without calling OpenRouter.
    If is_trading_research is True, immediate_response is None and the query enters the research pipeline.
    """
    q_stripped = question.strip()
    if not q_stripped:
        return False, "Please enter a trading research question."

    # First safety check: If there are clear trading/market keywords,
    # it ALWAYS proceeds to trading research (never block genuine research).
    if has_trading_signals(q_stripped):
        return True, None

    # Check for simple greeting
    if GREETING_PATTERN.match(q_stripped):
        return False, "Hi! I'm here to help turn trading research questions into testable experiments."

    # Check for joke / entertainment request
    if JOKE_PATTERN.search(q_stripped):
        return False, "I’m better at trading experiments than jokes 😄 Try asking me a market research question."

    # Check for personal / identity queries
    for pattern, response in PERSONAL_QUERY_PATTERNS:
        if pattern.search(q_stripped):
            return False, response

    # Check for general knowledge / programming queries
    for pattern, response in GENERAL_KNOWLEDGE_PATTERNS:
        if pattern.search(q_stripped):
            return False, response

    # Fail-open: If the question does not match any known non-research pattern,
    # we treat it as potentially research-related and let the research pipeline handle it.
    return True, None
