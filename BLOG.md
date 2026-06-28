# Blog CMS — kirstenrossiter.com

## Writing a new post

1. **Option A — Sveltia CMS (recommended):**
   Go to [kirstenrossiter.com/admin](https://kirstenrossiter.com/admin), log in with GitHub, and use the visual editor to create a new Blog Post. Fill in the title, type, date, excerpt, SEO description, and body. Click Publish — this commits a Markdown file to the repo.

2. **Option B — manually:**
   Create a new file in `blog/posts/` named `your-post-slug.md` with this template:

   ```yaml
   ---
   title: "Your post title"
   type: Prophetic Insight       # or: Teaching, Reflection, Featured Revelation
   date: 2026-07-01
   excerpt: "A short teaser shown on the blog index card."
   description: "SEO description for search engines and link previews."
   draft: false
   ---

   Your opening paragraph becomes the lead (displayed in italics).

   ## A Section Heading

   Regular paragraphs, **bold**, *italic*, and [links](https://example.com) all work.

   > A blockquote for scripture or emphasis.

   - Bullet points
   - work too
   ```

3. **Run the build** (see below) and commit both the `.md` file and the generated HTML.

## Running the build locally

```bash
npm install          # first time only
node build-blog.js   # generates blog/*.html and blog/index.html
```

The build reads every `blog/posts/*.md` file, skips drafts, and outputs:
- One `blog/<slug>.html` per post (matching the site's existing post template)
- A regenerated `blog/index.html` with all posts sorted newest-first

**Generated HTML is committed to the repo.** This keeps the zero-build deploy working — the site renders correctly even if the Cloudflare build step is skipped.

## Cloudflare Pages build settings

| Setting          | Value                                  |
|------------------|----------------------------------------|
| Build command    | `npm install && node build-blog.js`    |
| Output directory | `/` (repo root)                        |

These settings ensure the blog is rebuilt on every push. Existing Cloudflare Functions (`functions/`) are unaffected.

## Date format

Dates in frontmatter use ISO format (`YYYY-MM-DD`). The build renders them as `D MMMM YYYY` (e.g. `22 June 2026`) — no leading zero on the day.

## Post types

The `type` field accepts any string, but these are the standard options configured in the CMS:
- **Prophetic Insight**
- **Teaching**
- **Reflection**
- **Featured Revelation**

## Sveltia CMS — one-time OAuth setup

Sveltia CMS needs a GitHub OAuth app so editors can log in via the `/admin` page. Two options:

### Option A — Sveltia CMS Authenticator (Cloudflare Workers)

1. Deploy the [Sveltia CMS Authenticator](https://github.com/sveltia/sveltia-cms-auth) to Cloudflare Workers (free tier is fine).
2. In the Worker's environment variables, set:
   - `GITHUB_CLIENT_ID` — from your GitHub OAuth App
   - `GITHUB_CLIENT_SECRET` — from your GitHub OAuth App
   - `ALLOWED_DOMAINS` — `kirstenrossiter.com`
3. Create a GitHub OAuth App at [github.com/settings/developers](https://github.com/settings/developers):
   - **Homepage URL:** `https://kirstenrossiter.com`
   - **Authorization callback URL:** `https://your-worker-name.workers.dev/callback`
4. Add `base_url: https://your-worker-name.workers.dev` to the `backend` section of `admin/config.yml`.

### Option B — Netlify-compatible OAuth proxy

If you already have a Netlify-compatible OAuth endpoint, Sveltia CMS supports it out of the box. Set the `base_url` in `admin/config.yml` accordingly.

After setup, visiting `/admin` will show the Sveltia CMS login screen, and editors can authenticate with their GitHub account to create and edit posts.
