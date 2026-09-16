import asyncio
import logging
import re
import tempfile
import time
import wave
from pathlib import Path

import httpx

from app.config import Settings
from app.services.podcast import ScriptLine

logger = logging.getLogger(__name__)

_MAX_RETRIES = 5
_GOOGLE_TTS_CONCURRENCY = 3  # max parallel requests; raise on paid plan
_GOOGLE_TTS_RATE_LIMIT_BACKOFF = 35  # seconds to wait after a 429


async def synthesize_lines(lines: list[ScriptLine], settings: Settings) -> list[Path]:
    """Synthesize each script line to a WAV/MP3 file via the configured TTS provider."""
    if settings.tts_provider == "inworld":
        voice_map = {
            "Alex": settings.inworld_tts_voice_male,
            "Jordan": settings.inworld_tts_voice_female,
        }
        tasks = [
            asyncio.to_thread(
                _synthesize_inworld, line, voice_map, i,
                settings.inworld_api_key, settings.inworld_tts_model,
            )
            for i, line in enumerate(lines)
        ]
        return list(await asyncio.gather(*tasks))
    if settings.tts_provider == "google":
        voice_map = {
            "Alex": settings.google_tts_voice_male,
            "Jordan": settings.google_tts_voice_female,
        }
        sem = asyncio.Semaphore(_GOOGLE_TTS_CONCURRENCY)

        async def _run(i: int, line: ScriptLine) -> Path:
            async with sem:
                return await asyncio.to_thread(
                    _synthesize_google,
                    line,
                    voice_map,
                    i,
                    settings.gemini_api_key,
                    settings.google_tts_model,
                )

        return list(await asyncio.gather(*[_run(i, line) for i, line in enumerate(lines)]))
    raise ValueError(f"Unknown TTS provider: {settings.tts_provider!r}")


def _synthesize_google(
    line: ScriptLine,
    voice_map: dict[str, str],
    index: int,
    api_key: str,
    model: str,
) -> Path:
    """Synthesize a single line with Google Gemini TTS."""
    from google import genai
    from google.genai import types

    voice = voice_map.get(line["speaker"], voice_map["Alex"])
    tmp_file = tempfile.NamedTemporaryFile(suffix=".wav", prefix=f"tts_{index:03d}_", delete=False)
    tmp_file.close()
    tmp = Path(tmp_file.name)
    client = genai.Client(api_key=api_key)

    for attempt in range(1, _MAX_RETRIES + 1):
        try:
            response = client.models.generate_content(
                model=model,
                contents=line["text"],
                config=types.GenerateContentConfig(
                    response_modalities=["AUDIO"],
                    speech_config=types.SpeechConfig(
                        voice_config=types.VoiceConfig(
                            prebuilt_voice_config=types.PrebuiltVoiceConfig(
                                voice_name=voice
                            )
                        )
                    ),
                ),
            )
            pcm_data = response.candidates[0].content.parts[0].inline_data.data
            _write_wav(pcm_data, tmp)
            logger.debug("Google TTS line %d done (attempt %d)", index, attempt)
            return tmp
        except Exception as e:
            logger.warning("Google TTS line %d attempt %d failed", index, attempt, exc_info=True)
            if attempt == _MAX_RETRIES:
                raise
            if getattr(e, "code", None) == 429:
                logger.info("Google TTS rate limited, backing off %ds", _GOOGLE_TTS_RATE_LIMIT_BACKOFF)
                time.sleep(_GOOGLE_TTS_RATE_LIMIT_BACKOFF)

    raise RuntimeError("unreachable")


_INWORLD_MAX_CHARS = 2000


def _inworld_request(text: str, voice: str, model: str, api_key: str) -> bytes:
    """Single Inworld TTS request; returns MP3 bytes."""
    import base64

    resp = httpx.post(
        "https://api.inworld.ai/tts/v1/voice",
        headers={"Authorization": f"Basic {api_key}", "Content-Type": "application/json"},
        json={"text": text, "voiceId": voice, "modelId": model},
        timeout=60,
    )
    resp.raise_for_status()
    return base64.b64decode(resp.json()["audioContent"])


def _split_text(text: str, max_len: int) -> list[str]:
    """Split text into chunks no longer than max_len, breaking at sentence boundaries."""
    if len(text) <= max_len:
        return [text]
    chunks, current = [], ""
    for sentence in re.split(r"(?<=[.!?])\s+", text):
        if len(current) + len(sentence) + 1 > max_len:
            if current:
                chunks.append(current.strip())
            current = sentence
        else:
            current = f"{current} {sentence}" if current else sentence
    if current:
        chunks.append(current.strip())
    return chunks


def _synthesize_inworld(
    line: ScriptLine,
    voice_map: dict[str, str],
    index: int,
    api_key: str,
    model: str,
) -> Path:
    """Synthesize a single line with Inworld TTS (direct API).

    Splits text exceeding 2000 chars into sentence-boundary chunks and
    concatenates the resulting PCM data into a single WAV file.
    """
    voice = voice_map.get(line["speaker"], voice_map["Alex"])
    tmp_file = tempfile.NamedTemporaryFile(suffix=".mp3", prefix=f"tts_{index:03d}_", delete=False)
    tmp_file.close()
    tmp = Path(tmp_file.name)
    chunks = _split_text(line["text"], _INWORLD_MAX_CHARS)

    for attempt in range(1, _MAX_RETRIES + 1):
        try:
            mp3_parts = [_inworld_request(chunk, voice, model, api_key) for chunk in chunks]
            tmp.write_bytes(b"".join(mp3_parts))
            logger.debug("Inworld TTS line %d done (%d chunk(s), attempt %d)", index, len(chunks), attempt)
            return tmp
        except Exception as e:
            logger.warning("Inworld TTS line %d attempt %d failed", index, attempt, exc_info=True)
            if attempt == _MAX_RETRIES:
                raise
            if getattr(e, "response", None) is not None and getattr(e.response, "status_code", None) == 429:
                logger.info("Inworld TTS rate limited, backing off %ds", _GOOGLE_TTS_RATE_LIMIT_BACKOFF)
                time.sleep(_GOOGLE_TTS_RATE_LIMIT_BACKOFF)

    raise RuntimeError("unreachable")


def _write_wav(pcm_data: bytes, path: Path, sample_rate: int = 24000) -> None:
    """Write raw 16-bit mono PCM data as a WAV file."""
    with wave.open(str(path), "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(pcm_data)
