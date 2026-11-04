#!/usr/bin/env python3
"""Log in to Telegram by QR code and store the session string in Infisical.

Run through `infisical run` so the API keys come from Infisical:

    infisical run --projectId <id> --env prod --silent -- \
        ~/.claude/skills/telegram-telethon/.venv/bin/python \
        ~/.claude/skills/telegram-telethon/scripts/tg_session_infisical.py [--rotate]

Reads TELEGRAM_API_ID and TELEGRAM_API_HASH (and TELEGRAM_SESSION with --rotate)
from the environment, writes the new session to TELEGRAM_SESSION in the same
project/env. The session string is never printed.

--rotate: after the new session is saved, logs the previous TELEGRAM_SESSION
out, which ends that session on Telegram's side (it disappears from Devices).
"""

import argparse
import asyncio
import datetime
import getpass
import os
import subprocess
import sys

import qrcode
from telethon import TelegramClient
from telethon.errors import SessionPasswordNeededError
from telethon.sessions import StringSession

SECRET_NAME = "TELEGRAM_SESSION"


def show_qr(url: str) -> None:
    qr = qrcode.QRCode(border=1)
    qr.add_data(url)
    qr.make(fit=True)
    print("\033[2J\033[H", end="")  # clear the screen so only one QR is visible
    print("Telegram → Settings → Devices → Link Desktop Device, then scan:\n")
    qr.print_ascii(invert=True)


def save_to_infisical(value: str, project_id: str, env: str) -> None:
    result = subprocess.run(
        ["infisical", "secrets", "set", f"{SECRET_NAME}={value}",
         "--projectId", project_id, "--env", env, "--silent"],
        stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True,
    )
    if result.returncode != 0:
        sys.exit(f"Saving to Infisical failed: {result.stderr.strip()}")


async def qr_login(api_id: int, api_hash: str, device: str) -> tuple[str, str]:
    client = TelegramClient(StringSession(), api_id, api_hash, device_model=device)
    await client.connect()
    try:
        qr = await client.qr_login()
        while True:
            show_qr(qr.url)
            try:
                await qr.wait(timeout=60)
                break
            except asyncio.TimeoutError:
                await qr.recreate()  # QR codes expire; show a fresh one
            except SessionPasswordNeededError:
                await client.sign_in(password=getpass.getpass("2FA password: "))
                break
        me = await client.get_me()
        return client.session.save(), f"{me.first_name} (@{me.username})"
    finally:
        await client.disconnect()


async def log_out_old(api_id: int, api_hash: str, old: str) -> bool:
    client = TelegramClient(StringSession(old), api_id, api_hash)
    await client.connect()
    try:
        if not await client.is_user_authorized():
            return False
        return await client.log_out()
    finally:
        if client.is_connected():
            await client.disconnect()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--rotate", action="store_true", help="also end the previous session")
    parser.add_argument("--project-id", default=os.environ.get("INFISICAL_PROJECT_ID"),
                        required="INFISICAL_PROJECT_ID" not in os.environ,
                        help="Infisical project ID (or set INFISICAL_PROJECT_ID)")
    parser.add_argument("--env", default="prod")
    args = parser.parse_args()

    api_id, api_hash = os.environ.get("TELEGRAM_API_ID"), os.environ.get("TELEGRAM_API_HASH")
    if not api_id or not api_hash:
        sys.exit("TELEGRAM_API_ID / TELEGRAM_API_HASH missing — run this through `infisical run`.")
    old = os.environ.get(SECRET_NAME)
    if args.rotate and not old:
        sys.exit(f"--rotate needs an existing {SECRET_NAME} in Infisical.")

    device = f"accuraten-telethon {datetime.date.today():%Y-%m-%d}"
    session, who = asyncio.run(qr_login(int(api_id), api_hash, device))
    save_to_infisical(session, args.project_id, args.env)
    print(f"\nLogged in as {who}. Session '{device}' saved to {SECRET_NAME} "
          f"({args.project_id}, {args.env}).")

    if args.rotate:
        ended = asyncio.run(log_out_old(int(api_id), api_hash, old))
        print("Previous session ended." if ended else
              "Previous session was already invalid; nothing to end.")


if __name__ == "__main__":
    main()
