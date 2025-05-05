FROM node:18-alpine

WORKDIR /app

# Install dependencies
RUN apk add --no-cache tzdata

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy application files
COPY *.js ./

# Create required directories
RUN mkdir -p output
RUN mkdir -p data

# Set up cron job
RUN echo "0 2 * * * cd /app && node /app/incremental-sync.js >> /app/data/sync.log 2>&1" > /etc/crontabs/root
# Also add a quick 5-minute check for testing purposes
RUN echo "*/5 * * * * cd /app && node /app/incremental-sync.js >> /app/data/quick-sync.log 2>&1" >> /etc/crontabs/root

# Create a healthcheck file
RUN echo '#!/bin/sh\necho "Fergus sync service is running"' > /app/healthcheck.sh
RUN chmod +x /app/healthcheck.sh

# Set environment variables
ENV NODE_ENV=production

# Create an entrypoint script
RUN echo '#!/bin/sh\necho "Starting Fergus sync service..."\n\n# Store last_sync.json in persistent volume\nif [ ! -f "/app/data/last_sync.json" ] && [ -f "/app/last_sync.json" ]; then\n  cp /app/last_sync.json /app/data/\nfi\n\n# Create symlink to ensure the script uses the persistent storage\nln -sf /app/data/last_sync.json /app/last_sync.json\n\n# Start cron service\ncrond -f -l 8' > /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# Expose healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 CMD /app/healthcheck.sh

# Run the entrypoint script
ENTRYPOINT ["/app/entrypoint.sh"] 