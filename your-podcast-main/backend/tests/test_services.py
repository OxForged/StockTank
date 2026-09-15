"""Tests for Phase 5 service layer.

All external APIs (feedparser, Gemini, Podcastfy, TTS providers, boto3, pydub)
are mocked so tests run offline without credentials.
"""

import tempfile
import textwrap
from pathlib import Path
from unittest.mock import MagicMock, patch, call
from types import SimpleNamespace

import feedparser
import pytest

from app.config import Settings
from app.services.rss import Article, fetch_articles, _parse_feed
from app.services.llm.prompts import filter_articles, generate_keywords, generate_title
from app.services.podcast import _parse_transcript, generate_script, ScriptLine
from app.services.tts import synthesize_lines
from app.services.audio import merge_audio, _merge
from app.services.cover import generate_cover_url, generate_cover
from app.services.storage import upload_to_r2, _upload


# -- Helpers --

def _make_article(i: int, url: str | None = None) -> Article:
    return Article(
        title=f"Article {i}",
        url=url or f"https://example.com/article-{i}",
        summary=f"Summary of article {i}",
        source="Test Feed",
        published="2026-03-01T00:00:00+00:00",
    )


def _test_settings(**overrides) -> Settings:
    defaults = dict(
        cloudflare_account_id="test",
        cloudflare_api_token="test",
        d1_database_id="test",
        session_secret="test",
        r2_account_id="fake-account",
        r2_access_key_id="fake-key",
        r2_secret_access_key="fake-secret",
        r2_bucket_name="fake-bucket",
        r2_public_url="https://cdn.example.com",
    )
    defaults.update(overrides)
    return Settings(**defaults)


# ================================================================
# RSS Service
# ================================================================

class TestRSS:
    def test_parse_feed_returns_articles(self):
        """_parse_feed extracts entries from a valid feed."""
        entry = feedparser.FeedParserDict(
            title="Test Article",
            link="https://example.com/1",
            summary="A summary",
            published_parsed=(2026, 3, 1, 12, 0, 0, 0, 0, 0),
        )
        mock_feed = SimpleNamespace(
            bozo=False,
            entries=[entry],
            feed={"title": "My Feed"},
        )
        with patch("app.services.rss.feedparser.parse", return_value=mock_feed):
            articles = _parse_feed("https://feed.example.com/rss")

        assert len(articles) == 1
        assert articles[0]["title"] == "Test Article"
        assert articles[0]["url"] == "https://example.com/1"
        assert articles[0]["source"] == "My Feed"
        assert "2026-03-01" in articles[0]["published"]

    def test_parse_feed_bozo_with_no_entries_raises(self):
        """_parse_feed raises on a broken feed with no entries."""
        mock_feed = SimpleNamespace(bozo=True, entries=[], feed={})
        with patch("app.services.rss.feedparser.parse", return_value=mock_feed):
            with pytest.raises(RuntimeError, match="Failed to parse feed"):
                _parse_feed("https://bad-feed.example.com")

    def test_parse_feed_bozo_with_entries_ok(self):
        """_parse_feed tolerates bozo=True if entries exist."""
        entry = feedparser.FeedParserDict(title="OK", link="https://x.com/1", summary="")
        mock_feed = SimpleNamespace(
            bozo=True,
            entries=[entry],
            feed={"title": "Feed"},
        )
        with patch("app.services.rss.feedparser.parse", return_value=mock_feed):
            articles = _parse_feed("https://feed.example.com")
        assert len(articles) == 1

    def test_parse_feed_missing_published(self):
        """_parse_feed handles entries without published_parsed."""
        entry = feedparser.FeedParserDict(title="No Date", link="https://x.com/1", summary="")
        mock_feed = SimpleNamespace(
            bozo=False,
            entries=[entry],
            feed={"title": "Feed"},
        )
        with patch("app.services.rss.feedparser.parse", return_value=mock_feed):
            articles = _parse_feed("https://feed.example.com")
        assert articles[0]["published"] == ""

    @pytest.mark.anyio
    async def test_fetch_articles_deduplicates(self):
        """fetch_articles deduplicates articles by URL across feeds."""
        feed1 = [_make_article(1, "https://example.com/same")]
        feed2 = [_make_article(2, "https://example.com/same"), _make_article(3)]

        with patch("app.services.rss._parse_feed", side_effect=[feed1, feed2]):
            articles = await fetch_articles(["url1", "url2"])

        assert len(articles) == 2
        urls = [a["url"] for a in articles]
        assert "https://example.com/same" in urls
        assert "https://example.com/article-3" in urls

    @pytest.mark.anyio
    async def test_fetch_articles_skips_broken_feed(self):
        """fetch_articles logs warning and continues on feed failure."""
        good_articles = [_make_article(1)]

        with patch(
            "app.services.rss._parse_feed",
            side_effect=[RuntimeError("broken"), good_articles],
        ):
            articles = await fetch_articles(["bad-url", "good-url"])

        assert len(articles) == 1
        assert articles[0]["title"] == "Article 1"

    @pytest.mark.anyio
    async def test_fetch_articles_empty_urls(self):
        """fetch_articles returns empty list for no URLs."""
        articles = await fetch_articles([])
        assert articles == []


# ================================================================
# LLM Filtering (via prompts.py)
# ================================================================

def _mock_llm_client(return_value: str) -> MagicMock:
    """Create a mock LLMClient that returns the given string from chat()."""
    client = MagicMock()
    client.chat.return_value = return_value
    return client


class TestLLMAdapters:
    def test_zhipu_client_importable(self):
        """ZhipuClient can be imported from the llm package."""
        from app.services.llm import ZhipuClient
        assert ZhipuClient is not None

    def test_gemini_client_importable(self):
        """GeminiClient can be imported from the llm package."""
        from app.services.llm import GeminiClient
        assert GeminiClient is not None

    def test_get_llm_client_missing_key_returns_none(self):
        """get_llm_client returns None when API key is missing."""
        from app.services.llm import get_llm_client
        settings = _test_settings(llm_provider_filter="zhipu", zhipu_api_key="")
        assert get_llm_client(settings, "filter") is None

    @pytest.mark.anyio
    async def test_filter_no_client_falls_back(self):
        """filter_articles with None client returns first N articles."""
        articles = [_make_article(i) for i in range(10)]
        result = await filter_articles(articles, ["AI"], None)
        assert len(result) == 8


class TestLLMFilter:
    @pytest.mark.anyio
    async def test_filter_empty_articles(self):
        client = _mock_llm_client("[]")
        result = await filter_articles([], ["AI"], client)
        assert result == []

    @pytest.mark.anyio
    async def test_filter_success(self):
        """LLM returns selected indices, we get those articles back."""
        articles = [_make_article(i) for i in range(5)]
        client = _mock_llm_client("[1, 3]")
        result = await filter_articles(articles, ["AI"], client)

        assert len(result) == 2
        assert result[0]["title"] == "Article 1"
        assert result[1]["title"] == "Article 3"

    @pytest.mark.anyio
    async def test_filter_with_code_fences(self):
        """Response wrapped in markdown code fences is parsed correctly."""
        articles = [_make_article(i) for i in range(5)]
        client = _mock_llm_client("```json\n[0, 2, 4]\n```")
        result = await filter_articles(articles, ["AI"], client)

        assert len(result) == 3

    @pytest.mark.anyio
    async def test_filter_failure_falls_back(self):
        """On LLM error, falls back to first 8 articles."""
        articles = [_make_article(i) for i in range(10)]
        client = MagicMock()
        client.chat.side_effect = RuntimeError("API error")
        result = await filter_articles(articles, ["AI"], client)

        assert len(result) == 8

    @pytest.mark.anyio
    async def test_filter_invalid_indices_ignored(self):
        """Out-of-range indices are silently ignored."""
        articles = [_make_article(i) for i in range(3)]
        client = _mock_llm_client("[0, 99, -1, 2]")
        result = await filter_articles(articles, ["AI"], client)

        assert len(result) == 2
        assert result[0]["title"] == "Article 0"
        assert result[1]["title"] == "Article 2"


# ================================================================
# LLM Keywords
# ================================================================

class TestGenerateKeywords:
    @pytest.mark.anyio
    async def test_empty_transcript_returns_empty(self):
        client = _mock_llm_client("[]")
        result = await generate_keywords([], client)
        assert result == []

    @pytest.mark.anyio
    async def test_success(self):
        client = _mock_llm_client('["AI", "Gaming", "Privacy"]')
        result = await generate_keywords(
            [{"speaker": "Alex", "text": "AI is changing gaming and privacy"}],
            client,
        )

        assert result == ["AI", "Gaming", "Privacy"]

    @pytest.mark.anyio
    async def test_code_fence_stripping(self):
        client = _mock_llm_client('```json\n["AI", "Tech"]\n```')
        result = await generate_keywords(
            [{"speaker": "Alex", "text": "test"}], client
        )

        assert result == ["AI", "Tech"]

    @pytest.mark.anyio
    async def test_failure_returns_empty(self):
        client = MagicMock()
        client.chat.side_effect = RuntimeError("fail")
        result = await generate_keywords(
            [{"speaker": "Alex", "text": "test"}], client
        )
        assert result == []

    @pytest.mark.anyio
    async def test_max_3_keywords(self):
        client = _mock_llm_client('["A", "B", "C", "D", "E"]')
        result = await generate_keywords(
            [{"speaker": "Alex", "text": "test"}], client
        )

        assert len(result) == 3

    @pytest.mark.anyio
    async def test_non_list_json_returns_empty(self):
        client = _mock_llm_client('{"keywords": ["AI"]}')
        result = await generate_keywords(
            [{"speaker": "Alex", "text": "test"}], client
        )

        assert result == []


# ================================================================
# LLM Title
# ================================================================

class TestGenerateTitle:
    @pytest.mark.anyio
    async def test_empty_transcript_returns_empty(self):
        client = _mock_llm_client("")
        result = await generate_title([], client)
        assert result == ""

    @pytest.mark.anyio
    async def test_success(self):
        client = _mock_llm_client("AI Revolution: What's Next")
        result = await generate_title(
            [{"speaker": "Alex", "text": "AI is changing everything"}],
            client,
        )

        assert result == "AI Revolution: What's Next"

    @pytest.mark.anyio
    async def test_strips_quotes(self):
        client = _mock_llm_client('"AI Revolution"')
        result = await generate_title(
            [{"speaker": "Alex", "text": "test"}], client
        )

        assert result == "AI Revolution"

    @pytest.mark.anyio
    async def test_code_fence_stripping(self):
        client = _mock_llm_client("```\nThe AI Episode\n```")
        result = await generate_title(
            [{"speaker": "Alex", "text": "test"}], client
        )

        assert result == "The AI Episode"

    @pytest.mark.anyio
    async def test_failure_returns_empty(self):
        client = MagicMock()
        client.chat.side_effect = RuntimeError("fail")
        result = await generate_title(
            [{"speaker": "Alex", "text": "test"}], client
        )
        assert result == ""


# ================================================================
# Podcast Script (Podcastfy)
# ================================================================

class TestPodcast:
    def test_parse_transcript_basic(self):
        """Parse Podcastfy XML tags into ScriptLines."""
        text = textwrap.dedent("""\
            <Person1>Hello, welcome to the show</Person1>
            <Person2>Let's talk about tech news</Person2>
            <Person1>The first topic is AI</Person1>
        """)
        lines = _parse_transcript(text)
        assert len(lines) == 3
        assert lines[0] == ScriptLine(speaker="Alex", text="Hello, welcome to the show")
        assert lines[1] == ScriptLine(speaker="Jordan", text="Let's talk about tech news")
        assert lines[2] == ScriptLine(speaker="Alex", text="The first topic is AI")

    def test_parse_transcript_multiline_content(self):
        """Tags with multiline content are parsed correctly."""
        text = "<Person1>Line one\nLine two\nLine three</Person1>"
        lines = _parse_transcript(text)
        assert len(lines) == 1
        assert "Line one\nLine two\nLine three" in lines[0]["text"]

    def test_parse_transcript_empty_tags_skipped(self):
        """Empty tags produce no ScriptLines."""
        text = "<Person1></Person1>\n<Person2>Has content</Person2>"
        lines = _parse_transcript(text)
        assert len(lines) == 1
        assert lines[0]["speaker"] == "Jordan"

    def test_parse_transcript_empty_input(self):
        lines = _parse_transcript("")
        assert lines == []

    @pytest.mark.anyio
    async def test_generate_script_empty_articles(self):
        result = await generate_script([], "key")
        assert result == []

    @pytest.mark.anyio
    async def test_generate_script_no_urls(self):
        """Articles without URLs return empty."""
        articles = [Article(title="No URL", url="", summary="x", source="x", published="")]
        result = await generate_script(articles, "key")
        assert result == []

    @pytest.mark.anyio
    async def test_generate_script_calls_podcastfy(self, tmp_path):
        """generate_script calls Podcastfy and parses the result."""
        transcript_file = tmp_path / "transcript.txt"
        transcript_file.write_text(
            "<Person1>Hello</Person1>\n<Person2>Hi there</Person2>",
            encoding="utf-8",
        )

        articles = [_make_article(1)]

        with patch(
            "app.services.podcast._generate_transcript",
            return_value=str(transcript_file),
        ):
            lines = await generate_script(articles, "fake-key")

        assert len(lines) == 2
        assert lines[0]["speaker"] == "Alex"
        assert lines[1]["speaker"] == "Jordan"

    @pytest.mark.anyio
    async def test_generate_script_podcastfy_failure(self):
        """If Podcastfy fails, returns empty list."""
        articles = [_make_article(1)]
        with patch("app.services.podcast._generate_transcript", return_value=None):
            lines = await generate_script(articles, "fake-key")
        assert lines == []


# ================================================================
# TTS Synthesis
# ================================================================

class TestTTS:
    @pytest.mark.anyio
    async def test_synthesize_lines_inworld(self):
        """synthesize_lines with inworld provider calls _synthesize_inworld for each line."""
        settings = _test_settings(tts_provider="inworld", inworld_api_key="fake-key")
        lines = [
            ScriptLine(speaker="Alex", text="Hello"),
            ScriptLine(speaker="Jordan", text="Hi there"),
        ]

        with patch("app.services.tts._synthesize_inworld", return_value=Path("/tmp/tts.wav")) as mock_synth:
            paths = await synthesize_lines(lines, settings)

        assert len(paths) == 2

    @pytest.mark.anyio
    async def test_synthesize_lines_google(self):
        """synthesize_lines with google provider calls _synthesize_google for each line."""
        settings = _test_settings(tts_provider="google", gemini_api_key="fake-key")
        lines = [
            ScriptLine(speaker="Alex", text="Hello"),
            ScriptLine(speaker="Jordan", text="Hi there"),
        ]

        with patch("app.services.tts._synthesize_google", return_value=Path("/tmp/tts.wav")) as mock_synth:
            paths = await synthesize_lines(lines, settings)

        assert len(paths) == 2


# ================================================================
# Audio Merging
# ================================================================

class TestAudio:
    def test_merge_concatenates_segments(self):
        """_merge concatenates AudioSegments and exports MP3."""
        seg1 = MagicMock(spec=["__len__", "__add__", "__radd__"])
        seg1.__len__ = lambda self: 5000  # 5 seconds in ms
        seg2 = MagicMock(spec=["__len__", "__add__", "__radd__"])
        seg2.__len__ = lambda self: 3000

        combined = MagicMock()
        combined.__len__ = lambda self: 8000
        combined.export = MagicMock()

        # Mock for re-reading the exported MP3 to get accurate duration
        exported = MagicMock()
        exported.__len__ = lambda self: 8000

        with patch("app.services.audio.AudioSegment") as MockAudioSegment:
            empty = MagicMock()
            empty.__add__ = MagicMock(return_value=combined)
            empty.__iadd__ = MagicMock(return_value=combined)
            combined.__iadd__ = MagicMock(return_value=combined)

            MockAudioSegment.empty.return_value = empty
            # seg1, seg2 for input files; exported for re-reading the MP3
            MockAudioSegment.from_file.side_effect = [seg1, seg2, exported]

            path, duration = _merge([Path("/tmp/a.wav"), Path("/tmp/b.wav")])

        assert duration == 8
        assert str(path).endswith(".mp3")
        combined.export.assert_called_once()

    @pytest.mark.anyio
    async def test_merge_audio_async(self):
        """merge_audio wraps _merge in asyncio.to_thread."""
        with patch("app.services.audio._merge", return_value=(Path("/tmp/out.mp3"), 10)):
            path, duration = await merge_audio([Path("/tmp/a.wav")])
        assert duration == 10


# ================================================================
# Cover Image
# ================================================================

class TestCover:
    def test_generate_cover_url_format(self):
        url = generate_cover_url("Test Episode")
        assert url.startswith("https://placehold.co/800x800/")
        assert ".png?text=" in url
        assert "Test%20Episode" in url

    def test_generate_cover_url_deterministic(self):
        """Same title always produces the same URL."""
        url1 = generate_cover_url("AI News Daily")
        url2 = generate_cover_url("AI News Daily")
        assert url1 == url2

    def test_generate_cover_url_different_titles(self):
        """Different titles produce different URLs (most of the time)."""
        url1 = generate_cover_url("Title A")
        url2 = generate_cover_url("Title B")
        assert url1 != url2

    def test_generate_cover_url_truncates_long_title(self):
        """Titles longer than 20 chars are truncated in the URL."""
        url = generate_cover_url("A" * 50)
        # The text param should have at most 20 chars (URL-encoded)
        text_part = url.split("?text=")[1]
        assert len(text_part) <= 20

    def test_generate_cover_url_valid_gradient(self):
        """URL contains a valid hex color pair."""
        from app.services.cover import _GRADIENTS
        url = generate_cover_url("Anything")
        # Extract the color portion: /800x800/{bg}/{fg}.png
        parts = url.split("/")
        bg = parts[4]  # after 800x800
        fg = parts[5].split(".")[0]
        all_colors = {c for pair in _GRADIENTS for c in pair}
        assert bg in all_colors
        assert fg in all_colors

    @pytest.mark.anyio
    async def test_generate_cover_no_credentials(self):
        """generate_cover returns None when no API credentials are set."""
        settings = _test_settings(vertex_project_id="", gemini_api_key="")
        result = await generate_cover("Test", ["AI"], settings)
        assert result is None

    @pytest.mark.anyio
    async def test_generate_cover_success(self):
        """generate_cover returns a Path on success."""
        settings = _test_settings(gemini_api_key="fake-key")

        mock_part = MagicMock()
        mock_part.inline_data = MagicMock()
        mock_part.inline_data.data = b"fake-png-data"

        mock_content = MagicMock()
        mock_content.parts = [mock_part]

        mock_candidate = MagicMock()
        mock_candidate.content = mock_content

        mock_response = MagicMock()
        mock_response.candidates = [mock_candidate]

        mock_client = MagicMock()
        mock_client.models.generate_content.return_value = mock_response

        with patch("app.services.cover.genai.Client", return_value=mock_client):
            result = await generate_cover("Test Episode", ["AI"], settings)

        assert result is not None
        assert result.suffix == ".png"
        # Clean up
        result.unlink(missing_ok=True)

    @pytest.mark.anyio
    async def test_generate_cover_failure_returns_none(self):
        """generate_cover returns None on API failure."""
        settings = _test_settings(gemini_api_key="fake-key")

        with patch("app.services.cover.genai.Client", side_effect=RuntimeError("fail")):
            result = await generate_cover("Test", ["AI"], settings)

        assert result is None

    @pytest.mark.anyio
    async def test_generate_cover_no_image_in_response(self):
        """generate_cover returns None when response has no images."""
        settings = _test_settings(gemini_api_key="fake-key")

        mock_response = MagicMock()
        mock_response.candidates = []

        mock_client = MagicMock()
        mock_client.models.generate_content.return_value = mock_response

        with patch("app.services.cover.genai.Client", return_value=mock_client):
            result = await generate_cover("Test", ["AI"], settings)

        assert result is None


# ================================================================
# R2 Storage
# ================================================================

class TestStorage:
    def test_upload_builds_correct_url(self, tmp_path):
        """_upload calls boto3 with correct R2 settings and returns public URL."""
        test_file = tmp_path / "test.mp3"
        test_file.write_bytes(b"fake audio")
        settings = _test_settings()

        mock_client = MagicMock()
        with patch("app.services.storage.boto3.client", return_value=mock_client) as mock_boto:
            url = _upload(test_file, "episodes/test.mp3", settings, "audio/mpeg")

        mock_boto.assert_called_once_with(
            "s3",
            endpoint_url="https://fake-account.r2.cloudflarestorage.com",
            aws_access_key_id="fake-key",
            aws_secret_access_key="fake-secret",
            region_name="auto",
        )
        mock_client.upload_file.assert_called_once_with(
            str(test_file),
            "fake-bucket",
            "episodes/test.mp3",
            ExtraArgs={"ContentType": "audio/mpeg"},
        )
        assert url == "https://cdn.example.com/episodes/test.mp3"

    @pytest.mark.anyio
    async def test_upload_to_r2_async(self, tmp_path):
        """upload_to_r2 wraps _upload in asyncio.to_thread."""
        test_file = tmp_path / "test.mp3"
        test_file.write_bytes(b"fake")
        settings = _test_settings()

        with patch(
            "app.services.storage._upload",
            return_value="https://cdn.example.com/episodes/test.mp3",
        ):
            url = await upload_to_r2(test_file, "episodes/test.mp3", settings)
        assert url == "https://cdn.example.com/episodes/test.mp3"

    def test_upload_custom_content_type(self, tmp_path):
        """_upload passes custom content type to S3."""
        test_file = tmp_path / "cover.png"
        test_file.write_bytes(b"fake image")
        settings = _test_settings()

        mock_client = MagicMock()
        with patch("app.services.storage.boto3.client", return_value=mock_client):
            _upload(test_file, "covers/img.png", settings, "image/png")

        mock_client.upload_file.assert_called_once()
        args = mock_client.upload_file.call_args
        assert args[1]["ExtraArgs"]["ContentType"] == "image/png"


# ================================================================
# Config
# ================================================================

class TestConfig:
    def test_inworld_voice_defaults(self):
        s = Settings(
            cloudflare_account_id="x",
            cloudflare_api_token="x",
            d1_database_id="x",
            session_secret="x",
        )
        assert s.inworld_tts_voice_male == "Theodore"
        assert s.inworld_tts_voice_female == "Kayla"

    def test_google_tts_voice_defaults(self):
        s = Settings(
            cloudflare_account_id="x",
            cloudflare_api_token="x",
            d1_database_id="x",
            session_secret="x",
        )
        assert s.google_tts_voice_male == "Puck"
        assert s.google_tts_voice_female == "Aoede"

    def test_tts_provider_default(self):
        s = Settings(
            cloudflare_account_id="x",
            cloudflare_api_token="x",
            d1_database_id="x",
            session_secret="x",
        )
        assert s.tts_provider == "inworld"

    def test_vertex_ai_defaults(self):
        s = Settings(
            cloudflare_account_id="x",
            cloudflare_api_token="x",
            d1_database_id="x",
            session_secret="x",
        )
        assert s.vertex_project_id == ""
        assert s.vertex_location == "us-central1"
