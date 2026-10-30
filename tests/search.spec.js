// tests/search.spec.js
//
// WHY THIS EXISTS
//
// Blog search is the one feature on the site that depends on a generated
// artefact the page never links: the pagefind/ index build-blog.js writes.
// If the build stops writing it, or a deploy leaves it out, the form still
// renders and every search quietly says "Search is unavailable". Nothing a
// screenshot or a head-tag check looks at would notice.
//
// So these run real searches against the committed index:
//
//   1. With JavaScript off, the form stays hidden and the paginated list is
//      untouched — the blog must not depend on the script.
//   2. A word that only appears in a post's body is found. That is the whole
//      point of full-text search over titles and excerpts.
//   3. Filters alone list newest first, and narrow by topic and year.
//   4. The search is in the address, so a shared link reproduces it.
//   5. Clearing a search brings the list and its pagination back.

// @ts-check
import { test, expect } from '@playwright/test';

const results = (page) => page.locator('[data-blog-search-results] .post-row');
const status = (page) => page.locator('.blog-search-status');

test.describe('with JavaScript off', () => {
  test.use({ javaScriptEnabled: false });

  test('the form stays hidden and the list is untouched', async ({ page }) => {
    await page.goto('/blog/');
    await expect(page.locator('[data-blog-search]')).toBeHidden();
    await expect(page.locator('[data-blog-browse] .post-row')).toHaveCount(20);
    await expect(page.locator('.pagination')).toBeVisible();
  });
});

// "Jehoshaphat" is in the body of several posts and in no post's title,
// excerpt or description, so only a full-text index can find it.
test('finds a word that appears only in the body of a post', async ({ page }) => {
  await page.goto('/blog/');
  await page.getByLabel('Search the blog').fill('Jehoshaphat');
  await expect(status(page)).toHaveText(/^\d+ posts? match “Jehoshaphat”\.$/);
  await expect(results(page).first()).toBeVisible();
  await expect(page.locator('[data-blog-browse]')).toBeHidden();
  await expect(page.locator('[data-blog-search-results] mark').first()).toHaveText(/jehoshaphat/i);
  expect(new URL(page.url()).searchParams.get('q')).toBe('Jehoshaphat');
});

// Revival & Outpouring is the smallest topic, and still more than one page
// of results, so this also covers "Show more results".
test('filters alone list the newest first', async ({ page }) => {
  await page.goto('/blog/');
  await page.getByLabel('Topic', { exact: true }).selectOption('Revival & Outpouring');
  await expect(status(page)).toHaveText('26 posts match Revival & Outpouring.');
  await expect(results(page)).toHaveCount(20);
  await page.getByRole('button', { name: 'Show more results' }).click();
  await expect(results(page)).toHaveCount(26);

  const dates = await results(page).locator('.post-date').allTextContents();
  const times = dates.map((d) => Date.parse(d));
  expect(times).toEqual([...times].sort((a, b) => b - a));
});

test('a shared link reproduces the search', async ({ page }) => {
  await page.goto('/blog/?topic=Spiritual+Warfare&year=2021');
  await expect(page.getByLabel('Topic', { exact: true })).toHaveValue('Spiritual Warfare');
  await expect(page.getByLabel('Year')).toHaveValue('2021');
  await expect(status(page)).toHaveText('7 posts match Spiritual Warfare, 2021.');
  for (const date of await results(page).locator('.post-date').allTextContents()) {
    expect(date).toMatch(/ 2021$/);
  }
});

test('clearing a search brings the list back', async ({ page }) => {
  await page.goto('/blog/?q=esther');
  await expect(results(page).first()).toBeVisible();
  await expect(page.locator('.blog-page-of')).toBeHidden();

  await page.getByRole('button', { name: 'Clear search' }).click();
  await expect(page.locator('[data-blog-browse] .post-row')).toHaveCount(20);
  await expect(page.locator('.blog-page-of')).toBeVisible();
  await expect(page.getByLabel('Search the blog')).toHaveValue('');
  await expect(page.getByLabel('Search the blog')).toBeFocused();
  expect(new URL(page.url()).search).toBe('');
});
