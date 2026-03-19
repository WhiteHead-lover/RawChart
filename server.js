console.log("🔥 서버 시작됨");

const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const session = require("express-session");
const passport = require("passport");
const DiscordStrategy = require("passport-discord").Strategy;
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// DB
const db = new sqlite3.Database("./rules.db");

// 미들웨어
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

app.use(session({
  secret: "secret",
  resave: false,
  saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

// passport
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

passport.use(new DiscordStrategy({
  clientID: "1483478549435388004",
  clientSecret: "AJF84FuD1pMsaEjxbFMoUnn8p8CJHbo_",
  callbackURL: "https://rawchart.onrender.com/auth/discord/callback",
  scope: ["identify"]
}, (accessToken, refreshToken, profile, done) => {
  return done(null, profile);
}));

// DB 테이블
db.run(`
CREATE TABLE IF NOT EXISTS rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT,
  content TEXT,
  created_at TEXT,
  updated_at TEXT,
  edit_count INTEGER DEFAULT 0
)
`);

// 관리자
const ADMIN_NAME = "noob_love.";
function isAdmin(req, res, next) {
  if (req.user && req.user.username === ADMIN_NAME) return next();
  res.status(403).send("권한 없음");
}

// 루트 (무한로딩 방지)
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public/index.html"));
});

// 로그인
app.get("/auth/discord", passport.authenticate("discord"));

app.get("/auth/discord/callback",
  passport.authenticate("discord", { failureRedirect: "/" }),
  (req, res) => res.redirect("/")
);

// 로그아웃
app.get("/logout", (req, res) => {
  req.logout(() => res.redirect("/"));
});

// 유저 확인
app.get("/me", (req, res) => {
  res.json(req.user || null);
});

// 목록
app.get("/rules", (req, res) => {
  const search = req.query.search || "";
  db.all(
    "SELECT * FROM rules WHERE title LIKE ? ORDER BY id DESC",
    [`%${search}%`],
    (err, rows) => {
      if (err) return res.status(500).send("DB 오류");
      res.json(rows);
    }
  );
});

// 추가
app.post("/rules", (req, res) => {
  const { title, content } = req.body;
  if (!title || !content) return res.status(400).send("값 없음");

  const now = new Date().toISOString();

  db.run(
    "INSERT INTO rules (title, content, created_at, updated_at) VALUES (?, ?, ?, ?)",
    [title, content, now, now],
    function (err) {
      if (err) return res.status(500).send("저장 실패");
      res.json({ id: this.lastID });
    }
  );
});

// 수정
app.put("/rules/:id", isAdmin, (req, res) => {
  const { title, content } = req.body;
  const now = new Date().toISOString();

  db.run(
    `UPDATE rules 
     SET title=?, content=?, updated_at=?, edit_count=edit_count+1 
     WHERE id=?`,
    [title, content, now, req.params.id],
    (err) => {
      if (err) return res.status(500).send("수정 실패");
      res.send("수정 완료");
    }
  );
});

// 삭제
app.delete("/rules/:id", isAdmin, (req, res) => {
  db.run(
    "DELETE FROM rules WHERE id=?",
    [req.params.id],
    (err) => {
      if (err) return res.status(500).send("삭제 실패");
      res.send("삭제 완료");
    }
  );
});

// 상세
app.get("/rules/:id", (req, res) => {
  db.get(
    "SELECT * FROM rules WHERE id=?",
    [req.params.id],
    (err, row) => {
      if (err) return res.status(500).send("DB 오류");
      if (!row) return res.status(404).send("없음");
      res.json(row);
    }
  );
});

// 서버 실행 (하나만!)
app.listen(PORT, () => {
  console.log("서버 실행:", PORT);
});