(function () {
  try {
    // --- Lv と MaxLv を取得 ---
    var h3 = document.querySelector('div.card_d header.card h3') || document.querySelector('h3');
    if (!h3) {
      alert('レベル情報が見つかりません');
      return;
    }
    var lvMatch = h3.textContent.match(/Lv\s*(\d+)\s*\/\s*(\d+)/i);
    if (!lvMatch) {
      alert('Lv/最大Lv の形式が見つかりません');
      return;
    }
    var level = parseInt(lvMatch[1], 10);
    var maxLevel = parseInt(lvMatch[2], 10);

    // --- レアリティ係数 ---
    var rc;
    switch (maxLevel) {
      case 30: rc = 1.0; break;
      case 50: rc = 1.5; break;
      case 70: rc = 2.0; break;
      case 90: rc = 2.5; break;
      default: rc = 1.0; // 想定外はとりあえず1
    }

    var t = (level - 1) / (maxLevel - 1);
    if (t < 0) t = 0;

    // --- Lv1素ステを逆算するヘルパー ---
    // currentTotal: 現在表示値（+込み）
    // bonus: 上昇値
    // isHP: HPかどうか
    function estimateLv1Base(currentTotal, bonus, isHP) {
      if (currentTotal <= 0) return 0;

      // レベル1なら (Lv1ステ + 上昇値) ≒ 現在値 なので単純に引く
      if (level <= 1) {
        return Math.max(1, currentTotal - bonus);
      }

      var factor;
      if (isHP) {
        factor = Math.sqrt(1 + rc * t);
      } else {
        factor = 1 + rc * t;
      }
      if (!isFinite(factor) || factor <= 0) {
        return Math.max(1, currentTotal - bonus);
      }

      // ここが修正ポイント：
      // 「レベル補正で割ってから上昇値を引く」
      var approx = currentTotal / factor - bonus;

      var best = Math.max(1, Math.floor(approx));
      var bestDiff = Math.abs(Math.floor((best + bonus) * factor) - currentTotal);

      // 近傍を探索して、公式に再投入した結果が currentTotal に最も近いものを探す
      var start = Math.max(1, Math.floor(approx) - 50);
      var end = Math.floor(approx) + 50;

      for (var cand = start; cand <= end; cand++) {
        var sim = Math.floor((cand + bonus) * factor);
        var diff = Math.abs(sim - currentTotal);
        if (sim === currentTotal) {
          return cand;
        }
        if (diff < bestDiff) {
          bestDiff = diff;
          best = cand;
        }
      }
      return best;
    }

    // --- ステータス表を取得 ---
    var capEls = Array.from(document.querySelectorAll('div.status table caption'));
    var cap = capEls.find(function (c) {
      return c.textContent.trim() === 'ステータス';
    });
    if (!cap) {
      alert('ステータス表が見つかりません');
      return;
    }

    var table = cap.closest('table');
    var rows = Array.from(table.querySelectorAll('tbody tr'));
    var targets = ['HP', '攻撃', '魔力', '防御', '命中', '敏捷'];
    var lines = [];

    var sumSq = 0; // 上昇率(小数)^2 の合計
    var count = 0;

    rows.forEach(function (tr) {
      var th = tr.querySelector('th');
      if (!th) return;

      var label = th.textContent.trim();
      if (targets.indexOf(label) === -1) return;

      // 表示用ラベル（HPだけ全角）
      var dlabel = (label === 'HP') ? 'ＨＰ' : label;

      var tds = tr.querySelectorAll('td');
      if (tds.length < 2) return;

      var val = tds[0].textContent.trim();
      var bonusTxt = tds[1].textContent.trim();

      // 現在の総ステータス（"2086/2086" → 2086）
      var currentTotal = parseInt(val.split('/')[0].replace(/[^\d\-]/g, ''), 10);
      if (isNaN(currentTotal)) return;

      // 上昇値 "(+186)" → 186
      var m = bonusTxt.match(/([+-]?\d+)/);
      var bonus = m ? parseInt(m[1], 10) : 0;

      var isHP = (label === 'HP');
      // ★修正版：currentTotalとbonusからLv1素ステを逆算
      var lv1Base = estimateLv1Base(currentTotal, bonus, isHP);
      if (lv1Base <= 0) return;

      var lv1Bonus = bonus;

      // Lv1基準の上昇率
      var pct = lv1Bonus / lv1Base * 100;
      var pctStr = (Math.abs(pct) < 10 ? ' ' : '') + pct.toFixed(1);

      // 表示用パディング
      var baseStr = String(lv1Base);
      var basePad = ' '.repeat(Math.max(0, 5 - baseStr.length)); // 5-桁数
      var bonusStr = String(lv1Bonus);
      var bonusPad = ' '.repeat(Math.max(0, 4 - bonusStr.length)); // 4-桁数

      lines.push(
        dlabel + ':' +
        basePad + baseStr +
        '+' + bonusPad + bonusStr +
        ' (+' + pctStr + '%)'
      );

      // 評価値計算用に小数上昇率を使用
      var r = pct / 100;
      sumSq += r * r;
      count++;
    });

    lines.push('-----------------------');

    // 評価値
    var evalValue = 10.0;
    if (count > 0) {
      var rms = Math.sqrt(sumSq / count);
      evalValue = rms * 200 + 10;
    }
    lines.push('評価値: ' + evalValue.toFixed(1));

    // --- 右上に表示用のボックス ---
    var box = document.createElement('div');
    box.style.cssText =
      'position:fixed;top:10px;right:10px;z-index:99999;' +
      'background:rgba(0,0,0,0.8);color:white;padding:10px 15px;' +
      'border-radius:8px;font-family:monospace;white-space:pre;' +
      'max-width:90%;cursor:pointer;font-size:14px;';
    box.textContent = lines.join('\n');
    box.onclick = function () { box.remove(); };
    document.body.appendChild(box);
  } catch (e) {
    alert('エラー:' + e.message);
  }
})();
