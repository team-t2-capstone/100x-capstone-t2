FROM node:20-alpine AS builder

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Create a dummy tsconfig.tsbuildinfo file to prevent mounting issues
RUN touch tsconfig.tsbuildinfo

# Copy package.json first for better caching
COPY package.json pnpm-lock.yaml* ./

# Install dependencies without frozen lockfile
RUN pnpm install --no-frozen-lockfile

# Copy the rest of the application
COPY . .

# Make sure tsconfig.tsbuildinfo is a regular file, not a directory
RUN rm -f tsconfig.tsbuildinfo && touch tsconfig.tsbuildinfo

# Set environment variables for build time
# These are placeholder values just to allow the build to complete
# The actual values will be set at runtime via Railway environment variables
ENV NEXT_PUBLIC_SUPABASE_URL="https://placeholder-value.supabase.co"
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY="placeholder-key-for-build-only"
ENV NEXT_PUBLIC_SITE_URL="https://placeholder-site-url.com"
ENV OPENAI_API_KEY="placeholder-openai-key"

# Force client-only mode for Next.js
ENV NEXT_RUNTIME="edge"
ENV NEXT_FORCE_CLIENT_ONLY="true"
ENV NEXT_TELEMETRY_DISABLED="1"

# Disable SSR and prerendering
ENV NEXT_DISABLE_SSR="true"
ENV NEXT_DISABLE_PRERENDER="true"

# Build the application in static export mode
RUN pnpm run build

# Production image, copy all the files and run next
FROM node:20-alpine AS runner
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy necessary files from builder stage
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.mjs ./next.config.mjs

# Install production dependencies only
RUN pnpm install --prod --no-frozen-lockfile

# Set runtime environment variables
ENV NODE_ENV="production"
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Force client-only mode for Next.js at runtime
ENV NEXT_RUNTIME="edge"
ENV NEXT_FORCE_CLIENT_ONLY="true"
ENV NEXT_TELEMETRY_DISABLED="1"

# Disable SSR and prerendering at runtime
ENV NEXT_DISABLE_SSR="true"
ENV NEXT_DISABLE_PRERENDER="true"

# Expose port
EXPOSE 3000

# Start the application
CMD ["pnpm", "start"]
