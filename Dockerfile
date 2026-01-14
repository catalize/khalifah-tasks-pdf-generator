# Use a slim Node image to save space and cost
FROM node:20-slim

# Install the minimum libraries required to run Chrome
RUN apt-get update && apt-get install -y \
    wget gnupg ca-certificates fonts-liberation \
    libnss3 libatk-bridge2.0-0 libgtk-3-0 libasound2 \
    --no-install-recommends && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install --production

# Copy the rest of your code
COPY . .

# Run the script
CMD [ "node", "index.js" ]