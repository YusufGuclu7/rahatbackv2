#!/usr/bin/env bash
# Render.com Build Script

echo "🚀 Starting Render build process..."

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Generate Prisma Client
echo "🔧 Generating Prisma Client..."
npx prisma generate

# Clean up failed migrations
echo "🧹 Cleaning up failed migrations..."
npx prisma db execute --stdin <<SQL
DELETE FROM "_prisma_migrations" WHERE migration_name = '20251113000000_add_pitr_support' AND finished_at IS NULL;
SQL

# Run database migrations
echo "🗄️ Running database migrations..."
npx prisma migrate deploy

echo "✅ Build completed successfully!"
