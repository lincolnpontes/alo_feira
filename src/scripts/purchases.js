function registrarDesfazer(pa) { pilhaDesfazer.push([JSON.parse(JSON.stringify(pa))]); atualizarBotaoDesfazer(); }
    function desfazerAcao() { if(pilhaDesfazer.length === 0) return; let last = pilhaDesfazer.pop(); let itensRestore = Array.isArray(last) ? last : [last]; itensRestore.forEach(itemBackup => { let idx = db.pedidosAtivos.findIndex(x => x.idUnico === itemBackup.idUnico); if(idx !== -1) { itemBackup.dataStatus = Date.now(); db.pedidosAtivos[idx] = itemBackup; } }); db.configs.syncPendente = true; salvarBanco(); renderizarLista(); sincronizarFundo(false, true); atualizarBotaoDesfazer(); mostrarToast('Última alteração desfeita.', 'sucesso'); }
    function atualizarBotaoDesfazer() { const btn = document.getElementById('btnDesfazerBar'); if (db.configs.modo === 'compras' && pilhaDesfazer.length > 0 && !modoSelecaoAtivo) { btn.style.display = 'flex'; } else { btn.style.display = 'none'; } }

    let touchStartX = 0; let touchStartY = 0; let pressTimer; let isLongPress = false; let lastTap = 0; let lastTapId = null; let isScrolling = false;
    function handleTouchStart(e, el) { if(isModalFechando) return; touchStartX = e.changedTouches[0].screenX; touchStartY = e.changedTouches[0].screenY; isLongPress = false; isScrolling = false; pressTimer = setTimeout(() => { if (!isScrolling && db.configs.modo === 'compras') { isLongPress = true; abrirAcoesCompra(el.getAttribute('data-id'), el); } }, 650); }
    function handleTouchMove(e) { let diffY = Math.abs(e.changedTouches[0].screenY - touchStartY); let diffX = Math.abs(e.changedTouches[0].screenX - touchStartX); if (diffY > 10 || diffX > 10) { isScrolling = true; clearTimeout(pressTimer); } }
    function handleTouchEnd(e, el) {
        if(isModalFechando) return;
        clearTimeout(pressTimer);
        ultimoTouchEm = Date.now();
        if(isLongPress) return;
        const diffX = e.changedTouches[0].screenX - touchStartX;
        const diffY = Math.abs(e.changedTouches[0].screenY - touchStartY);
        if(diffY > 40 || (isScrolling && Math.abs(diffX) < 40)) return;
        const currentId = el.getAttribute('data-id');
        if(modoSelecaoAtivo && db.configs.modo === 'pedido') {
            if(itensSelecionadosRelatorio.has(currentId)) {
                itensSelecionadosRelatorio.delete(currentId);
                el.classList.remove('selecionado');
            } else {
                itensSelecionadosRelatorio.add(currentId);
                el.classList.add('selecionado');
            }
            return;
        }
        if(db.configs.modo === 'compras') {
            if(diffX < -70) abrirConfirmarCancelamento(currentId);
            else if(Math.abs(diffX) < 30) abrirAcoesCompra(currentId, el);
            return;
        }
        if(Math.abs(diffX) < 30) {
            const currentTime = Date.now();
            const tapLength = currentTime - lastTap;
            if(tapLength < 350 && tapLength > 0 && lastTapId === currentId) acaoDuploToque(el);
            else acaoToqueSimples(el);
            lastTap = currentTime;
            lastTapId = currentId;
        } else if(diffX < -60) {
            acaoDeslizarEsquerda(el);
        }
    }

    function getPermissaoColab() { let c = db.colaboradores.find(col => col.id === db.configs.colabAtivoId); return c ? (c.apenasReceber || false) : false; }

    function acaoToqueSimples(el) { if(db.configs.modo === 'compras') return abrirAcoesCompra(el.getAttribute('data-id'), el); const pId = el.getAttribute('data-id'); const pedId = el.getAttribute('data-pedid'); if(!pedId) { const p = db.produtos.find(x => x.id === pId); if(!p) return; let qtd = (p.qtdPadrao !== null && p.qtdPadrao !== '') ? p.qtdPadrao : ''; let un = p.unidades[0] || ''; let obsPad = p.obsPadrao || ''; let novoPedId = 'pa_' + Date.now() + '_' + Math.random().toString(36).slice(2,7); db.pedidosAtivos.push({ idUnico: novoPedId, produtoId: pId, qtd: qtd, unidade: un, obs: obsPad, status: 'rascunho', dataStatus: Date.now(), excluido: false, historico: [], colaboradorId: db.configs.colabAtivoId }); salvarBanco(); renderizarLista(); } else { mostrarToast('Este item já está no fluxo de compra.', 'info'); } }
    function acaoDuploToque(el) { if(db.configs.modo === 'pedido') { const pId = el.getAttribute('data-id'); const pedidosDeste = db.pedidosAtivos.filter(pa => pa.produtoId === pId && !pa.excluido && (pa.status === 'rascunho' || pa.status === 'pendente' || pa.status === 'pedido_forn')); const pedidoEditavel = pedidosDeste[pedidosDeste.length-1]; if(pedidoEditavel && pedidoEditavel.status !== 'rascunho') { let colabLogado = db.colaboradores.find(c => c.id === db.configs.colabAtivoId); let isAdmin = temAcessoAdmin(); if(!isAdmin && pedidoEditavel.colaboradorId !== db.configs.colabAtivoId) { return alert("🔒 Acesso Negado: Você só pode visualizar e editar pedidos que foram enviados pelo seu próprio perfil."); } } abrirModalEditarPedido(pedidoEditavel ? pedidoEditavel.idUnico : null, pId); } else { if (getPermissaoColab()) return alert("Seu perfil não permite editar os detalhes das compras."); const paId = el.getAttribute('data-id'); const pa = db.pedidosAtivos.find(x => x.idUnico === paId); if(pa && !pa.excluido) { abrirHistoricoCompra(paId); } } }
    function acaoSegurar(el) { if(db.configs.modo === 'compras') abrirAcoesCompra(el.getAttribute('data-id'), el); }
    function acaoDeslizarDireita(el) { if(db.configs.modo === 'compras') abrirAcoesCompra(el.getAttribute('data-id'), el); }
    function abrirConfirmarCancelamento(paId) { const pa = db.pedidosAtivos.find(x => x.idUnico === paId); if(!pa) return; const p = db.produtos.find(prod => prod.id === pa.produtoId); document.getElementById('cancelamentoCompraId').value = paId; document.getElementById('textoConfirmarCancelamento').innerHTML = `<b>${escaparHtml(p ? p.nome : 'Este item')}</b>`; document.getElementById('modalConfirmarCancelamento').style.display = 'flex'; }
    function confirmarCancelamentoCompra() { const paId = document.getElementById('cancelamentoCompraId').value; const pa = db.pedidosAtivos.find(x => x.idUnico === paId); if(!pa) return fecharModal('modalConfirmarCancelamento'); registrarDesfazer(pa); delete pa.transicaoProgresso; delete pa.statusAnterior; pa.status = 'cancelado'; pa.dataStatus = Date.now(); delete pa.dataConclusao; delete pa.dataPedidoFornecedor; db.configs.syncPendente = true; salvarBanco(); fecharModal('modalConfirmarCancelamento'); fecharMenuAcaoCompra(); renderizarLista(); sincronizarFundo(false, true); mostrarToast('Item cancelado. Você pode desfazer.', 'sucesso'); }
    function acaoDeslizarEsquerda(el) { if(db.configs.modo === 'compras') return abrirConfirmarCancelamento(el.getAttribute('data-id')); const pedId = el.getAttribute('data-pedid'); if(!pedId) return; const pa = db.pedidosAtivos.find(x => x.idUnico === pedId); if(pa && pa.status === 'rascunho' && confirm('Remover este item do pedido em preparação?')) { db.pedidosAtivos = db.pedidosAtivos.filter(x => x.idUnico !== pedId); salvarBanco(); renderizarLista(); } }

    function rotuloStatusCompra(status) {
        return { pendente:'Pendente', pedido_forn:'Pedido ao fornecedor', comprado:'Comprado', entregue:'Recebido', cancelado:'Cancelado' }[status] || status;
    }

    function botaoAcaoCompra(acao, icone, titulo, classe) {
        return `<button class="menu-compra-acao ${classe}" type="button" role="menuitem" onclick="executarAcaoCompra('${acao}')"><span class="menu-compra-icone" aria-hidden="true">${icone}</span><span>${titulo}</span></button>`;
    }

    function fecharMenuAcaoCompra() {
        const overlay = document.getElementById('modalAcaoCompra');
        if(overlay) overlay.style.display = 'none';
        modalAcaoCompraId = null;
    }

    function posicionarMenuAcaoCompra(origemEl) {
        const menu = document.getElementById('menuAcaoCompra');
        const margem = 10;
        const largura = Math.min(270, window.innerWidth - margem * 2);
        menu.style.width = `${largura}px`;
        const origem = origemEl && origemEl.getBoundingClientRect ? origemEl.getBoundingClientRect() : null;
        const altura = menu.offsetHeight;
        let esquerda = origem ? origem.right - largura - 10 : (window.innerWidth - largura) / 2;
        esquerda = Math.max(margem, Math.min(esquerda, window.innerWidth - largura - margem));
        let topo = origem ? origem.bottom + 6 : (window.innerHeight - altura) / 2;
        if(topo + altura > window.innerHeight - margem && origem) topo = origem.top - altura - 6;
        topo = Math.max(margem, Math.min(topo, window.innerHeight - altura - margem));
        menu.style.left = `${Math.round(esquerda)}px`;
        menu.style.top = `${Math.round(topo)}px`;
    }

    function abrirAcoesCompra(paId, origemEl = null) {
        const pa = db.pedidosAtivos.find(x => x.idUnico === paId);
        if(!pa || pa.excluido) return;
        const p = db.produtos.find(prod => prod.id === pa.produtoId);
        if(!p) return;
        modalAcaoCompraId = paId;
        const apenasReceber = getPermissaoColab();
        let html = '';
        if(pa.status === 'pendente' && !apenasReceber) {
            html += botaoAcaoCompra('comprado', '✓', 'Comprado', 'comprado');
            html += botaoAcaoCompra('pedido_forn', '↗', 'Pedido ao fornecedor', 'fornecedor');
        } else if(pa.status === 'pedido_forn') {
            html += botaoAcaoCompra('entregue', '✓', 'Comprado', 'comprado');
            if(!apenasReceber) html += botaoAcaoCompra('voltar_pendente', '←', 'Voltar a pendente', 'secundaria');
        } else if(pa.status === 'comprado' && !apenasReceber) {
            html += botaoAcaoCompra('voltar_pendente', '←', 'Voltar a pendente', 'secundaria');
        } else if(pa.status === 'entregue' && !apenasReceber) {
            html += botaoAcaoCompra('voltar_fornecedor', '←', 'Voltar ao fornecedor', 'secundaria');
        } else if(pa.status === 'cancelado' && !apenasReceber) {
            html += botaoAcaoCompra('restaurar', '↶', 'Restaurar', 'secundaria');
        }
        if(!apenasReceber) html += botaoAcaoCompra('detalhes', 'i', 'Detalhes', 'detalhes');
        if(!apenasReceber && (pa.status === 'pendente' || pa.status === 'pedido_forn')) html += botaoAcaoCompra('cancelar', '×', 'Cancelar item', 'cancelar');
        if(!html) return mostrarToast('Nenhuma ação disponível.', 'info');
        document.getElementById('acoesDisponiveisCompra').innerHTML = html;
        document.getElementById('modalAcaoCompra').style.display = 'block';
        posicionarMenuAcaoCompra(origemEl);
    }

    function abrirDetalhesDaAcaoCompra() {
        const paId = modalAcaoCompraId;
        fecharMenuAcaoCompra();
        if(paId) abrirHistoricoCompra(paId);
    }

    function voltarStatusCompra(pa, destino) {
        if(getPermissaoColab()) return false;
        registrarDesfazer(pa);
        delete pa.transicaoProgresso;
        delete pa.statusAnterior;
        pa.status = destino;
        pa.dataStatus = Date.now();
        delete pa.dataConclusao;
        if(destino === 'pendente') delete pa.dataPedidoFornecedor;
        if(destino === 'pedido_forn' && !pa.dataPedidoFornecedor) pa.dataPedidoFornecedor = pa.dataStatus;
        return true;
    }

    function executarAcaoCompra(acao) {
        const pa = db.pedidosAtivos.find(x => x.idUnico === modalAcaoCompraId);
        if(!pa) return fecharMenuAcaoCompra();
        if(acao === 'detalhes') return abrirDetalhesDaAcaoCompra();
        if(acao === 'cancelar') {
            fecharMenuAcaoCompra();
            abrirConfirmarCancelamento(pa.idUnico);
            return;
        }
        let alterou = false;
        if(['pedido_forn', 'comprado', 'entregue'].includes(acao)) {
            const backup = JSON.parse(JSON.stringify(pa));
            const resultado = AloFeiraDomain.aplicarTransicao(pa, acao, Date.now(), getPermissaoColab());
            if(resultado.ok) { pilhaDesfazer.push([backup]); atualizarBotaoDesfazer(); alterou = true; }
            else return mostrarToast(resultado.motivo, 'erro');
        } else if(acao === 'voltar_pendente' || acao === 'restaurar') {
            alterou = voltarStatusCompra(pa, 'pendente');
        } else if(acao === 'voltar_fornecedor') {
            alterou = voltarStatusCompra(pa, 'pedido_forn');
        }
        if(!alterou) return;
        db.configs.syncPendente = true;
        salvarBanco();
        fecharMenuAcaoCompra();
        renderizarLista();
        sincronizarFundo(false, true);
        mostrarToast(`Item marcado como ${rotuloStatusCompra(pa.status).toLowerCase()}.`, 'sucesso');
    }

    function deletarPrecoDireto(pId, idx, paId) { if(confirm("Excluir este preço do histórico?")) { let p = db.produtos.find(x => x.id === pId); if(p && p.historicoPrecos) { p.historicoPrecos.splice(idx, 1); marcarMudancaEstrutural(p); sincronizarFundo(false, true); if (document.getElementById('modalHistoricoCompra').style.display === 'flex') { abrirHistoricoCompra(paId); } else if(document.getElementById('modalEditarPedido').style.display === 'flex') { abrirModalEditarPedido(paId, pId); } else { abrirFormProduto(pId); } } } }
    function deletarPedidoDireto(idUnico, pId, paId) { if(confirm("Excluir este pedido do histórico geral?")) { let pa = db.pedidosAtivos.find(x => x.idUnico === idUnico); if(pa) { pa.excluido = true; pa.excluidoCompras = true; pa.dataExclusao = Date.now(); pa.dataStatus = pa.dataExclusao; db.configs.syncPendente = true; salvarBanco(); sincronizarFundo(false, true); if(paId && paId !== idUnico) abrirModalEditarPedido(paId, pId); else abrirFormProduto(pId); } } }
