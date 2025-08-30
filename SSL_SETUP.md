# SSL Setup for Local Development

This setup allows you to run both frontend and backend with HTTPS using your local IP address, enabling access from multiple devices on your network.

## Quick Start

```bash
# 1. One-time setup (generates SSL certificates)
npm run setup:ssl

# 2. Start both servers with SSL
npm run dev:all

# Or run them separately:
npm run dev:ssl       # Frontend with HTTPS on port 8443
npm run dev:backend   # Backend with HTTPS on port 4443
```

## Access URLs

After running the setup, you can access your application from any device on your network:

- **Frontend**: `https://<YOUR-IP>:8443`
- **Backend**: `https://<YOUR-IP>:4443`

Your IP address will be displayed when you run `npm run setup:ssl`.

## How It Works

1. **SSL Certificates**: The setup script uses `mkcert` to generate trusted SSL certificates for your local IP address
2. **Frontend**: Vite is configured to use HTTPS when `VITE_HTTPS=true` environment variable is set
3. **Backend**: A separate HTTPS server (`https-server.js`) handles secure connections on port 4443
4. **Environment**: The backend URL is automatically updated in `.env.local` to use HTTPS

## Files Created

- `certs/cert.pem` - SSL certificate
- `certs/key.pem` - SSL private key
- `.env.local` - Updated with `VITE_BACKEND_URL=https://<YOUR-IP>:4443`

## Troubleshooting

### Certificate Warning
On first access from each device, you'll need to accept the certificate warning in your browser. This is normal for local development certificates.

### Port Already in Use
If ports 8443 or 4443 are already in use:
```bash
# Check what's using the ports
lsof -i :8443
lsof -i :4443

# Kill the processes if needed
kill -9 <PID>
```

### IP Address Changes
If your local IP address changes (e.g., after reconnecting to WiFi):
1. Run `npm run setup:ssl` again to regenerate certificates
2. The script will automatically update your environment variables

### mkcert Not Installed
The setup script will attempt to install mkcert via Homebrew on macOS. For other systems:
- **Ubuntu/Debian**: `sudo apt install libnss3-tools && brew install mkcert`
- **Windows**: Download from [mkcert releases](https://github.com/FiloSottile/mkcert/releases)

## Regular HTTP Development

To run without SSL (original setup):
```bash
npm run dev           # Frontend on port 8080
cd backend && npm run dev  # Backend on port 4001
```

## Security Note

These certificates are for local development only. Never commit the `certs/` directory to version control. The `.gitignore` file has been updated to exclude it.