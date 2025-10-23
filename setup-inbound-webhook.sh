#!/bin/bash

# Setup Twilio Inbound Voice Webhook for Local Development
# This script uses Twilio CLI to automatically create an ngrok tunnel

echo "🔧 Setting up Twilio inbound voice webhook for local development..."
echo ""
echo "Twilio Phone Number: +18775196150"
echo "Local Endpoint: http://localhost:3003/api/twilio/voice"
echo ""

# Check if Twilio CLI is installed
if ! command -v twilio &> /dev/null; then
    echo "❌ Twilio CLI is not installed"
    echo ""
    echo "Install it with:"
    echo "  npm install -g twilio-cli"
    echo ""
    exit 1
fi

# Check if logged in to Twilio CLI
if ! twilio profiles:list &> /dev/null; then
    echo "❌ Not logged in to Twilio CLI"
    echo ""
    echo "Login with:"
    echo "  twilio login"
    echo ""
    exit 1
fi

echo "✅ Twilio CLI is ready"
echo ""
echo "🚀 Updating phone number webhook..."
echo "   (This will automatically create an ngrok tunnel)"
echo ""

# Update the phone number with localhost URL - Twilio CLI will auto-create ngrok tunnel
twilio phone-numbers:update +18775196150 \
  --voice-url="http://localhost:3003/api/twilio/voice" \
  --voice-method="POST"

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ SUCCESS! Inbound calls will now work!"
    echo ""
    echo "📋 What just happened:"
    echo "  1. Twilio CLI detected you're using localhost"
    echo "  2. Automatically created an ngrok tunnel"
    echo "  3. Configured your phone number to use the tunnel"
    echo ""
    echo "🧪 Test it now:"
    echo "  Call +18775196150 from your phone"
    echo "  Watch the terminal for the big red 🚨🚨🚨 alerts"
    echo ""
else
    echo ""
    echo "❌ Failed to update webhook"
    echo ""
    echo "Manual steps:"
    echo "  1. Go to: https://console.twilio.com/us1/develop/phone-numbers/manage/incoming"
    echo "  2. Click on +18775196150"
    echo "  3. Under 'Voice Configuration' → 'A CALL COMES IN'"
    echo "  4. Set to: Webhook, HTTP POST"
    echo "  5. URL: https://voip-saas.vercel.app/api/twilio/voice"
    echo "  6. Click Save"
    echo ""
fi
