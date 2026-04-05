# 📚 StudyNest — Phase 3 Complete

StudyNest is a study website plus hidden chat.

## What uses what
- **GitHub** = code only
- **Vercel** = hosting
- **MongoDB Atlas** = users and chat text
- **Cloudinary** = images
- **.env** = private keys, only on your PC and in Vercel settings

---

## Quick start

```bash
npm install
cp .env.example .env
npm run dev
```

Open the local address shown in the terminal.

---

## Main folders

- `studyplatform/server.js` → main server
- `studyplatform/routes/` → page routes and API
- `studyplatform/views/` → all pages
- `studyplatform/public/` → CSS and JS
- `studyplatform/data/content.json` → study content
- `studyplatform/scripts/createUser.js` → add users
- `studyplatform/HOW_TO_ADD_CONTENT.md` → add chapters and notes

---

# 1) MongoDB Atlas setup

MongoDB Atlas stores:
- users
- chat messages
- links
- text data

Do **not** store raw images in MongoDB. Use Cloudinary for images.

### Steps
1. Go to MongoDB Atlas.
2. Create a free cluster.
3. Go to **Database Access** and add a database user.
4. Go to **Network Access** and add your IP address.
5. Open **Connect → Drivers** and copy the connection string.
6. Put it in your local `.env` file as `MONGODB_URI`.

### Example `.env`

```env
MONGODB_URI=your_mongodb_connection_string
SESSION_SECRET=some_long_secret
GEMINI_API_KEY=your_gemini_key
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_UPLOAD_PRESET=your_upload_preset
MAX_CHAT_MESSAGES=1000
```

### Important
- Keep `.env` private.
- Do not commit `.env` to GitHub.
- If Atlas fails, check username, password, and IP access.

---

# 2) GitHub setup

GitHub should contain code only.

### Do this
1. Create a GitHub repo.
2. Put the `studyplatform` folder in the repo.
3. Keep `.env` out of GitHub.
4. Keep `.env.example` in the repo.

### `.gitignore`

Make sure this exists:

```gitignore
.env
node_modules
.vercel
```

### Push code

```bash
git init
git add .
git commit -m "initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

---

# 3) Vercel setup

Vercel hosts the website.

### Steps
1. Go to Vercel.
2. Import your GitHub repo.
3. Set **Root Directory** to `studyplatform`.
4. Add environment variables in Vercel.
5. Deploy.

### Add these env vars in Vercel
- `MONGODB_URI`
- `SESSION_SECRET`
- `GEMINI_API_KEY`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_UPLOAD_PRESET`
- `MAX_CHAT_MESSAGES`

### After changes
If you edit env vars, redeploy the project.

---

# 4) Cloudinary setup

Cloudinary stores images so MongoDB stays small.

### Steps
1. Create a Cloudinary account.
2. Open the dashboard.
3. Create an **unsigned upload preset**.
4. Copy your **cloud name**.
5. Put both values in `.env` and in Vercel env settings.

### How the app uses it
- Upload the image to Cloudinary.
- Save only the returned image URL in MongoDB.
- Never store the raw image file in MongoDB.

---

# 5) Add a new user

### File
`studyplatform/scripts/createUser.js`

### Steps
1. Open `scripts/createUser.js`.
2. Add a new user inside the `USERS` array.
3. Save the file.
4. Run:

```bash
node scripts/createUser.js
```

### Example user

```js
{
  username: "newuser",
  displayName: "New User",
  password: "123456",
  role: "student",
  avatarColor: "#6366f1"
}
```

### Notes
- The script skips usernames that already exist.
- MongoDB must be connected for real users.

---

# 6) Add new study files/content

### Main file
`studyplatform/data/content.json`

### Add things here
- classes
- subjects
- chapters
- notes
- PYQs
- worksheets
- book links
- book Q&A

### Simple rule
- Text goes in `content.json`
- PDFs or links go as URLs
- Images go to Cloudinary first, then use the image URL

For the full chapter format, open `HOW_TO_ADD_CONTENT.md`.

---

# 7) Add images the easy way

1. Upload the image to Cloudinary.
2. Copy the image URL.
3. Paste the URL into chat or study content.
4. MongoDB stores only the URL.

This keeps the database light.

---

# 8) Chat features

- Text messages
- Link messages
- Cloudinary image messages
- Voice messages
- Delete message
- Admin wipe
- Mobile help panel
- Animations

The chat also auto-removes older messages when the limit is reached.

---

# 9) Storage cleanup

The app keeps the latest messages and deletes older ones after the limit.

Change the limit with:

```env
MAX_CHAT_MESSAGES=1000
```

---

# 10) Full deploy flow

1. Keep code in `studyplatform`
2. Keep `.env` private
3. Push code to GitHub
4. Import repo into Vercel
5. Set root directory to `studyplatform`
6. Add env vars in Vercel
7. Create MongoDB Atlas cluster
8. Create Cloudinary upload preset
9. Add a user with `createUser.js`
10. Add study content in `data/content.json`

---

## Easy memory trick
- **GitHub** = code
- **Vercel** = website
- **MongoDB** = users + text
- **Cloudinary** = images
- **.env** = secrets
"# study_nest" 
"# study_nest" 
"# study_nest" 
"# study_nest" 
