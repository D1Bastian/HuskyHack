import path from "node:path";
import { promises as fs } from "node:fs";
import express from "express";
import multer from "multer";
import { createPost, listPosts, getPost, deletePost } from "./db.js";
import { computePHash } from "./imageMatch.js";

export function createBlogRouter({ postsDir }) {
  const router = express.Router();

  const storage = multer.diskStorage({
    destination: postsDir,
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
      const safeExt = [".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(ext) ? ext : ".jpg";
      cb(null, `post_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${safeExt}`);
    },
  });

  const upload = multer({
    storage,
    limits: { fileSize: 12 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      if (!file.mimetype.startsWith("image/")) {
        cb(new Error("Only image uploads are supported."));
        return;
      }
      cb(null, true);
    },
  });

  router.get("/", (_req, res, next) => {
    try {
      res.json({ posts: listPosts() });
    } catch (error) {
      next(error);
    }
  });

  router.get("/:id", (req, res, next) => {
    try {
      const post = getPost(Number(req.params.id));
      if (!post) {
        res.status(404).json({ error: "Post not found." });
        return;
      }
      res.json({ post });
    } catch (error) {
      next(error);
    }
  });

  router.post("/", upload.single("image"), async (req, res, next) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: "Upload an image using the form field named image." });
        return;
      }
      const { title, author, inspiration = "", meaning = "", body = "" } = req.body;
      if (!title || !author) {
        await fs.rm(req.file.path, { force: true }).catch(() => {});
        res.status(400).json({ error: "Title and author are required." });
        return;
      }

      const phash = await computePHash(req.file.path);

      const post = createPost({
        title: String(title).trim(),
        author: String(author).trim(),
        inspiration: String(inspiration).trim(),
        meaning: String(meaning).trim(),
        body: String(body).trim(),
        image_path: req.file.path,
        image_filename: req.file.filename,
        phash,
      });

      res.status(201).json({ post });
    } catch (error) {
      if (req.file) {
        await fs.rm(req.file.path, { force: true }).catch(() => {});
      }
      next(error);
    }
  });

  router.delete("/:id", async (req, res, next) => {
    try {
      const post = getPost(Number(req.params.id));
      if (!post) {
        res.status(404).json({ error: "Post not found." });
        return;
      }
      deletePost(Number(req.params.id));
      await fs.rm(post.image_path || "", { force: true }).catch(() => {});
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
