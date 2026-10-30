#!/usr/bin/env bash
# scripts/build-visual.sh
#
# Builds the site for tests/visual.spec.js: today's templates and CSS, with
# the blog posts and hubs as they were at VISUAL_CONTENT_REF. Kirsten publishes
# through the CMS straight to main, and the homepage cards, the blog index and
# the topic pages all show the newest posts, so building from live content
# turned the visual check red on every post. Pinned, the screenshots only move
# when the code does. See the header of tests/visual.spec.js.
#
# It writes the same files `npm run build` does, so afterwards the working tree
# holds the pinned blog, not the real one. CI throws it away. Locally, run
# `npm run build` again when you are done.

set -euo pipefail
cd "$(dirname "$0")/.."

# A commit on main. Move it only when build-blog.js needs content this commit
# does not have (a new required front-matter field, say), and regenerate the
# baselines in the same pull request.
VISUAL_CONTENT_REF=c50ad470f09c50e62f1181a258cecda84ee2a510

# CI checks out one commit, so the pinned one has to be fetched.
if ! git cat-file -e "${VISUAL_CONTENT_REF}^{commit}" 2>/dev/null; then
  git fetch --quiet --depth=1 origin "$VISUAL_CONTENT_REF"
fi

content="$(mktemp -d)"
trap 'rm -rf "$content"' EXIT
git archive "$VISUAL_CONTENT_REF" blog/posts blog/hubs | tar -x -C "$content"

echo "Building with blog content from ${VISUAL_CONTENT_REF:0:7}"
BLOG_CONTENT_DIR="$content/blog" node build-blog.js
