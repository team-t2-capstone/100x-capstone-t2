FROM node:20-alpine

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
ENV NEXT_PUBLIC_SUPABASE_URL="https://placeholder-value.supabase.co"
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY="placeholder-key-for-build-only"
ENV NEXT_PUBLIC_SITE_URL="https://placeholder-site-url.com"
ENV OPENAI_API_KEY="placeholder-openai-key"

# Force client-only mode for Next.js
ENV NEXT_RUNTIME="edge"
ENV NEXT_FORCE_CLIENT_ONLY="true"

# Build the application in static export mode
RUN pnpm run build

# Set runtime environment variables
ENV NODE_ENV production
ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

# Expose port
EXPOSE 3000

# Start the application
CMD ["pnpm", "start"]
