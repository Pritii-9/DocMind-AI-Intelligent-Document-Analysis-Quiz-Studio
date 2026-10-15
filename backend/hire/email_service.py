"""
HireMind - Automated Email Service
Handles sending transactional candidate notifications and recruiter alerts
via SMTP (Gmail / Custom SMTP) with rich HTML templates.
"""
import logging
import re
import smtplib
import threading
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import List, Optional

from config import settings

logger = logging.getLogger("hiremind.email")


def _is_valid_email(email: str) -> bool:
    if not email:
        return False
    return bool(re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email.strip()))


def send_email_sync(to_emails: List[str], subject: str, body_text: str, body_html: Optional[str] = None) -> dict:
    """
    Sends an email to one or more recipients synchronously.
    """
    valid_recipients = [e.strip() for e in to_emails if _is_valid_email(e)]
    if not valid_recipients:
        return {"status": "skipped", "message": "No valid recipient email addresses provided."}

    if not settings.MAIL_USERNAME or not settings.MAIL_PASSWORD:
        print(f"[HIREMIND DEV EMAIL] To: {valid_recipients} | Subject: {subject}\n{body_text}")
        return {
            "status": "mocked",
            "message": "MAIL_USERNAME or MAIL_PASSWORD not configured; logged to console.",
            "recipients": valid_recipients,
        }

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"HireMind AI <{settings.MAIL_USERNAME}>"
    msg["To"] = ", ".join(valid_recipients)

    # Attach text version
    msg.attach(MIMEText(body_text, "plain", "utf-8"))

    # Attach HTML version if provided
    if body_html:
        msg.attach(MIMEText(body_html, "html", "utf-8"))

    try:
        with smtplib.SMTP(settings.MAIL_SERVER, settings.MAIL_PORT, timeout=20) as smtp:
            if settings.MAIL_USE_TLS:
                smtp.starttls()
            smtp.login(settings.MAIL_USERNAME, settings.MAIL_PASSWORD)
            smtp.sendmail(settings.MAIL_USERNAME, valid_recipients, msg.as_string())
            print(f"[HIREMIND EMAIL SENT] Successfully delivered to: {', '.join(valid_recipients)}")
            return {
                "status": "success",
                "message": f"Delivered to {len(valid_recipients)} recipient(s)",
                "recipients": valid_recipients,
            }
    except Exception as e:
        print(f"[HIREMIND EMAIL ERROR] Failed sending to {valid_recipients}: {e}")
        return {"status": "error", "message": str(e), "recipients": valid_recipients}


def send_email_async(to_emails: List[str], subject: str, body_text: str, body_html: Optional[str] = None):
    """
    Dispatches email in a background daemon thread so HTTP requests remain snappy.
    """
    thread = threading.Thread(
        target=send_email_sync,
        args=(to_emails, subject, body_text, body_html),
        daemon=True,
    )
    thread.start()


def notify_shortlisted_candidate(
    candidate_name: str,
    candidate_email: str,
    role_title: str,
    score: int,
    recommendation: str,
    share_url: str,
    what_candidate_has: str = "",
    recruiter_email: Optional[str] = None,
) -> dict:
    """
    Sends automated shortlist emails when a candidate passes screening:
    1. Candidate email (congratulations, next steps, 24h evaluation link)
    2. Recruiter / Hiring team alert (score breakdown, link)
    """
    name = candidate_name or "Candidate"
    role = role_title or "Software Engineer"
    rec_label = recommendation or "Strong Fit"

    # ── 1. Candidate Email (Direct & Professional Notification) ───────────────
    candidate_subject = f"HireMind AI — Candidate Shortlist: {role}"
    candidate_text = f"""Hello {name},

Great news! Based on our automated technical screening against the requirements for {role}, your application has been shortlisted for interview progression.

Screening Score: {score}/100 — {rec_label}
Highlights: {what_candidate_has or 'Demonstrated strong hands-on alignment with core engineering stack and requirements.'}

Next Steps in the Hiring Process:
The next phase in our interview process is a Technical Screening Round, which will be conducted online via video call (Google Meet / Zoom) or phone. Our talent acquisition coordinator will follow up directly with you shortly with available calendar options to schedule your technical discussion.

If you have any questions ahead of your call, feel free to reply directly to this email.

Best regards,
HireMind AI Talent Acquisition Team
"""

    candidate_html = f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }}
        .card {{ max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }}
        .header {{ background: #0f172a; padding: 28px 32px; color: #ffffff; text-align: left; }}
        .header h1 {{ margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.02em; }}
        .header p {{ margin: 6px 0 0; font-size: 13px; color: #94a3b8; }}
        .body {{ padding: 32px; }}
        .score-pill {{ display: inline-flex; align-items: center; background: #ecfdf5; border: 1px solid #a7f3d0; color: #047857; font-size: 13px; font-weight: 700; padding: 6px 14px; border-radius: 20px; margin-bottom: 20px; }}
        .step-box {{ background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin: 20px 0; }}
        .footer {{ border-top: 1px solid #f1f5f9; padding: 20px 32px; font-size: 12px; color: #64748b; background: #f8fafc; }}
      </style>
    </head>
    <body>
      <div class="card">
        <div class="header">
          <h1>HireMind AI — Candidate Shortlist</h1>
          <p>Role: {role}</p>
        </div>
        <div class="body">
          <div class="score-pill">
            ★ Screening Score: {score}/100 — {rec_label}
          </div>
          <p style="font-size: 15px; line-height: 1.6; margin-top: 0;">
            Hello <strong>{name}</strong>,
          </p>
          <p style="font-size: 14px; line-height: 1.6; color: #334155;">
            Great news! Based on our automated technical screening against the requirements for <strong>{role}</strong>, your application has been <strong>shortlisted</strong> for interview progression.
          </p>
          <div style="background: #f8fafc; border-left: 3px solid #0f172a; padding: 12px 16px; margin: 16px 0; font-size: 13px; color: #475569;">
            <strong>Highlights:</strong> {what_candidate_has or 'Demonstrated strong hands-on alignment with core engineering stack and requirements.'}
          </div>

          <div class="step-box">
            <h4 style="margin: 0 0 6px; font-size: 13px; font-weight: 700; color: #166534; text-transform: uppercase; letter-spacing: 0.03em;">
              Next Step: Technical Screening Round (Online Video Call / Phone)
            </h4>
            <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #15803d;">
              Our talent acquisition coordinator will follow up directly with you shortly with available calendar options to schedule your technical discussion.
            </p>
          </div>

          <p style="font-size: 13px; line-height: 1.5; color: #64748b; margin-top: 20px;">
            If you have any questions ahead of your call, feel free to reply directly to this email.
          </p>
        </div>
        <div class="footer">
          HireMind AI Talent Acquisition
        </div>
      </div>
    </body>
    </html>
    """

    if _is_valid_email(candidate_email):
        send_email_async([candidate_email], candidate_subject, candidate_text, candidate_html)

    # ── 2. Hiring Team / Recruiter Alert ──────────────────────────────────────
    recruiter_target = recruiter_email or settings.MAIL_USERNAME
    if _is_valid_email(recruiter_target):
        team_subject = f"🚀 [SHORTLISTED] {name} ({score}/100) for {role}"
        team_text = f"""Candidate Shortlisted!

Candidate: {name}
Email: {candidate_email or 'Not provided'}
Role: {role}
Score: {score}/100 ({rec_label})
Highlights: {what_candidate_has}

24-Hour Review Link:
{share_url}
"""

        team_html = f"""
        <!DOCTYPE html>
        <html>
        <body style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; background-color: #f8fafc; padding: 20px; color: #0f172a;">
          <div style="max-width: 580px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 24px;">
            <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; color: #059669; letter-spacing: 0.05em; margin-bottom: 8px;">
              ● Candidate Shortlisted
            </div>
            <h2 style="margin: 0 0 16px; font-size: 18px; font-weight: 700;">{name} scored {score}/100 for {role}</h2>
            <div style="background: #f1f5f9; padding: 12px; border-radius: 6px; font-size: 13px; margin-bottom: 16px;">
              <div><strong>Candidate Email:</strong> {candidate_email or 'N/A'}</div>
              <div><strong>Verdict:</strong> {rec_label}</div>
              <div><strong>Summary:</strong> {what_candidate_has}</div>
            </div>
            <a href="{share_url}" style="display: inline-block; background: #0f172a; color: #fff; text-decoration: none; font-size: 13px; font-weight: 600; padding: 10px 18px; border-radius: 6px;" target="_blank">
              Review Candidate 24h Assessment & Questions →
            </a>
          </div>
        </body>
        </html>
        """
        send_email_async([recruiter_target], team_subject, team_text, team_html)

    return {
        "status": "queued",
        "candidate_email": candidate_email,
        "recruiter_email": recruiter_target,
    }
