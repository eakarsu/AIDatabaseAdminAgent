#!/bin/bash
echo "🗄️ Starting AI Database Admin Agent..."
for port in 3004 3005; do pid=$(lsof -ti:$port 2>/dev/null); [ ! -z "$pid" ] && kill -9 $pid 2>/dev/null; done
set -a; source .env; set +a
psql -U postgres -tc "SELECT 1 FROM pg_database WHERE datname = 'ai_database_admin_db'" | grep -q 1 || psql -U postgres -c "CREATE DATABASE ai_database_admin_db"
psql -U postgres -d ai_database_admin_db -f backend/models/schema.sql
cd backend && node seeds/seed.js && cd ..
[ ! -d "backend/node_modules" ] && (cd backend && npm install && cd ..)
[ ! -d "frontend/node_modules" ] && (cd frontend && npm install && cd ..)
cd backend && npx nodemon server.js &
cd ../frontend && PORT=3005 npm start &
echo "Frontend: http://localhost:3005 | Backend: http://localhost:3004"
wait
