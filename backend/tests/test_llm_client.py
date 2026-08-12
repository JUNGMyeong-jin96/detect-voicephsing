import json

import pytest

from app.llm_client import _extract_json


def test_extract_json_pure_json():
    assert _extract_json('{"success": true, "reason": "ok"}') == {"success": True, "reason": "ok"}


def test_extract_json_regex_fallback():
    text = '판정 결과입니다: {"success": false, "reason": "부족"} 이상입니다.'
    assert _extract_json(text) == {"success": False, "reason": "부족"}


def test_extract_json_unparseable_raises():
    with pytest.raises(json.JSONDecodeError):
        _extract_json("이건 JSON이 아닙니다.")
