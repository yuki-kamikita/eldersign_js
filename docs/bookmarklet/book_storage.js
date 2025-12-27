(() => {
  const ACTION_PANEL_ID = "__es_book_action_panel";
  const REQUEST_DELAY_MS = 500;

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const buildActionPanel = () => {
    document.getElementById(ACTION_PANEL_ID)?.remove();
    const panel = document.createElement("div");
    panel.id = ACTION_PANEL_ID;
    panel.style.cssText =
      "position:fixed;bottom:40px;left:50%;transform:translateX(-50%);z-index:99999;" +
      "background:rgba(0,0,0,.8);color:#fff;padding:8px 10px;" +
      "border-radius:8px;font-family:monospace;font-size:12px;" +
      "max-width:calc(100% - 12px);display:flex;gap:6px;flex-wrap:nowrap;" +
      "align-items:center;white-space:nowrap;";

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
    const selectAllButton = makeButton("全選択");
    const status = document.createElement("span");
    status.textContent = "選択待ち";

    panel.appendChild(selectAllButton);
    panel.appendChild(storeButton);
    panel.appendChild(bookButton);
    panel.appendChild(status);
    document.body.appendChild(panel);

    return { panel, storeButton, bookButton, selectAllButton, status };
  };

  const injectStyles = () => {
    if (document.getElementById("__es_book_select_style")) return;
    const style = document.createElement("style");
    style.id = "__es_book_select_style";
    style.textContent =
      ".es-book-item{position:relative;}" +
      ".es-book-item a{cursor:pointer;display:block;border-radius:12px;position:relative;padding-right:40px;}" +
      ".es-book-check{position:absolute;right:14px;top:50%;transform:translateY(-50%);}" +
      ".es-book-item.is-selected a{" +
      "box-shadow:0 0 0 2px #f3e6c1 inset,0 0 0 4px rgba(81,51,18,.8);" +
      "}";
    document.head.appendChild(style);
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
      anchor.appendChild(checkbox);
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

  const setAllSelections = (checked, status) => {
    const items = document.querySelectorAll("li.es-book-item");
    items.forEach((li) => {
      const checkbox = li.querySelector("input.es-book-check");
      if (!checkbox) return;
      checkbox.checked = checked;
      updateSelectionState(li, checkbox, status);
    });
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

  const init = async () => {
    const list = document.querySelector("nav.block ul");
    if (!list) return;
    const { storeButton, bookButton, selectAllButton, status } = buildActionPanel();
    let nextSelectAll = true;
    setupSelectableList(list, status);
    updateSelectedCount(status);
    storeButton.addEventListener("click", () => runMove("a1", status));
    bookButton.addEventListener("click", () => runMove("a2", status));
    selectAllButton.addEventListener("click", () => {
      if (nextSelectAll) {
        setAllSelections(true, status);
        selectAllButton.textContent = "全削除";
      } else {
        setAllSelections(false, status);
        selectAllButton.textContent = "全選択";
      }
      nextSelectAll = !nextSelectAll;
    });
  };

  init().catch((err) => alert("エラー: " + err.message));
})();
