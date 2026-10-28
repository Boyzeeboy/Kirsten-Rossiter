/* ============================================================
   Blog search and filters, on /blog/ and /blog/page/N.

   The form ships `hidden` in the HTML and this script reveals it,
   so with JavaScript off the blog is the paginated list exactly
   as before. With a query or a filter set, the results replace
   the list and its pagination; clearing them brings the list back.

   Search runs on Pagefind. build-blog.js writes the index to
   /pagefind/; it is loaded on first use rather than on page load,
   so a visitor who never searches never downloads any of it.

   The query and filters live in the address (?q=&topic=&year=), so
   a search can be shared or bookmarked and survives a reload.
   ============================================================ */
(function () {
  var form = document.querySelector('[data-blog-search]');
  var summary = document.querySelector('[data-blog-search-summary]');
  var resultsEl = document.querySelector('[data-blog-search-results]');
  var browse = document.querySelector('[data-blog-browse]');
  // "Page N of 14" describes the list, not a set of results.
  var pageOf = document.querySelector('.blog-page-of');
  if (!form || !summary || !resultsEl || !browse) return;

  var PAGE_SIZE = 20;
  var TYPING_DELAY = 250;

  var input = form.elements.q;
  var topicSelect = form.elements.topic;
  var yearSelect = form.elements.year;
  var status = summary.querySelector('.blog-search-status');
  var clearButton = summary.querySelector('.blog-search-clear');

  var pagefindPromise = null;
  var latest = 0;
  var typingTimer = null;

  function loadPagefind() {
    if (!pagefindPromise) {
      pagefindPromise = import('/pagefind/pagefind.js').then(function (pagefind) {
        return pagefind.options({ excerptLength: 30 }).then(function () {
          return pagefind;
        });
      });
      // A failed load is retried on the next search rather than cached.
      pagefindPromise.catch(function () { pagefindPromise = null; });
    }
    return pagefindPromise;
  }

  function currentState() {
    return {
      q: input.value.trim(),
      topic: topicSelect.value,
      year: yearSelect.value,
    };
  }

  function isActive(state) {
    return Boolean(state.q || state.topic || state.year);
  }

  // Only values the form actually offers are accepted from the address,
  // so a hand-edited ?topic= cannot leave the select showing nothing.
  function setSelect(select, value) {
    for (var i = 0; i < select.options.length; i++) {
      if (select.options[i].value === value) {
        select.value = value;
        return;
      }
    }
  }

  function writeUrl(state) {
    var params = new URLSearchParams();
    if (state.q) params.set('q', state.q);
    if (state.topic) params.set('topic', state.topic);
    if (state.year) params.set('year', state.year);
    var query = params.toString();
    history.replaceState(null, '', location.pathname + (query ? '?' + query : '') + location.hash);
  }

  function setBrowsing(browsing) {
    browse.hidden = !browsing;
    if (pageOf) pageOf.hidden = !browsing;
  }

  function showBrowse() {
    setBrowsing(true);
    summary.hidden = true;
    resultsEl.hidden = true;
    resultsEl.textContent = '';
  }

  function describe(state, count) {
    var noun = count === 1 ? 'post matches' : 'posts match';
    var text = (count === 0 ? 'No posts match' : count + ' ' + noun);
    if (state.q) text += ' “' + state.q + '”';
    var filters = [state.topic, state.year].filter(Boolean);
    if (filters.length) text += (state.q ? ' in ' : ' ') + filters.join(', ');
    return text + '.';
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  // Same markup as the cards build-blog.js writes, so results look like
  // the list they replace. Pagefind's excerpt is the post's own text with
  // the matched words wrapped in <mark>, which is why it is set as HTML;
  // every other field goes in as text.
  function resultRow(data, hasQuery) {
    var row = el('a', 'post-row');
    row.href = data.url;

    var meta = el('div', 'post-meta-col');
    meta.appendChild(el('span', 'post-type', data.meta.type));
    meta.appendChild(el('span', 'post-date', data.meta.date));

    var main = el('div');
    main.appendChild(el('h2', 'post-title', data.meta.title));
    var excerpt = el('p', 'post-excerpt');
    if (hasQuery) excerpt.innerHTML = data.excerpt;
    else excerpt.textContent = data.meta.excerpt;
    main.appendChild(excerpt);

    row.appendChild(meta);
    row.appendChild(main);
    row.appendChild(el('span', 'post-arrow', '→'));
    return row;
  }

  function renderPage(results, shown, hasQuery, token) {
    var slice = results.slice(shown, shown + PAGE_SIZE);
    return Promise.all(slice.map(function (r) { return r.data(); })).then(function (items) {
      if (token !== latest) return;

      var existingMore = resultsEl.querySelector('.blog-search-more');
      if (existingMore) existingMore.remove();

      items.forEach(function (data) {
        resultsEl.appendChild(resultRow(data, hasQuery));
      });

      var next = shown + slice.length;
      if (next < results.length) {
        var more = el('button', 'blog-search-more', 'Show more results');
        more.type = 'button';
        more.addEventListener('click', function () {
          more.disabled = true;
          renderPage(results, next, hasQuery, token);
        });
        resultsEl.appendChild(more);
      }
    });
  }

  function run() {
    var state = currentState();
    var token = ++latest;
    writeUrl(state);

    if (!isActive(state)) {
      showBrowse();
      return;
    }

    summary.hidden = false;
    status.textContent = 'Searching…';

    loadPagefind().then(function (pagefind) {
      var filters = {};
      if (state.topic) filters.topic = state.topic;
      if (state.year) filters.year = state.year;
      // With words to match, Pagefind ranks by relevance. With filters
      // alone there is nothing to rank, so the newest come first, as in
      // the list.
      var options = { filters: filters };
      if (!state.q) options.sort = { date: 'desc' };
      return pagefind.search(state.q || null, options);
    }).then(function (search) {
      if (token !== latest) return;
      var results = search ? search.results : [];
      setBrowsing(false);
      resultsEl.hidden = false;
      resultsEl.textContent = '';
      status.textContent = describe(state, results.length);
      return renderPage(results, 0, Boolean(state.q), token);
    }).catch(function () {
      if (token !== latest) return;
      // The list stays usable if the index cannot be reached.
      setBrowsing(true);
      resultsEl.hidden = true;
      status.textContent = 'Search is unavailable right now. Please browse the posts below.';
    });
  }

  input.addEventListener('input', function () {
    clearTimeout(typingTimer);
    typingTimer = setTimeout(run, TYPING_DELAY);
  });
  topicSelect.addEventListener('change', run);
  yearSelect.addEventListener('change', run);

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    clearTimeout(typingTimer);
    run();
  });

  clearButton.addEventListener('click', function () {
    form.reset();
    run();
    input.focus();
  });

  var params = new URLSearchParams(location.search);
  input.value = params.get('q') || '';
  setSelect(topicSelect, params.get('topic') || '');
  setSelect(yearSelect, params.get('year') || '');

  form.hidden = false;
  if (isActive(currentState())) run();
})();
