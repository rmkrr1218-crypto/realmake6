// Copy only on request. Never submit consultation text or amounts to analytics.
(function () {
  'use strict';
  const panel = document.getElementById('p3');
  const button = document.getElementById('estimate-copy');
  const message = document.getElementById('estimate-message');
  const status = document.getElementById('estimate-copy-status');
  const details = document.getElementById('estimate-copy-details');
  if (!panel || !button || !message) return;
  let revision = 0;
  const initialStatus = status.textContent;
  function prepare() {
    revision += 1;
    status.textContent = initialStatus;
    details.open = false;
    if (!panel.classList.contains('active')) { message.value = ''; return; }
    const conditions = Array.from(document.querySelectorAll('#summaryTags .stag'), el => el.textContent.trim());
    const rows = Array.from(document.querySelectorAll('#detailBody tr:not(.tr-total)'), row => {
      const cells = row.querySelectorAll('td');
      return `${cells[0].textContent.trim().replace(/\s+/g, ' ')}：${cells[2].textContent.trim()}円（目安）`;
    });
    message.value = [
      'Real Make 大川様', 'ホームページの概算費用チェックを利用しました。この条件でわが家の塗装について相談したいです。', '',
      '【入力条件】', ...conditions, '', '【概算合計・税込】',
      document.getElementById('totalMid').textContent.trim(),
      document.getElementById('totalRange').textContent.trim(), '',
      '【選択した工事の内訳・税抜目安／消費税】', ...rows, '',
      document.getElementById('estimate-exclusions')?.textContent || '', '',
      '※自動計算による概算です。正確な金額は現地確認後のお見積もりとなります。'
    ].join('\n');
  }
  new MutationObserver(prepare).observe(panel, { attributes: true, attributeFilter: ['class'] });
  button.addEventListener('click', async () => {
    if (!panel.classList.contains('active') || !message.value) return;
    const currentRevision = revision;
    button.disabled = true;
    try {
      if (!navigator.clipboard || !window.isSecureContext) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(message.value);
      if (currentRevision !== revision) return;
      status.textContent = '相談文をコピーしました。次にLINEを開き、トークの入力欄に貼り付けて送信してください。';
      try { window.gtag?.('event', 'simulator_result_copy', { copy_method: 'clipboard' }); } catch (_) { /* Optional analytics. */ }
    } catch (_) {
      if (currentRevision !== revision) return;
      details.open = true;
      message.focus();
      message.select();
      message.setSelectionRange(0, message.value.length);
      status.textContent = '自動コピーできませんでした。下の選択された文章を手動でコピーして、LINEに貼り付けてください。';
    } finally { button.disabled = false; }
  });
  prepare();
})();
