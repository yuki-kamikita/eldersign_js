javascript:(() => {
  // 選択文字を優先。無ければ<header><h2>の文字、さらに無ければ入力してもらう
  const selected = (window.getSelection?.().toString() ?? "").trim();
  const headerText = (document.querySelector("header h2")?.textContent ?? "").trim();
  const keyword = (selected || headerText || prompt("AtWiki検索する文字を入力", "") || "").trim();
  if (!keyword) return;

  const url =
    "https://w.atwiki.jp/eldersign/?cmd=wikisearch&andor=and&keyword=" +
    encodeURIComponent(keyword);

  // 現在ページは遷移させず、新しいタブで開く
  window.open(url, "_blank", "noopener,noreferrer");
})();
