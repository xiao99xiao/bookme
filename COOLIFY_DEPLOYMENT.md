# Coolify Deployment Guide

## Prerequisites
1. A VPS (DigitalOcean, Hetzner, Linode, etc.) with at least 2GB RAM
2. Domain name (optional but recommended)

## Step 1: Install Coolify on Your VPS

SSH into your VPS and run:
```bash
curl -fsSL https://get.coolify.io | bash
```

This will install Coolify with Traefik for automatic SSL certificates.

## Step 2: Access Coolify Dashboard

1. Navigate to `http://your-server-ip:8000`
2. Complete the initial setup wizard
3. Set up your admin account

## Step 3: Connect Your GitHub Repository

1. In Coolify dashboard, go to **Sources** → **Add New Source**
2. Choose **GitHub** 
3. Authorize Coolify to access your repository
4. Select the `bookme` repository

## Step 4: Deploy Backend Service

1. Click **+ New Resource** → **Application**
2. Select your GitHub source
3. Configure:
   - **Name**: bookme-backend
   - **Branch**: main
   - **Base Directory**: `/backend`
   - **Port**: 4000
   - **Build Pack**: Node.js
   - **Install Command**: `npm install`
   - **Start Command**: `npm start`

4. Add Environment Variables:
   ```
   PORT=4000
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_SERVICE_ROLE_KEY=your_service_key
   VITE_PRIVY_APP_ID=your_privy_app_id
   PRIVY_APP_SECRET=your_privy_secret
   ```

5. Click **Deploy**

## Step 5: Deploy Frontend Service

1. Click **+ New Resource** → **Application**
2. Select your GitHub source
3. Configure:
   - **Name**: bookme-frontend
   - **Branch**: main
   - **Base Directory**: `/`
   - **Port**: 80
   - **Build Pack**: Static
   - **Install Command**: `npm install`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`

4. Add Environment Variables:
   ```
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_anon_key
   VITE_PRIVY_APP_ID=your_privy_app_id
   VITE_BACKEND_URL=http://bookme-backend:4000
   ```

5. Set up Custom Domain (optional):
   - Add your domain in the **Domains** section
   - Coolify will automatically generate SSL certificates

6. Click **Deploy**

## Step 6: Configure Networking

In Coolify, both services will be on the same Docker network by default. The frontend can reach the backend using the service name `bookme-backend:4000`.

## Alternative: Docker Compose Deployment

If you prefer to deploy using Docker Compose directly in Coolify:

1. Click **+ New Resource** → **Docker Compose**
2. Paste the contents of `docker-compose.coolify.yml`
3. Add all environment variables
4. Click **Deploy**

## Monitoring & Logs

- View logs: Click on service → **Logs**
- Monitor resources: Check the **Monitoring** tab
- Set up health checks: Already configured in our setup

## Automatic Deployments

Coolify supports automatic deployments on push:
1. Go to your application settings
2. Enable **Auto Deploy**
3. Every push to main branch will trigger a new deployment

## Custom Domain Setup

1. Point your domain's A record to your VPS IP
2. In Coolify, add the domain to your frontend service
3. Coolify will automatically:
   - Configure Traefik routing
   - Generate Let's Encrypt SSL certificate
   - Set up HTTPS redirect

## Backup Strategy

1. Enable automatic backups in Coolify settings
2. Configure S3 or local backup destination
3. Set backup schedule (recommended: daily)

## Troubleshooting

- **Build fails**: Check build logs in Coolify dashboard
- **Service unreachable**: Verify port configuration and health checks
- **SSL issues**: Ensure domain DNS is properly configured
- **Environment variables**: Double-check all required vars are set

## Support

- Coolify Documentation: https://coolify.io/docs
- Coolify Discord: https://discord.gg/coolify
- GitHub Issues: https://github.com/coollabsio/coolify/issues