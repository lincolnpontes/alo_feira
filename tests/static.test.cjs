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
  const drafts = fs.readFileSync(path.join(root, 'src', 'scripts', 'drafts.js'), 'utf8');
  const sync = fs.readFileSync(path.join(root, 'src', 'scripts', 'sync.js'), 'utf8');
  const settings = fs.readFileSync(path.join(root, 'src', 'scripts', 'settings.js'), 'utf8');
  const layout = fs.readFileSync(path.join(root, 'src', 'styles', 'layout.css'), 'utf8');
  const serviceWorker = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');
  const scripts = fs.readdirSync(path.join(root, 'src', 'scripts')).filter(name => name.endsWith('.js')).map(name => fs.readFileSync(path.join(root, 'src', 'scripts', name), 'utf8')).join('\n');
  assert.match(html, /class="menu-compra"/);
  assert.doesNotMatch(html, /id="modalAcaoPedido"|id="btnMenuFerramentas"/);
  assert.match(orders, /Mostrar todos os itens/);
  assert.match(orders, /Filtrar por fornecedor/);
  assert.match(orders, /Agrupar por status/);
  assert.match(orders, /menu-ferramentas-separador[\s\S]*Agrupar por categoria:[\s\S]*menu-categoria-item/);
  assert.match(html, /id="filtrosCentroCompras"[\s\S]*id="acoesSelecaoCompras"[\s\S]*id="btnDesfazerBar"[\s\S]*class="filtros-acoes"[\s\S]*id="btnRelatorioBar"[\s\S]*id="btnLimparComprasBar"/);
  assert.match(html, /id="acoesSelecaoCompras"[\s\S]*id="btnMassaPedForn"[\s\S]*id="btnMassaComprado"[\s\S]*id="btnMassaVincular"/);
  assert.match(html, /id="btnLimparComprasBar"/);
  assert.match(html, /id="btnRelatorioBar"[\s\S]*Relatório para fornecedor/);
  assert.doesNotMatch(html + purchases, /modalConfirmarRemoverRascunho|abrirConfirmarRemoverRascunho/);
  assert.match(html, /id="modalConfirmacaoApp"/);
  assert.doesNotMatch(scripts, /\bconfirm\s*\(/);
  assert.doesNotMatch(html, /id="btnModoSelecaoBar"|id="btnFiltroForn"|id="btnAgruparStatus"/);
  assert.doesNotMatch(html + purchases, /Escolha conscientemente|Registra o momento|Para compras feitas|Pede confirmação|Toque novamente/);
  assert.match(purchases, /botaoAcaoCompra\('comprado',[\s\S]*botaoAcaoCompra\('pedido_forn',[\s\S]*botaoAcaoCompra\('preco',[\s\S]*botaoAcaoCompra\('detalhes',[\s\S]*botaoAcaoCompra\('cancelar'/);
  assert.match(html + purchases, /modalPrecoRapido[\s\S]*precoRapidoValor[\s\S]*precoRapidoFornecedor[\s\S]*historicoPrecoRapido[\s\S]*salvarPrecoRapido/);
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
  assert.doesNotMatch(html + layout + orders, /actionBarCompras|action-bar-compras|btn-action-bar/);
  assert.match(purchases, /classList\.toggle\('com-centro'/);
  assert.match(orders, /ocultoCompras = true; pa\.dataStatus = agora/);
  assert.match(orders, /\['comprado', 'entregue', 'cancelado'\]/);
  assert.match(orders, /btnLimpar\.style\.display = !pedido && !modoSelecaoAtivo \? 'inline-flex' : 'none'/);
  assert.match(orders, /btn-busca-filtros[\s\S]*boxBuscaPedido/);
  assert.match(purchases, /pedido\.status === 'rascunho'\) abrirModalEditarPedido/);
  assert.match(purchases, /function removerPedidoPelaEdicao[\s\S]*db\.pedidosAtivos = db\.pedidosAtivos\.filter/);
  assert.match(details + html, /ultimo-pedido-label[\s\S]*btnRemoverPedidoEdicao/);
  assert.match(details + html, /abrirHistoricoCompletoPedido[\s\S]*modalHistoricoPedidosProduto/);
  assert.doesNotMatch(html, /btnHistoricoCompletoPedido[^>]+toggleDiv/);
  assert.match(catalog, /cat-header[\s\S]*background-color:\$\{corCategoria\}/);
  assert.match(layout, /\.cat-header \{[\s\S]*min-height:38px/);
  assert.doesNotMatch(drafts, /sincronizarFundo\(true, false\)/);
  assert.match(drafts, /postarPedidosNovos\(rascunhos\)/);
  assert.match(sync, /meta=1/);
  assert.match(sync, /postarPedidosNovos[\s\S]*serverNow/);
  assert.match(sync, /atualizarBotaoPerfil\(\)[\s\S]*atualizarVisibilidadeAdmin\(\)/);
  assert.match(sync, /function sincronizarInicializacao[\s\S]*baixarBancoNuvem\(8000\)[\s\S]*aplicarNuvemNaInicializacao/);
  assert.doesNotMatch(sync, /temRascunho && db\.configs\.modo === 'pedido'/);
  assert.match(fs.readFileSync(path.join(root, 'src', 'scripts', 'app.js'), 'utf8'), /updateViaCache: 'none'/);
  assert.doesNotMatch(html, /Gerenciar Categorias<\/button>/);
  assert.match(html + settings, /btnCategoriasProdutos[\s\S]*abrirCategoriasDosProdutos/);
  assert.match(html, /btnCategoriasProdutos[\s\S]*🏷️[\s\S]*Categorias/);
  assert.match(html + settings, /btnFiltroGerenciarCat[\s\S]*modalFiltroCategoriasProdutos[\s\S]*selecionarFiltroCategoriaProduto/);
  assert.match(html, /class="header-profile"[\s\S]*id="btnTrocarPerfil"[\s\S]*class="header-actions"/);
  assert.match(html, /Alô Feira v1\.3\.2/);
  assert.match(html + serviceWorker, /v1\.3\.2-r4/);
  assert.doesNotMatch(html + serviceWorker, /v1\.3\.2-r3/);
  assert.doesNotMatch(html, /1\.3\.2-r[0-3]/);
});
