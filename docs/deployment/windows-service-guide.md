# Windows Background Service Deployment Guide

## Overview

MeghAI runs on Windows using two decoupled processes:
1. **MeghAI API Server** (`localhost:4820`): Unprivileged Node.js/Fastify server serving REST, SSE, and UI assets.
2. **MeghAI Windows Agent** (`localhost:4821`): Privileged native Windows automation service handling Win32 window focus, active processes, and native PowerShell.

## Installing as Windows Services

Open an elevated PowerShell console (Run as Administrator) and run:

```powershell
powershell -ExecutionPolicy Bypass -File infrastructure/deployment/windows-service.ps1 -Action install
```

To start the services:
```powershell
powershell -ExecutionPolicy Bypass -File infrastructure/deployment/windows-service.ps1 -Action start
```

To view service status:
```powershell
powershell -ExecutionPolicy Bypass -File infrastructure/deployment/windows-service.ps1 -Action status
```

To stop or uninstall:
```powershell
powershell -ExecutionPolicy Bypass -File infrastructure/deployment/windows-service.ps1 -Action stop
powershell -ExecutionPolicy Bypass -File infrastructure/deployment/windows-service.ps1 -Action uninstall
```

## Security Isolation

- IPC between the unprivileged API server and the privileged Windows Agent uses HMAC-SHA256 signed tokens.
- Secret tokens rotate per session and are stored in `%LOCALAPPDATA%\MeghAI\ipc.secret` with file permissions restricted to the current Windows user SID.
