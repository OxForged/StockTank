import asyncio
import logging
from pathlib import Path

import boto3

from app.config import Settings

logger = logging.getLogger(__name__)


async def upload_to_r2(
    file_path: Path,
    key: str,
    settings: Settings,
    content_type: str = "audio/mpeg",
) -> str:
    """Upload a file to Cloudflare R2 and return the public URL."""
    return await asyncio.to_thread(_upload, file_path, key, settings, content_type)


def _upload(file_path: Path, key: str, settings: Settings, content_type: str) -> str:
    client = boto3.client(
        "s3",
        endpoint_url=f"https://{settings.r2_account_id}.r2.cloudflarestorage.com",
        aws_access_key_id=settings.r2_access_key_id,
        aws_secret_access_key=settings.r2_secret_access_key,
        region_name="auto",
    )

    client.upload_file(
        str(file_path),
        settings.r2_bucket_name,
        key,
        ExtraArgs={"ContentType": content_type},
    )

    public_url = f"{settings.r2_public_url}/{key}"
    logger.info("Uploaded %s → %s", file_path.name, public_url)
    return public_url
