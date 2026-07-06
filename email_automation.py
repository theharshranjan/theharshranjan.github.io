"""
Zoho Mail -> Google Sheets logger + AI draft-reply bot.

Runs as a scheduled GitHub Action. Each run:
1. Connects to Zoho Mail via IMAP, checks for unread emails.
2. Logs each email's data as a new row in a Google Sheet.
3. If the email matches "needs a reply" keywords, asks Claude to draft
   a reply and saves it into the Zoho Mail Drafts folder (nothing is
   ever sent automatically).
4. Marks processed emails as read so they aren't logged twice.
"""

import os
import json
import time
import imaplib
import email
from email.header import decode_header
from email.mime.text import MIMEText
from email.utils import parseaddr, formatdate
import datetime

import gspread
from google.oauth2.service_account import Credentials
import anthropic

# ---------------------------------------------------------------------------
# Config (all pulled from environment variables / GitHub Secrets)
# ---------------------------------------------------------------------------

ZOHO_EMAIL = os.environ["ZOHO_EMAIL"]
ZOHO_APP_PASSWORD = os.environ["ZOHO_APP_PASSWORD"]
# Common values: imap.zoho.com (global), imap.zoho.in (India), imap.zoho.eu
ZOHO_IMAP_HOST = os.environ.get("ZOHO_IMAP_HOST", "imap.zoho.in")

GOOGLE_SHEET_ID = os.environ["GOOGLE_SHEET_ID"]
GOOGLE_SERVICE_ACCOUNT_JSON = os.environ["GOOGLE_SERVICE_ACCOUNT_JSON"]

ANTHROPIC_API_KEY = os.environ["ANTHROPIC_API_KEY"]
CLAUDE_MODEL = os.environ.get("CLAUDE_MODEL", "claude-sonnet-5")

# Company info used in the AI reply prompt - edit these two lines freely.
COMPANY_NAME = os.environ.get("COMPANY_NAME", "Samarpan")
COMPANY_DESCRIPTION = os.environ.get(
    "COMPANY_DESCRIPTION", "a company providing [describe your services here]"
)

# Keywords that decide whether an email gets an AI-drafted reply.
REPLY_KEYWORDS = [
    "quote", "query", "enquiry", "inquiry", "order", "support",
    "help", "issue", "pricing", "price", "booking", "request",
]

SHEET_HEADERS = [
    "Date/Time Received", "Sender Name", "Sender Email", "Subject",
    "Body Summary", "Has Attachment", "Attachments", "Category", "Status",
]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def decode_mime_words(s):
    if not s:
        return ""
    parts = decode_header(s)
    out = ""
    for text, enc in parts:
        if isinstance(text, bytes):
            out += text.decode(enc or "utf-8", errors="ignore")
        else:
            out += text
    return out


def get_body(msg):
    """Return the plain-text body of an email.message.Message."""
    if msg.is_multipart():
        # Prefer text/plain, fall back to text/html
        plain, html = None, None
        for part in msg.walk():
            ctype = part.get_content_type()
            disp = str(part.get("Content-Disposition") or "")
            if "attachment" in disp:
                continue
            if ctype == "text/plain" and plain is None:
                plain = part.get_payload(decode=True)
            elif ctype == "text/html" and html is None:
                html = part.get_payload(decode=True)
        raw = plain or html or b""
        return raw.decode(errors="ignore")
    else:
        raw = msg.get_payload(decode=True) or b""
        return raw.decode(errors="ignore")


def get_attachment_names(msg):
    names = []
    for part in msg.walk():
        if part.get_content_disposition() == "attachment":
            fname = part.get_filename()
            if fname:
                names.append(decode_mime_words(fname))
    return names


def needs_reply(subject, body):
    text = f"{subject} {body}".lower()
    return any(k in text for k in REPLY_KEYWORDS)


def connect_imap():
    imap = imaplib.IMAP4_SSL(ZOHO_IMAP_HOST)
    imap.login(ZOHO_EMAIL, ZOHO_APP_PASSWORD)
    return imap


def get_sheet():
    creds_dict = json.loads(GOOGLE_SERVICE_ACCOUNT_JSON)
    scopes = ["https://www.googleapis.com/auth/spreadsheets"]
    creds = Credentials.from_service_account_info(creds_dict, scopes=scopes)
    gc = gspread.authorize(creds)
    sh = gc.open_by_key(GOOGLE_SHEET_ID)
    ws = sh.sheet1
    # Add headers if the sheet is empty
    if ws.row_count == 0 or not ws.get_all_values():
        ws.append_row(SHEET_HEADERS)
    return ws


def generate_reply(subject, sender_name, body):
    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
    prompt = f"""You are replying to a business email on behalf of {COMPANY_NAME}, {COMPANY_DESCRIPTION}.

Read the incoming email below and draft a polite, professional reply.

Rules:
- Acknowledge their query specifically, don't give a generic response.
- If they're asking for pricing, availability, or timelines and you don't
  have that data, say "Let me check and confirm shortly" instead of guessing.
- Keep it under 150 words.
- Sign off as "Team {COMPANY_NAME}".

Incoming email:
Subject: {subject}
From: {sender_name}
Body:
{body[:3000]}
"""
    resp = client.messages.create(
        model=CLAUDE_MODEL,
        max_tokens=400,
        messages=[{"role": "user", "content": prompt}],
    )
    return resp.content[0].text.strip()


def save_draft(imap, to_addr, subject, body_text):
    msg = MIMEText(body_text)
    msg["Subject"] = f"Re: {subject}"
    msg["To"] = to_addr
    msg["From"] = ZOHO_EMAIL
    msg["Date"] = formatdate(localtime=True)

    date_internal = imaplib.Time2Internaldate(time.time())
    imap.append("Drafts", "", date_internal, msg.as_bytes())


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    imap = connect_imap()
    imap.select("INBOX")

    status, data = imap.search(None, "UNSEEN")
    ids = data[0].split() if data and data[0] else []

    if not ids:
        print("No new emails.")
        imap.logout()
        return

    sheet = get_sheet()
    print(f"Found {len(ids)} new email(s).")

    for eid in ids:
        # BODY.PEEK does not mark the message as read while we inspect it
        status, msg_data = imap.fetch(eid, "(BODY.PEEK[])")
        if status != "OK" or not msg_data or msg_data[0] is None:
            continue

        raw = msg_data[0][1]
        msg = email.message_from_bytes(raw)

        subject = decode_mime_words(msg.get("Subject", "(no subject)"))
        from_header = decode_mime_words(msg.get("From", ""))
        sender_name, sender_email = parseaddr(from_header)
        body = get_body(msg)
        attachments = get_attachment_names(msg)

        row = [
            str(datetime.datetime.now()),
            sender_name or sender_email,
            sender_email,
            subject,
            body.strip()[:300].replace("\n", " "),
            "Y" if attachments else "N",
            ", ".join(attachments),
            "",  # Category - left blank, fill manually or extend later
            "New",
        ]
        sheet.append_row(row)
        print(f"Logged: {subject!r} from {sender_email}")

        if needs_reply(subject, body):
            try:
                reply_text = generate_reply(subject, sender_name or sender_email, body)
                save_draft(imap, sender_email, subject, reply_text)
                print(f"Draft reply created for: {subject!r}")
            except Exception as e:
                print(f"Could not create draft for {subject!r}: {e}")

        # Mark as read now that it's safely logged
        imap.store(eid, "+FLAGS", "\\Seen")

    imap.logout()


if __name__ == "__main__":
    main()
