const GOOGLE_CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID';
const GOOGLE_CLIENT_SECRET = 'YOUR_GOOGLE_CLIENT_SECRET';
const REDIRECT_URI = 'https://yourworker.com/auth/oauth/google/callback';

interface GoogleTokenResponse {
    access_token: string;
    expires_in: number;
    refresh_token?: string;
    scope: string;
    token_type: string;
    id_token: string;
}


// exchange code -> token (id_token + access_token)
export async function exchangeGoogleCode(code: string): Promise<GoogleTokenResponse> {
    const resp = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            code,
            client_id: GOOGLE_CLIENT_ID,
            client_secret: GOOGLE_CLIENT_SECRET,
            redirect_uri: REDIRECT_URI,
            grant_type: 'authorization_code'
        })
    });

    if (!resp.ok) {
        const text = await resp.text();
        throw new Error('Failed to exchange code: ' + text);
    }

    const data: GoogleTokenResponse = await resp.json();

    if (!data.id_token) {
        throw new Error('No id_token in token response');
    }

    return data;
}


// ambil profile dari access_token (opsional, bisa langsung decode id_token)
export async function getGoogleUserInfo(accessToken: string) {
    const resp = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (!resp.ok) {
        const text = await resp.text();
        throw new Error('Failed to fetch user info: ' + text);
    }

    return await resp.json(); // { id, email, name, picture, ... }
}
