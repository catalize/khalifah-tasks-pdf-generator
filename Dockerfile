# Use a slim Node image
FROM node:20-slim

# Install the necessary Linux libraries for Chrome
# Note: We added libdrm2, libgbm1, and several X11 libraries
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libgcc1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    lsb-release \
    xdg-utils \
    libdrm2 \
    --no-install-recommends && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./

# In newer Puppeteer, the browser is installed to ~/.cache/puppeteer
# We install dependencies and force the browser download
RUN npm install --production

# IMPORTANT: For Puppeteer v23+, ensure the browser is actually installed in the container
RUN npx puppeteer browser install chrome

COPY . .

# Run the script
CMD [ "node", "index.js" ]