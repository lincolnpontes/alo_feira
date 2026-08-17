const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');

test('todos os scripts do navegador possuem sintaxe valida', () => {
  const scripts = fs.readdirSync(path.join(root, 'src', 'scripts')).filter(name => name.endsWith('.js'));
  scripts.push('../../service-worker.js');
  for(const name of scripts) {
    const file = name.startsWith('../') ? path.resolve(root, 'src', 'scripts', name) : path.join(root, 'src', 'scripts', name);
    assert.doesNotThrow(() => new vm.Script(fs.readFileSync(file, 'utf8'), { filename: file }));
  }
});

test('index referencia somente arquivos locais existentes', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const referencias = [...html.matchAll(/(?:src|href)="([^"#]+)"/g)]
    .map(match => match[1].split('?')[0])
    .filter(value => !value.startsWith('http') && value !== '');
  for(const referencia of referencias) {
    assert.equal(fs.existsSync(path.join(root, referencia)), true, `Arquivo ausente: ${referencia}`);
  }
  assert.equal(html.includes('relatColaborador'), false);
});

test('manifesto usa icones com as dimensoes declaradas', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
  assert.equal(manifest.id, './');
  assert.deepEqual(manifest.icons.map(icon => icon.sizes), ['192x192', '512x512']);
  manifest.icons.forEach(icon => assert.equal(fs.existsSync(path.join(root, icon.src)), true));
});

test('listas usam clique direto, selecao explicita e confirmacao segura', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const purchases = fs.readFileSync(path.join(root, 'src', 'scripts', 'purchases.js'), 'utf8');
  const catalog = fs.readFileSync(path.join(root, 'src', 'scripts', 'catalog.js'), 'utf8');
  const orders = fs.readFileSync(path.join(root, 'src', 'scripts', 'orders.js'), 'utf8');
  const details = fs.readFileSync(path.join(root, 'src', 'scripts', 'purchase-details.js'), 'utf8');
  const layout = fs.readFileSync(path.join(root, 'src', 'styles', 'layout.css'), 'utf8');
  const scripts = fs.readdirSync(path.join(root, 'src', 'scripts')).filter(name => name.endsWith('.js')).map(name => fs.readFileSync(path.join(root, 'src', 'scripts', name), 'utf8')).join('\n');
  assert.match(html, /class="menu-compra"/);
  assert.doesNotMatch(html, /id="modalAcaoPedido"|id="btnMenuFerramentas"/);
  assert.match(orders, /Mostrar todos os itens/);
  assert.match(orders, /Filtrar por fornecedor/);
  assert.match(orders, /Agrupar por status/);
  assert.match(orders, /menu-ferramentas-separador[\s\S]*menu-categoria-item/);
  assert.match(html, /class="filtros-acoes"[\s\S]*id="btnHistHoje"[\s\S]*id="btnRelatorioBar"[\s\S]*id="btnLimparComprasBar"/);
  assert.match(html, /id="btnLimparComprasBar"/);
  assert.match(html, /id="btnRelatorioBar"[\s\S]*Relatório para fornecedor/);
  assert.match(html, /id="modalConfirmarRemoverRascunho"/);
  assert.match(html, /id="modalConfirmacaoApp"/);
  assert.doesNotMatch(scripts, /\bconfirm\s*\(/);
  assert.doesNotMatch(html, /id="btnModoSelecaoBar"|id="btnFiltroForn"|id="btnAgruparStatus"/);
  assert.doesNotMatch(html + purchases, /Escolha conscientemente|Registra o momento|Para compras feitas|Pede confirmação|Toque novamente/);
  assert.match(purchases, /botaoAcaoCompra\('comprado',[\s\S]*botaoAcaoCompra\('pedido_forn',[\s\S]*botaoAcaoCompra\('detalhes',[\s\S]*botaoAcaoCompra\('cancelar'/);
  assert.doesNotMatch(catalog + purchases, /ontouchstart|ontouchmove|ontouchend|handleTouch|acaoDeslizar/);
  assert.doesNotMatch(html + catalog + purchases, /✈/);
  assert.doesNotMatch(catalog, /✓ Todos/);
  assert.match(catalog, /class="seletor-item-compra"[\s\S]*selecionarItemCompraDireto/);
  assert.match(html + catalog + purchases, /m22 2-7 20-4-9-9-4 20-7Z/);
  assert.doesNotMatch(catalog + orders, /seletor-item-pedido|selecionarItemPedidoDireto|selecionarGrupoPedido/);
  assert.doesNotMatch(catalog, /class="item-avatar"/);
  assert.match(catalog, /item-status-pedido[\s\S]*status-glyph/);
  assert.match(orders, /function selecionarGrupoCompras[\s\S]*alternarSelecaoGrupo/);
  assert.match(orders, /function mostrarTodosCompras[\s\S]*function ativarAgrupamentoCompras/);
  assert.match(orders, /actionBarCompras'\)\.style\.display = compras && \(modoSelecaoAtivo \|\| temDesfazer\)/);
  assert.match(orders, /btn-busca-filtros[\s\S]*boxBuscaPedido/);
  assert.match(purchases, /pedido\.status === 'rascunho'\) abrirModalEditarPedido/);
  assert.match(details + html, /ultimo-pedido-label[\s\S]*btnRemoverPedidoEdicao/);
  assert.match(details + html, /abrirHistoricoCompletoPedido[\s\S]*modalHistoricoPedidosProduto/);
  assert.doesNotMatch(html, /btnHistoricoCompletoPedido[^>]+toggleDiv/);
  assert.match(catalog, /cat-header[\s\S]*background-color:\$\{corCategoria\}/);
  assert.match(layout, /\.cat-header \{[\s\S]*min-height:38px/);
  assert.match(purchases, /function abrirConfirmarRemoverRascunho[\s\S]*function confirmarRemocaoRascunho/);
});
