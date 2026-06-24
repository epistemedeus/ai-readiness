# Minimal container for the ai-readiness MCP server (stdio transport).
# Dependency-free, so there is nothing to install.
FROM node:22-alpine
WORKDIR /app
COPY package.json mcp.js protocol.js lib.js ./
# Speaks MCP over stdio; run with: docker run -i <image>
ENTRYPOINT ["node", "mcp.js"]
