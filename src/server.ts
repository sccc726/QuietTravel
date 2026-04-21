import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';

const dev = process.env.COZE_PROJECT_ENV !== 'PROD';
const hostname = process.env.HOSTNAME || 'localhost';
const port = parseInt(process.env.PORT || '5000', 10);

/** 启动时验证/创建必需的数据库表 */
async function verifyDatabase() {
  const dbUrl = process.env.PGDATABASE_URL;
  if (!dbUrl) {
    console.warn('[verifyDatabase] PGDATABASE_URL 未设置，跳过数据库验证');
    return;
  }

  try {
    // 动态导入 pg，避免影响客户端 bundle
    const { Client } = await import('pg');
    const client = new Client(dbUrl);
    await client.connect();

    // 创建 visit_journals 表（如不存在）
    await client.query(`CREATE TABLE IF NOT EXISTS visit_journals (
      id SERIAL PRIMARY KEY,
      player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      destination_slug TEXT NOT NULL,
      place_id TEXT NOT NULL,
      place_name TEXT DEFAULT '',
      events JSONB NOT NULL,
      has_image BOOLEAN DEFAULT false,
      completed_at TIMESTAMPTZ DEFAULT NOW(),
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`);
    // 创建索引
    await client.query(`CREATE INDEX IF NOT EXISTS visit_journals_player_id_idx ON visit_journals(player_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS visit_journals_destination_slug_idx ON visit_journals(destination_slug)`);
    await client.query(`CREATE INDEX IF NOT EXISTS visit_journals_place_id_idx ON visit_journals(place_id)`);
    // 启用 RLS 并添加策略
    await client.query(`ALTER TABLE visit_journals ENABLE ROW LEVEL SECURITY`);
    await client.query(`DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'visit_journals_允许公开写入') THEN
        CREATE POLICY "visit_journals_允许公开写入" ON visit_journals FOR INSERT TO public WITH CHECK (true);
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'visit_journals_允许公开读取') THEN
        CREATE POLICY "visit_journals_允许公开读取" ON visit_journals FOR SELECT TO public;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'visit_journals_允许公开删除') THEN
        CREATE POLICY "visit_journals_允许公开删除" ON visit_journals FOR DELETE TO public;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'visit_journals_允许公开更新') THEN
        CREATE POLICY "visit_journals_允许公开更新" ON visit_journals FOR UPDATE TO public;
      END IF;
    END $$`);

    // 创建 player_destinations 表（如不存在）
    await client.query(`CREATE TABLE IF NOT EXISTS player_destinations (
      id SERIAL PRIMARY KEY,
      player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      destination_slug TEXT NOT NULL,
      destination_name TEXT NOT NULL,
      lat DOUBLE PRECISION NOT NULL,
      lng DOUBLE PRECISION NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(player_id, destination_slug)
    )`);
    // 创建索引
    await client.query(`CREATE INDEX IF NOT EXISTS player_destinations_player_id_idx ON player_destinations(player_id)`);
    // 启用 RLS 并添加策略
    await client.query(`ALTER TABLE player_destinations ENABLE ROW LEVEL SECURITY`);
    await client.query(`DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'player_destinations_允许公开写入') THEN
        CREATE POLICY "player_destinations_允许公开写入" ON player_destinations FOR INSERT TO public WITH CHECK (true);
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'player_destinations_允许公开读取') THEN
        CREATE POLICY "player_destinations_允许公开读取" ON player_destinations FOR SELECT TO public;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'player_destinations_允许公开删除') THEN
        CREATE POLICY "player_destinations_允许公开删除" ON player_destinations FOR DELETE TO public;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'player_destinations_允许公开更新') THEN
        CREATE POLICY "player_destinations_允许公开更新" ON player_destinations FOR UPDATE TO public;
      END IF;
    END $$`);

    await client.end();
    console.log('[verifyDatabase] 数据库验证完成');
  } catch (err) {
    console.error('[verifyDatabase] 验证失败（非致命）:', err);
  }
}

// Create Next.js app
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(async () => {
  // 启动时验证数据库
  await verifyDatabase();

  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url!, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('Internal server error');
    }
  });
  server.once('error', err => {
    console.error(err);
    process.exit(1);
  });
  server.listen(port, () => {
    console.log(
      `> Server listening at http://${hostname}:${port} as ${
        dev ? 'development' : process.env.COZE_PROJECT_ENV
      }`,
    );
  });
});
