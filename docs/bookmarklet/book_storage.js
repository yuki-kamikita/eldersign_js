(() => {
  const PANEL_ID = "__es_book_expand_panel";
  const ACTION_PANEL_ID = "__es_book_action_panel";
  const PER_PAGE = 10;
  const REQUEST_DELAY_MS = 500;

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const buildPanel = () => {
    document.getElementById(PANEL_ID)?.remove();
    const panel = document.createElement("div");
    panel.id = PANEL_ID;
    panel.style.cssText =
      "position:fixed;top:10px;right:10px;z-index:99999;" +
      "background:rgba(0,0,0,.8);color:#fff;padding:10px 12px;" +
      "border-radius:8px;font-family:monospace;font-size:12px;" +
      "max-width:calc(100% - 20px);";
    panel.textContent = "準備中...";
    document.body.appendChild(panel);
    return panel;
  };

  const buildActionPanel = () => {
    document.getElementById(ACTION_PANEL_ID)?.remove();
    const panel = document.createElement("div");
    panel.id = ACTION_PANEL_ID;
    panel.style.cssText =
      "position:fixed;bottom:10px;right:10px;z-index:99999;" +
      "background:rgba(0,0,0,.8);color:#fff;padding:10px 12px;" +
      "border-radius:8px;font-family:monospace;font-size:12px;" +
      "max-width:calc(100% - 20px);display:flex;gap:8px;flex-wrap:wrap;" +
      "align-items:center;";

    const makeButton = (label) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      button.style.cssText =
        "background:#fff;color:#000;border:none;border-radius:6px;" +
        "padding:6px 10px;font-size:12px;cursor:pointer;";
      return button;
    };

    const storeButton = makeButton("保管する");
    const bookButton = makeButton("ブックへ");
    const status = document.createElement("span");
    status.textContent = "選択待ち";

    panel.appendChild(storeButton);
    panel.appendChild(bookButton);
    panel.appendChild(status);
    document.body.appendChild(panel);

    return { panel, storeButton, bookButton, status };
  };

  const injectStyles = () => {
    if (document.getElementById("__es_book_select_style")) return;
    const style = document.createElement("style");
    style.id = "__es_book_select_style";
    style.textContent =
      ".es-book-item{position:relative;padding-left:34px;}" +
      ".es-book-check{position:absolute;left:10px;top:18px;}" +
      ".es-book-item.is-selected{outline:2px solid #00d1b2;outline-offset:-2px;}" +
      ".es-book-item a{cursor:pointer;}";
    document.head.appendChild(style);
  };

  const parseOwnedCount = () => {
    const footer = document.querySelector("footer p");
    if (!footer) return null;
    const match = footer.textContent.match(/全\s*(\d+)\s*\/\s*\d+\s*枚/);
    if (!match) return null;
    const value = parseInt(match[1], 10);
    return Number.isNaN(value) ? null : value;
  };

  const getCurrentPage = () => {
    const on = document.querySelector("nav.pager li.on a");
    const value = on ? parseInt(on.textContent, 10) : 1;
    return Number.isNaN(value) ? 1 : value;
  };

  const buildPageUrl = (pageNumber) => {
    const url = new URL(location.href);
    url.searchParams.set("pg", String(pageNumber - 1));
    return url.toString();
  };

  const extractListItems = (html) => {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const items = doc.querySelectorAll("nav.block ul li");
    return Array.from(items);
  };

  const parseMidFromHref = (href) => {
    if (!href) return null;
    try {
      const url = new URL(href, location.href);
      const mid = url.searchParams.get("mid");
      return mid && /^\d+$/.test(mid) ? mid : null;
    } catch (err) {
      return null;
    }
  };

  const updateSelectedCount = (status) => {
    const count = document.querySelectorAll("li.es-book-item.is-selected").length;
    status.textContent = `選択中: ${count}枚`;
  };

  const toggleSelection = (li, checkbox, status) => {
    checkbox.checked = !checkbox.checked;
    li.classList.toggle("is-selected", checkbox.checked);
    updateSelectedCount(status);
  };

  const updateSelectionState = (li, checkbox, status) => {
    li.classList.toggle("is-selected", checkbox.checked);
    updateSelectedCount(status);
  };

  const setupSelectableList = (list, status) => {
    injectStyles();
    list.querySelectorAll("li").forEach((li) => {
      if (li.classList.contains("es-book-item")) return;
      const anchor = li.querySelector("a");
      if (!anchor) return;
      const mid = parseMidFromHref(anchor.href);
      if (!mid) return;

      li.classList.add("es-book-item");
      li.dataset.mid = mid;

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.className = "es-book-check";
      li.insertBefore(checkbox, li.firstChild);
      checkbox.addEventListener("change", () => {
        updateSelectionState(li, checkbox, status);
      });
    });

    if (!list.dataset.esBookSelectable) {
      list.dataset.esBookSelectable = "1";
      list.addEventListener("click", (event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;
        const li = target.closest("li.es-book-item");
        if (!li || !list.contains(li)) return;
        if (target.closest("button")) return;
        const checkbox = li.querySelector("input.es-book-check");
        if (!checkbox) return;
        if (target === checkbox) return;
        event.preventDefault();
        toggleSelection(li, checkbox, status);
      });
    }
  };

  const collectSelected = () => {
    return Array.from(document.querySelectorAll("li.es-book-item.is-selected"))
      .map((li) => {
        const mid = li.dataset.mid;
        if (!mid) return null;
        return { mid, li };
      })
      .filter(Boolean);
  };

  const buildMoveUrl = (cmd, mid) => {
    const url = new URL("/mcard_detail", location.origin);
    url.searchParams.set("cmd", cmd);
    url.searchParams.set("mid", mid);
    if (cmd === "a2") {
      url.searchParams.set("ex", "1");
    }
    return url.toString();
  };

  const runMove = async (cmd, status) => {
    const selections = collectSelected();
    if (!selections.length) {
      alert("選択されたモンスターがありません。");
      return;
    }

    let errors = 0;
    for (let i = 0; i < selections.length; i += 1) {
      status.textContent = `送信中 ${i + 1}/${selections.length}`;
      const { mid, li } = selections[i];
      try {
        const url = buildMoveUrl(cmd, mid);
        const response = await fetch(url, { credentials: "include" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        li.remove();
        updateSelectedCount(status);
      } catch (err) {
        errors += 1;
        console.warn("移動エラー", mid, err);
      }
      await sleep(REQUEST_DELAY_MS);
    }

    status.textContent = errors
      ? `完了(エラー:${errors})`
      : "完了";
  };

  const expandBookList = async () => {
    if (document.body.dataset.esBookExpanded === "1") {
      alert("すでに取得済みです。ページを再読み込みしてから実行してください。");
      return;
    }

    const list = document.querySelector("nav.block ul");
    if (!list) {
      alert("ブック一覧が見つかりません。ブック画面で実行してください。");
      return;
    }

    const currentPage = getCurrentPage();
    if (currentPage !== 1) {
      alert("1ページ目で実行してください。");
      return;
    }

    const ownedCount = parseOwnedCount();
    if (!ownedCount) {
      alert("枚数の取得に失敗しました。");
      return;
    }

    const totalPages = Math.ceil(ownedCount / PER_PAGE);
    const panel = buildPanel();
    if (totalPages <= 1) {
      panel.textContent = "追加ページはありません。";
      setTimeout(() => panel.remove(), 2000);
      return;
    }

    const errors = [];
    const fragment = document.createDocumentFragment();

    for (let page = 2; page <= totalPages; page += 1) {
      panel.textContent = `取得中 ${page - 1}/${totalPages - 1} ページ`;
      try {
        const url = buildPageUrl(page);
        const response = await fetch(url, { credentials: "include" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const html = await response.text();
        const items = extractListItems(html);
        if (!items.length) {
          throw new Error("一覧が取得できませんでした");
        }
        items.forEach((item) => fragment.appendChild(document.importNode(item, true)));
      } catch (err) {
        errors.push(`${page}ページ目: ${err.message}`);
      }
      await sleep(REQUEST_DELAY_MS);
    }

    list.appendChild(fragment);
    document.body.dataset.esBookExpanded = "1";

    if (errors.length) {
      panel.textContent = `完了: ${totalPages - 1}ページ / エラー: ${errors.length}`;
      console.warn("取得エラー", errors);
    } else {
      panel.textContent = "完了";
    }
    setTimeout(() => panel.remove(), 5000);
  };

  const init = async () => {
    await expandBookList();
    const list = document.querySelector("nav.block ul");
    if (!list) return;
    const { storeButton, bookButton, status } = buildActionPanel();
    setupSelectableList(list, status);
    updateSelectedCount(status);
    storeButton.addEventListener("click", () => runMove("a1", status));
    bookButton.addEventListener("click", () => runMove("a2", status));
  };

  init().catch((err) => alert("エラー: " + err.message));
})();
