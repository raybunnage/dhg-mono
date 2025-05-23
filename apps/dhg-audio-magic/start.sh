#!/bin/bash

# Start DHG Audio Magic App

echo "Starting DHG Audio Magic..."
echo ""
echo "📧 Email Allowlist Authentication Demo"
echo "✨ Magic Link Login - No Passwords Required!"
echo ""
echo "Make sure you have set up your .env file with Supabase credentials."
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found!"
    echo "Please copy .env.example to .env and add your Supabase credentials."
    exit 1
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

# Start the development server
npm run dev