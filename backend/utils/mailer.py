import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import logging
from datetime import datetime, timezone
from config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

def send_prescription_email(to_email: str, patient_name: str, prescription_data: dict) -> bool:
    """Send an HTML email with the doctor's approved protocol/prescription.
    If SMTP credentials are not configured, it writes the email to backend/data/emails/ as a file.
    """
    subject = f"🌿 Your NatureCure AI Naturopathy Treatment Protocol - approved by Practitioner"
    
    prescription_text = prescription_data.get('prescription_text', 'No protocol text provided.')
    safety_precautions = prescription_data.get('safety_precautions', '')
    
    # Generate HTML content
    html_content = f"""
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <div style="text-align: center; border-bottom: 2px solid #1a3a2a; padding-bottom: 20px;">
          <h2 style="color: #1a3a2a; margin: 0;">NatureCure AI Practitioner Portal</h2>
          <p style="margin: 5px 0 0 0; color: #666; font-style: italic;">Holistic Health Personalized for You</p>
        </div>
        
        <div style="padding: 20px 0;">
          <p>Dear <strong>{patient_name}</strong>,</p>
          <p>We are pleased to inform you that your naturopathy health intake profile has been reviewed and approved by our AYUSH practitioner. Below is your personalized treatment protocol.</p>
          
          <div style="background-color: #f5f0e8; padding: 15px; border-radius: 6px; margin: 20px 0;">
            <h3 style="color: #1a3a2a; margin-top: 0;">📋 Case Summary</h3>
            <p style="margin: 5px 0;"><strong>Status:</strong> Approved & Prescribed</p>
            <p style="margin: 5px 0;"><strong>Review Date:</strong> {datetime.now(timezone.utc).strftime('%Y-%m-%d')}</p>
          </div>

          <h3 style="color: #1a3a2a; border-bottom: 1px solid #ddd; padding-bottom: 5px;">🌿 Approved Protocol</h3>
          <div style="white-space: pre-line; background-color: #fafafa; padding: 15px; border-radius: 6px; border: 1px dashed #ccc; margin: 15px 0; font-family: Courier New, monospace;">
{prescription_text}
          </div>
    """
    
    if safety_precautions:
        html_content += f"""
          <h3 style="color: #1a3a2a; border-bottom: 1px solid #ddd; padding-bottom: 5px; margin-top: 20px;">⚠️ Important Safety Precautions</h3>
          <p style="color: #c2410c;">{safety_precautions}</p>
        """
        
    html_content += """
          <p style="margin-top: 30px; font-size: 0.8rem; color: #888; border-top: 1px solid #eee; padding-top: 10px; text-align: center;">
            ⚕️ AYUSH Disclaimer: This information is provided for educational purposes under AYUSH Naturopathy principles. Always consult a licensed AYUSH Naturopathy practitioner. In case of emergency, call 112 immediately.
          </p>
        </div>
      </body>
    </html>
    """
    
    # Check if SMTP configuration is present
    smtp_host = os.getenv("SMTP_HOST")
    smtp_port = os.getenv("SMTP_PORT")
    smtp_user = os.getenv("SMTP_USERNAME")
    smtp_pass = os.getenv("SMTP_PASSWORD")
    smtp_from = os.getenv("SMTP_FROM_EMAIL", "no-reply@naturecure.ai")
    
    if smtp_host and smtp_port and smtp_user and smtp_pass:
        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = smtp_from
            msg["To"] = to_email
            
            msg.attach(MIMEText(html_content, "html"))
            
            with smtplib.SMTP(smtp_host, int(smtp_port)) as server:
                server.starttls()
                server.login(smtp_user, smtp_pass)
                server.sendmail(smtp_from, to_email, msg.as_string())
                
            logger.info(f"Successfully sent prescription email to {to_email}")
            return True
        except Exception as e:
            logger.error(f"Failed to send email via SMTP: {e}")
            # Fall back to saving file
            
    # Write to local file for dev/debug
    email_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "emails")
    os.makedirs(email_dir, exist_ok=True)
    filename = f"email_{to_email}_{int(datetime.now(timezone.utc).timestamp())}.html"
    file_path = os.path.join(email_dir, filename)
    try:
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(html_content)
        logger.info(f"Saved simulated email output to {file_path}")
        return True
    except Exception as e:
        logger.error(f"Failed to write email file: {e}")
        return False
