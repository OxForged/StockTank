"""RSS reading for the Market Intelligence Agent. Free, no API key.

Priority order for MetaRealm: Moroccan news first, then MENA, then big
global drama that makes good content, then general gaming and web3.
The scoring in market_intelligence.py ranks these so the top 20 you
keep are the ones you actually care about.
"""

import feedparser

FEEDS: dict[str, list[dict]] = {
    "morocco": [
        {"url": "https://news.google.com/rss/search?q=Morocco+esports+OR+%22Morocco+gaming%22&hl=en-US&gl=US&ceid=US:en", "filter": "any"},
        {"url": "https://www.le360.ma/rss", "filter": "gaming_fr"},
        {"url": "https://telquel.ma/feed", "filter": "gaming_fr"},
        {"url": "https://en.hespress.com/feed", "filter": "gaming_en"},
    ],
    "mena": [
        {"url": "https://news.google.com/rss/search?q=Saudi+esports+OR+MENA+esports+OR+%22Esports+World+Cup%22&hl=en-US&gl=US&ceid=US:en", "filter": "any"},
        {"url": "https://esportsinsider.com/feed", "filter": "mena"},
        {"url": "https://www.dexerto.com/feed/", "filter": "mena"},
    ],
    "gaming": [
        {"url": "https://news.google.com/rss/search?q=esports+OR+gaming+news&hl=en-US&gl=US&ceid=US:en", "filter": "any"},
        {"url": "https://esportsinsider.com/feed", "filter": "drama_or_big"},
        {"url": "https://www.dexerto.com/feed/", "filter": "drama_or_big"},
        {"url": "https://www.pcgamer.com/rss/", "filter": "drama_or_big"},
        {"url": "https://www.videogameschronicle.com/feed/", "filter": "drama_or_big"},
    ],
    "web3": [
        {"url": "https://news.google.com/rss/search?q=%22web3+gaming%22+OR+%22blockchain+game%22&hl=en-US&gl=US&ceid=US:en", "filter": "any"},
        {"url": "https://news.google.com/rss/search?q=%22crypto+gaming%22+OR+%22NFT+game%22+OR+GameFi&hl=en-US&gl=US&ceid=US:en", "filter": "any"},
        {"url": "https://decrypt.co/feed", "filter": "web3_game"},
        {"url": "https://www.theblock.co/rss.xml", "filter": "web3_game"},
    ],
}

FILTERS: dict[str, list[str]] = {
    "gaming_fr": [
        "gaming", "esport", "e-sport", "esports", "jeu video", "jeux video",
        "jeu vidéo", "jeux vidéo", "gamer", "streamer", "twitch", "playstation",
        "xbox", "nintendo", "fortnite", "valorant", "league of legends", "fifa",
        "ea fc", "call of duty", "mobile legends", "tournoi", "ewc", "edawry",
    ],
    "gaming_en": [
        "game", "gaming", "esport", "metaverse", "play to earn", "play-to-earn",
        "tournament", "web3 gaming",
    ],
    # Decrypt and The Block write about all of crypto. Only keep the gaming
    # stories, but catch every way they say it.
    "web3_game": [
        "game", "gaming", "gamer", "esport", "play to earn", "play-to-earn",
        "p2e", "gamefi", "metaverse", "nft game", "on-chain game", "onchain",
        "web3 gaming", "immutable", "ronin", "axie", "sandbox", "decentraland",
    ],
    "mena": [
        "mena", "saudi", "ksa", "uae", "dubai", "abu dhabi", "qatar", "egypt",
        "morocco", "maroc", "middle east", "qiddiya", "riyadh", "arab", "bahrain",
        "kuwait", "jordan", "tunisia", "algeria", "esports world cup", "ewc",
        "gamers8", "enc", "edawry",
    ],
    # Only the big, dramatic, content worthy global stories.
    "drama_or_big": [
        "world cup", "champion", "wins", "beats", "upset", "banned", "kicked",
        "disqualified", "controversy", "scandal", "record", "million", "signs",
        "acquires", "t1", "faker", "final", "grand final", "shock", "retires",
    ],
}


def passes_filter(title: str, filter_name: str | None) -> bool:
    if not filter_name:
        return True
    lowered = title.lower()
    return any(keyword in lowered for keyword in FILTERS.get(filter_name, []))


def fetch_feed(url: str, limit: int = 15) -> list[dict]:
    try:
        parsed = feedparser.parse(url)
    except Exception:
        return []
    entries = []
    for entry in parsed.entries[:limit]:
        entries.append(
            {
                "title": entry.get("title", "").strip(),
                "link": entry.get("link", ""),
                "source": parsed.feed.get("title", url),
            }
        )
    return entries
