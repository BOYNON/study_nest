# 📚 How to Add Content to StudyNest

Everything is managed through **one file** (`data/content.json`) for text content,
and either **Cloudinary** or **Google Drive** for file hosting.

---

## 🚀 Quick Start — Use the Upload Helper

The easiest way to add content is to open the built-in **Upload Helper** tool:

```
http://localhost:3000/upload-helper.html
```

This tool lets you:
- Upload images/PDFs/audio directly to Cloudinary and get a URL
- Convert Google Drive share links into embeddable/downloadable URLs
- Generate ready-to-paste JSON snippets for notes, PYQs, and chapters

---

## 📁 The Core File: `data/content.json`

All study text lives here. Structure:
```
content.json
├── classes: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
├── subjects: ["math", "science", "english", ...]
└── content:
    └── "6":
        └── "math":
            └── chapters: [ ... ]
```

---

## 🖼️ Hosting Files

### Option A — Cloudinary (Recommended for images, PDFs, audio)
1. Go to [cloudinary.com](https://cloudinary.com) → Settings → Upload Presets
2. Create an **Unsigned** preset. Name it something like `nestchat_uploads`
3. Open `/upload-helper.html`, enter your cloud name + preset name
4. Drag & drop your file → copy the URL
5. Paste the URL into `content.json` as `bookPdf` or `imageUrl`

### Option B — Google Drive (Good for PDFs)
1. Upload PDF to Google Drive
2. Right-click → Share → "Anyone with the link" → Copy link
3. Open `/upload-helper.html` → Google Drive tab → paste link
4. Click **Preview/Embed URL** (for iframe) or **Direct Download URL** (for `bookPdf`)
5. Paste the converted URL into `content.json`

### Option C — Local server (Simple, no external service)
1. Create folder: `public/pdfs/`
2. Copy PDF there (e.g. `public/pdfs/class6-math-ch3.pdf`)
3. Set `"bookPdf": "/pdfs/class6-math-ch3.pdf"` in content.json

---

## 📝 Adding Notes

```json
"notes": [
  {
    "title": "What is a Fraction?",
    "content": "A fraction is part of a whole.\n\n**Types:**\n- Proper: numerator < denominator\n- Improper: numerator > denominator"
  }
]
```

Use the Upload Helper → **Notes Snippet** tab to auto-generate this JSON.

---

## 🏆 Adding PYQs

```json
"pyqs": [
  {
    "year": 2023,
    "question": "What is 1/3 + 2/3?",
    "answer": "1/3 + 2/3 = 1",
    "marks": 1
  }
]
```

---

## 📚 Adding a Book PDF

```json
"bookPdf": "https://drive.google.com/file/d/FILE_ID/preview"
```
(Use the Upload Helper to convert your Drive link to the right format.)

---

## ⚠️ Cloudinary Upload Preset Fix

If you see **"Upload preset not found"** errors in chat image/voice uploads:

1. Go to [cloudinary.com](https://cloudinary.com) → Settings → Upload Presets
2. Click **Add upload preset**
3. Set **Signing Mode** = `Unsigned`
4. Name it `nestchat_uploads` (or anything you like)
5. Open `.env` and set:
   ```
   CLOUDINARY_UPLOAD_PRESET=nestchat_uploads
   ```
   ⚠️ This must be the **preset NAME**, NOT the API secret or key.

---

## 👤 Adding Users

Edit `data/users.json`, then run:
```bash
npm run setup-users
```

---

## ✅ After Editing content.json

Restart the server (or it auto-restarts with `npm run dev`).

