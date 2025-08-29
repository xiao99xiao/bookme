# Development Guide for Timee

## Local Development Setup

### Running the Development Server

```bash
# Standard local development
npm run dev

# With custom port
VITE_DEV_PORT=8080 npm run dev
```

Default URL: http://localhost:5173 or http://localhost:8080 (with custom port)

### HTTPS Access for Remote Testing

When testing on other devices or when HTTPS is required (e.g., for Privy embedded wallets), use Cloudflare Tunnel to create a secure HTTPS tunnel to your local development server.

#### Quick Setup with Cloudflare Tunnel

1. **Start the tunnel** (no installation required):
```bash
npx cloudflared tunnel --url http://localhost:8080
```

2. **Access your app** via the generated HTTPS URL:
   - The command will output a URL like: `https://[random-name].trycloudflare.com`
   - Share this URL with team members or use it on other devices
   - The URL changes each time you restart the tunnel

#### Alternative: Install Cloudflare Tunnel Globally

```bash
# Install once
npm install -g cloudflared

# Run tunnel
cloudflared tunnel --url http://localhost:8080
```

#### Why HTTPS is Required

- **Privy Embedded Wallets**: Require HTTPS for security
- **WebRTC/Camera/Microphone**: Browser APIs require secure context
- **Service Workers**: Only work over HTTPS
- **Geolocation**: Requires HTTPS on most browsers

#### Other Tunneling Options

If Cloudflare Tunnel is unavailable, you can use:

- **ngrok**: `ngrok http 8080` (requires account for sustained use)
- **localtunnel**: `npx localtunnel --port 8080`
- **VS Code Port Forwarding**: Built into VS Code (requires GitHub account)

## Database Setup

### Chat Feature

To enable the chat feature, execute the following SQL in your Supabase dashboard:

1. Go to Supabase Dashboard → SQL Editor
2. Run the SQL from `chat-schema-user-to-user.sql`
3. Test using the Chat API Test page at `/chat-test`

### Key Features

- **User-to-user conversations**: Chat is between users, not tied to specific bookings
- **Booking validation**: Messages can only be sent if there's an active booking between users
- **Real-time updates**: Uses Supabase Realtime for instant message delivery

## Environment Variables

Create a `.env` file with:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_PRIVY_APP_ID=your_privy_app_id
```

## Testing

### Chat API Testing

1. Navigate to `/chat-test`
2. Enter another user's ID (must have an active booking with them)
3. Test conversation creation and messaging

### Cross-Device Testing

1. Start dev server: `VITE_DEV_PORT=8080 npm run dev`
2. Start Cloudflare tunnel: `npx cloudflared tunnel --url http://localhost:8080`
3. Access the HTTPS URL on other devices
4. The tunnel URL can be shared with team members for testing

## Troubleshooting

### "Embedded wallet is only available over HTTPS" Error

This occurs when accessing the app via IP address (e.g., `192.168.x.x:8080`). 
Solution: Use Cloudflare Tunnel as described above.

### Chat Not Working

Ensure:
1. The chat schema has been applied to your database
2. Both users have an active booking (pending, confirmed, or completed status)
3. You're using the correct user IDs

### Port Already in Use

Kill the process using the port:
```bash
lsof -i :8080
kill -9 [PID]
```

Or use a different port:
```bash
VITE_DEV_PORT=3000 npm run dev
```