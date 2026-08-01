import crypto from "node:crypto";
import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";

const db = new DatabaseSync("../data/orion.sqlite");
const backupPath = "tests/.optimizer-session-backup.json";

if (process.argv[2] === "cleanup") {
  const backup = JSON.parse(fs.readFileSync(backupPath, "utf8"));
  db.prepare("UPDATE users SET client_version = ?, client_seen_at = ? WHERE id = ?")
    .run(backup.client_version, backup.client_seen_at, backup.user_id);
  db.prepare("DELETE FROM tokens WHERE token_hash = ?").run(backup.token_hash);
  fs.unlinkSync(backupPath);
  console.log("Fixture removida.");
  process.exit(0);
}

const user = db.prepare(
  "SELECT id, client_version, client_seen_at FROM users WHERE role = 'owner' ORDER BY id LIMIT 1",
).get();
if (!user) throw new Error("Owner nao encontrado.");
const token = crypto.randomBytes(32).toString("hex");
const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
const now = Math.floor(Date.now() / 1000);
fs.writeFileSync(backupPath, JSON.stringify({
  user_id: user.id,
  client_version: user.client_version,
  client_seen_at: user.client_seen_at,
  token_hash: tokenHash,
}));
db.prepare("UPDATE users SET client_version = '0.9.0', client_seen_at = ? WHERE id = ?").run(now, user.id);
db.prepare("INSERT INTO tokens(user_id, token_hash, expires_at, created_at, kind) VALUES(?, ?, ?, ?, 'web')")
  .run(user.id, tokenHash, now + 1800, now);
console.log(token);
