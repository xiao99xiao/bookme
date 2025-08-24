# Claude Code Project Notes

## Development Server
- **Start command**: `npm run dev`
- **Local URL**: http://localhost:8080/
- **Network URLs**: 
  - http://192.168.0.10:8080/
  - http://192.168.0.182:8080/
  - http://198.18.0.1:8080/

## Project Structure
- **Framework**: Vite + React + TypeScript
- **UI Components**: shadcn/ui
- **Authentication**: Privy + Supabase
- **Routing**: React Router
- **Node Version**: v24.5.0
- **Vite Version**: 5.4.19

## Troubleshooting Dev Server Issues

### Common Fixes for Server Termination:
1. **Memory Issues**: Monitor with `ps aux | grep vite`
2. **File Descriptor Limits**: Current limit `ulimit -n` = 1048575
3. **Port Conflicts**: Check with `lsof -i :8080`
4. **File Watching**: Configured to use native fs events, not polling
5. **Dependencies**: Pre-optimized React, Privy, and Supabase

### If Server Keeps Terminating:
```bash
# Kill existing processes
pkill -f "vite"
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
# Start fresh
npm run dev
```

### Monitoring Commands:
- Check process: `ps aux | grep vite | grep -v grep`
- Check port: `lsof -i :8080`
- Check memory: `sysctl vm.swapusage`

## Recent Changes
- Fixed PrivyAuthContext uninitialized variable error in src/contexts/PrivyAuthContext.tsx:57
- Redesigned onboarding page with split layout and SVG illustrations
- Added optimized Vite config for better stability