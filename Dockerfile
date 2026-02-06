FROM oven/bun:1.1.24
WORKDIR /app
COPY package.json bun.lockb* ./
RUN bun install
COPY prisma ./prisma
RUN bunx prisma generate
COPY src ./src
ENV NODE_ENV=production
CMD ["bun", "src/apps/api.ts"]
