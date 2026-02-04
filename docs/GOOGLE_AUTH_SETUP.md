# Google Authentication Setup

Google sign-in is implemented. To enable it, complete these steps in Supabase and Google Cloud.

## 1. Supabase Dashboard

1. Go to **Authentication** → **Providers**
2. Enable **Google**
3. Copy the **Callback URL** (e.g. `https://<project-ref>.supabase.co/auth/v1/callback`)

## 2. Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create or select a project
3. **APIs & Services** → **OAuth consent screen** (External, add app name)
4. **APIs & Services** → **Credentials** → **Create Credentials** → **OAuth client ID**
   - Type: **Web application**
   - **Authorized JavaScript origins:** `http://localhost:3000`, your production URL
   - **Authorized redirect URIs:** Paste the Supabase callback URL
5. Copy **Client ID** and **Client Secret**

## 3. Configure Supabase

1. Back in **Supabase** → **Authentication** → **Providers** → **Google**
2. Paste Client ID and Client Secret → Save

## 4. Redirect URLs

1. **Authentication** → **URL Configuration**
2. Add to **Redirect URLs:**
   - `http://localhost:3000/auth/callback`
   - `https://your-domain.com/auth/callback` (production)
   - Your ngrok URL if testing on mobile

## 5. Test

Open the login dialog and click "Continue with Google". You should be redirected to Google, then back to `/auth/callback`, then to `/`.
