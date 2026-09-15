# Boot the whole OS for a work session
docker compose -f "$PSScriptRoot\..\docker\docker-compose.yml" up -d
Set-Location "$PSScriptRoot\..\frontend"
npm run dev
