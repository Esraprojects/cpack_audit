/* Optional Claude AI strategy advice.
   Calls the Anthropic API straight from the browser with the owner's own key. */
(function (global) {
  'use strict';
  var E = global.Esra = global.Esra || {};
  var KEY_STORE = 'cpackAudit.claudeKey';
  var SDK_URL = 'https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@0.129.0/+esm';
  var MODEL = 'claude-opus-5-5';

  function getKey() { try { return localStorage.getItem(KEY_STORE) || ''; } catch (e) { return ''; } }
  function setKey(k) { try { if (k) localStorage.setItem(KEY_STORE, k); else localStorage.removeItem(KEY_STORE); return true; } catch (e) { return false; } }

  var SYSTEM = [
    'You are a practical business advisor for a small printing, packaging-material and training business in Ethiopia that keeps its books in the CPack Audit app.',
    'Products include paper and board (duplex, kaki, white top, food grade, art paper and others), lacquer, frames, print packages and trainings. Prices are in Ethiopian Birr.',
    'You receive a JSON financial report for one period. "initialCost" is the cost of goods sold recorded with each sale; "expenses" are separate payments made (materials bought, suppliers, other costs). Pure profit = sales - initialCost - expenses.',
    'Write for the owner, who is not an accountant: short sentences, concrete numbers from the report, no jargon.',
    'Structure the answer as: a two-sentence summary of how the business is doing; then "Strategies" with 4 to 6 numbered, specific actions (each naming the product, price or customer group it concerns and the expected effect); then "Watch out" with up to 3 risks.',
    'Base every claim on the numbers given. If the data is too thin to support a point, say so instead of guessing. Use Markdown headings and lists.'
  ].join(' ');

  async function ask(report, onText) {
    var apiKey = getKey();
    if (!apiKey) throw new Error('Add your Anthropic API key in “Data & settings” first.');

    var mod;
    try {
      mod = await import(SDK_URL);
    } catch (e) {
      throw new Error('Could not load the Claude library. Check the internet connection.');
    }
    var Anthropic = mod.default || mod.Anthropic;
    var client = new Anthropic({ apiKey: apiKey, dangerouslyAllowBrowser: true });

    try {
      var stream = client.beta.messages.stream({
        model: MODEL,
        max_tokens: 16000,
        thinking: { type: 'adaptive' },
        output_config: { effort: 'medium' },
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        system: SYSTEM,
        messages: [{
          role: 'user',
          content: 'Here is the financial report. Suggest strategies to grow profit.\n\n' + JSON.stringify(report, null, 2)
        }]
      });
      stream.on('text', function (t) { onText(t); });
      var msg = await stream.finalMessage();
      if (msg.stop_reason === 'refusal') {
        throw new Error('Claude declined this request' + (msg.stop_details && msg.stop_details.explanation ? ': ' + msg.stop_details.explanation : '.'));
      }
      if (msg.stop_reason === 'max_tokens') onText('\n\n_(Answer was cut short.)_');
      return msg;
    } catch (err) {
      throw friendlyError(err, Anthropic);
    }
  }

  function friendlyError(err, Anthropic) {
    if (Anthropic.AuthenticationError && err instanceof Anthropic.AuthenticationError) return new Error('The API key was rejected. Check it in “Data & settings”.');
    if (Anthropic.PermissionDeniedError && err instanceof Anthropic.PermissionDeniedError) return new Error('This API key is not allowed to use the model.');
    if (Anthropic.RateLimitError && err instanceof Anthropic.RateLimitError) return new Error('Too many requests right now. Wait a minute and try again.');
    if (Anthropic.APIConnectionError && err instanceof Anthropic.APIConnectionError) return new Error('Could not reach Claude. Check the internet connection.');
    if (Anthropic.APIError && err instanceof Anthropic.APIError) return new Error('Claude returned an error (' + (err.status || '?') + '): ' + (err.message || ''));
    return err instanceof Error ? err : new Error(String(err));
  }

  // Minimal, safe Markdown -> HTML for the advice text.
  function renderMarkdown(md) {
    var esc = E.charts.esc;
    var lines = String(md).split('\n');
    var html = '', list = null;
    function inline(s) {
      return esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/(^|[^*])\*(?!\s)(.+?)\*/g, '$1<em>$2</em>').replace(/_(.+?)_/g, '<em>$1</em>');
    }
    function close() { if (list) { html += '</' + list + '>'; list = null; } }
    lines.forEach(function (line) {
      var m;
      if ((m = line.match(/^#{1,6}\s+(.*)/))) { close(); html += '<h4>' + inline(m[1]) + '</h4>'; }
      else if ((m = line.match(/^\s*[-*•]\s+(.*)/))) { if (list !== 'ul') { close(); html += '<ul>'; list = 'ul'; } html += '<li>' + inline(m[1]) + '</li>'; }
      else if ((m = line.match(/^\s*\d+[.)]\s+(.*)/))) { if (list !== 'ol') { close(); html += '<ol>'; list = 'ol'; } html += '<li>' + inline(m[1]) + '</li>'; }
      else if (line.trim() === '') { close(); }
      else { close(); html += '<p>' + inline(line) + '</p>'; }
    });
    close();
    return html;
  }

  E.ai = { ask: ask, getKey: getKey, setKey: setKey, renderMarkdown: renderMarkdown, MODEL: MODEL };
})(window);
