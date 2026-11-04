# Provider credentials and account connections

TOMAN never uses Android permissions to access a business's Facebook,
Instagram, Google Ads, YouTube, or WhatsApp account. Android permissions only
cover device features such as notifications, microphone, and file selection.
Each channel must use its provider's server-side OAuth or business API flow.

## Meta: Facebook, Instagram, and WhatsApp

Create a Meta developer application and add Facebook Login plus the WhatsApp
product. Put these server-side values in .env:

- META_APP_ID and META_APP_SECRET
- META_OAUTH_REDIRECT_URI, registered exactly in the Meta developer console
- WHATSAPP_ACCESS_TOKEN, preferably a system-user token
- WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_BUSINESS_ACCOUNT_ID
- WHATSAPP_WEBHOOK_VERIFY_TOKEN and WHATSAPP_APP_SECRET

The business must connect an Instagram professional account to a Facebook Page.
Publishing or advertising permissions such as pages_manage_posts,
instagram_content_publish, ads_management, and ads_read require the appropriate
Meta app review and, where applicable, business verification. WhatsApp outbound
templates require opt-in and Meta approval.

## Google Ads and YouTube

In one Google Cloud project, enable Google Ads API and YouTube Data API v3.
Create an OAuth web client, configure its consent screen, and register the
exact HTTPS callback URI. Add:

- GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, and
  GOOGLE_OAUTH_REDIRECT_URI
- GOOGLE_ADS_DEVELOPER_TOKEN
- GOOGLE_ADS_CUSTOMER_ID; add GOOGLE_ADS_LOGIN_CUSTOMER_ID when using a
  manager account

Google Ads requires the adwords OAuth scope. YouTube uploads require the
youtube.upload OAuth scope. An API key alone cannot authorize an upload or an
ad account.

## ElevenLabs

Create an ElevenLabs API key and choose a voice in the ElevenLabs dashboard,
then add:

- ELEVENLABS_API_KEY
- ELEVENLABS_VOICE_ID
- optionally ELEVENLABS_MODEL_ID=eleven_multilingual_v2

Keep the key on the backend only. The mobile app should receive audio bytes or
a short-lived signed URL, never this API key.

## Local development callback

OAuth providers require a public HTTPS redirect URI for most account
connections. For a local demo, expose a narrowly scoped temporary HTTPS tunnel
and set TOMAN_PUBLIC_BASE_URL plus each provider redirect URI to that callback.
Do not use a random callback URL or an Android runtime permission as a
substitute for OAuth.
