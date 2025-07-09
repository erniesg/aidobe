# Argil Configuration Scripts

This directory contains scripts to interact with the Argil API and maintain up-to-date configuration for your account.

## Security Notice

**NEVER hardcode API keys in source code.** Always use environment variables.

## Setup

1. Set your Argil API key as an environment variable:
   ```bash
   export ARGIL_API_KEY="your-api-key-here"
   ```

2. Or add it to your `.env` file:
   ```
   ARGIL_API_KEY=your-api-key-here
   ```

## Scripts

### `fetch-argil-config.ts`
Fetches current voice and avatar data from your Argil account to understand the API structure.

```bash
# Set API key and run
export ARGIL_API_KEY="your-api-key-here"
npx tsx scripts/fetch-argil-config.ts
```

### `sync-argil-config.ts`
Automatically syncs your local configuration files with the latest voice and avatar data from your Argil account.

```bash
# Set API key and run
export ARGIL_API_KEY="your-api-key-here"
npx tsx scripts/sync-argil-config.ts
```

This will:
- Fetch all available voices from your account
- Update `src/config/argil-config.ts` with real voice IDs
- Update `src/config/argil.yaml` with current data
- Show a summary of what was updated

## Cost Management

The scripts include rate limiting and request counting to help prevent unexpected API costs:

- Maximum 10 requests per session by default
- Logs all API calls for monitoring
- Uses mock responses in development mode

## Configuration Files Updated

- `src/config/argil-config.ts` - TypeScript configuration with interfaces
- `src/config/argil.yaml` - YAML configuration for deployment settings

## Example Usage

```bash
# Fetch and examine your account data
export ARGIL_API_KEY="your-api-key-here"
npx tsx scripts/fetch-argil-config.ts

# Sync configuration with your account
npx tsx scripts/sync-argil-config.ts

# Run the application with proper configuration
npm run dev
```

## Security Best Practices

1. **Never commit API keys to version control**
2. **Use environment variables for sensitive data**
3. **Rotate API keys regularly**
4. **Monitor API usage to prevent unexpected costs**
5. **Use different API keys for development/production**

## Environment Variables

Required:
- `ARGIL_API_KEY` - Your Argil API key

Optional:
- `ARGIL_BASE_URL` - API base URL (defaults to https://api.argil.ai)
- `ENVIRONMENT` - Environment mode (development/staging/production)

## Troubleshooting

### "ARGIL_API_KEY environment variable is required"
Set the environment variable:
```bash
export ARGIL_API_KEY="your-api-key-here"
```

### "HTTP 401: Unauthorized"
Your API key may be invalid or expired. Check your Argil dashboard for a valid key.

### "HTTP 429: Rate limit exceeded"
The scripts include automatic retry with exponential backoff. If this persists, wait a few minutes and try again.

### "No voices/avatars found"
Your account may not have any configured voices or avatars. Check your Argil dashboard to set them up.