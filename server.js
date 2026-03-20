console.log("🔥 서버 시작됨");

const express = require("express");
const Database = require("better-sqlite3");
const session = require("express-session");
const passport = require("passport");
const DiscordStrategy = require("passport-discord").Strategy;
const path = require("path");

const app = express();
const PORT = process.env.PORT || 10000;

// ✅ ENV 확인 로그
console.log("CLIENT_ID:", process.env.DISCORD_CLIENT_ID);
console.log("CALLBACK:", process.env.CALLBACK_URL);

// ✅ DB
const db = new Database("rules.db");

// 테이블 생성
db.prepare(`
CREATE TABLE IF NOT EXISTS rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT,
  content TEXT,
  created_at TEXT,
  updated_at TEXT,
  edit_count INTEGER DEFAULT 0
)
`).run();

// ✅ 미들웨어
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// static
const publicPath = path.join(__dirname, "public");
app.use(express.static(publicPath));

// ✅ 세션 (🔥 핵심 설정)
app.use(session({
  secret: process.env.SESSION_SECRET || "secret",
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: true,       // Render는 https
    sameSite: "none"
  }
}));

app.use(passport.initialize());
app.use(passport.session());

// ✅ passport
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

passport.use(new DiscordStrategy({
  clientID: process.env.DISCORD_CLIENT_ID,
  clientSecret: process.env.DISCORD_CLIENT_SECRET,
  callbackURL: process.env.CALLBACK_URL,
  scope: ["identify"]
}, (accessToken, refreshToken, profile, done) => {
  try {
    console.log("로그인 성공:", profile.username);
    return done(null, profile);
  } catch (err) {
    console.error("passport 에러:", err);
    return done(err, null);
  }
}));

// ✅ 관리자
const ADMIN_NAME = "noob_love.";
function isAdmin(req, res, next) {
  if (req.user && req.user.username === ADMIN_NAME) return next();
  res.status(403).send("권한 없음");
}

// ✅ 루트
app.get("/", (req, res) => {
  res.sendFile(path.join(publicPath, "index.html"));
});

// ✅ 로그인
app.get("/auth/discord", passport.authenticate("discord"));

// ✅ callback (🔥 완전 안정형)
app.get("/auth/discord/callback", (req, res, next) => {
  passport.authenticate("discord", (err, user) => {
    if (err) {
      console.error("OAuth 에러:", err);
      return res.send("로그인 실패 (서버 에러)");
    }
    if (!user) return res.redirect("/");

    req.logIn(user, (err) => {
      if (err) {
        console.error("세션 저장 에러:", err);
        return res.send("세션 에러");
      }
      return res.redirect("/");
    });
  })(req, res, next);
});

// ✅ 로그아웃
app.get("/logout", (req, res) => {
  req.logout(() => res.redirect("/"));
});

// ✅ 유저
app.get("/me", (req, res) => {
  res.json(req.user || null);
});

// ✅ 목록
app.get("/rules", (req, res) => {
  const search = req.query.search || "";
  const rows = db.prepare(
    "SELECT * FROM rules WHERE title LIKE ? ORDER BY id DESC"
  ).all(`%${search}%`);
  res.json(rows);
});

// ✅ 추가
app.post("/rules", (req, res) => {
  const { title, content } = req.body;
  if (!title || !content) return res.status(400).send("값 없음");

  const now = new Date().toISOString();

  const result = db.prepare(
    "INSERT INTO rules (title, content, created_at, updated_at) VALUES (?, ?, ?, ?)"
  ).run(title, content, now, now);

  res.json({ id: result.lastInsertRowid });
});

// ✅ 수정
app.put("/rules/:id", isAdmin, (req, res) => {
  const { title, content } = req.body;
  const now = new Date().toISOString();

  db.prepare(`
    UPDATE rules 
    SET title=?, content=?, updated_at=?, edit_count=edit_count+1 
    WHERE id=?
  `).run(title, content, now, req.params.id);

  res.send("수정 완료");
});

// ✅ 삭제
app.delete("/rules/:id", isAdmin, (req, res) => {
  db.prepare("DELETE FROM rules WHERE id=?").run(req.params.id);
  res.send("삭제 완료");
});

// ✅ 상세
app.get("/rules/:id", (req, res) => {
  const row = db.prepare(
    "SELECT * FROM rules WHERE id=?"
  ).get(req.params.id);

  if (!row) return res.status(404).send("없음");
  res.json(row);
});

// ✅ 서버 실행
app.listen(PORT, () => {
  console.log("서버 실행:", PORT);
});