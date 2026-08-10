function registrarDesfazer(pa) { pilhaDesfazer.push([JSON.parse(JSON.stringify(pa))]); atualizarBotaoDesfazer(); }
    function desfazerAcao() { if(pilhaDesfazer.length === 0) return; let last = pilhaDesfazer.pop(); let itensRestore = Array.isArray(last) ? last : [last]; itensRestore.forEach(itemBackup => { let idx = db.pedidosAtivos.findIndex(x => x.idUnico === itemBackup.idUnico); if(idx !== -1) { itemBackup.dataStatus = Date.now(); db.pedidosAtivos[idx] = itemBackup; } }); db.configs.syncPendente = true; salvarBanco(); renderizarLista(); sincronizarFundo(false, true); atualizarBotaoDesfazer(); mostrarToast('Última alteração desfeita.', 'sucesso'); }
    function atualizarBotaoDesfazer() { const btn = document.getElementById('btnDesfazerBar'); if (db.configs.modo === 'compras' && pilhaDesfazer.length > 0 && !modoSelecaoAtivo) { btn.style.display = 'flex'; } else { btn.style.display = 'none'; } }

    let touchStartX = 0; let touchStartY = 0; let pressTimer; let isLongPress = false; let lastTap = 0; let lastTapId = null; let isScrolling = false;
    function handleTouchStart(e, el) { if(isModalFechando) return; touchStartX = e.changedTouches[0].screenX; touchStartY = e.changedTouches[0].screenY; isLongPress = false; isScrolling = false; pressTimer = setTimeout(() => { if (!isScrolling && db.configs.modo === 'compras') { isLongPress = true; abrirAcoesCompra(el.getAttribute('data-id')); } }, 650); }
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
        if(modoSelecaoAtivo) {
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
            else if(Math.abs(diffX) < 30) abrirAcoesCompra(currentId);
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

    function acaoToqueSimples(el) { if(db.configs.modo === 'compras') return abrirAcoesCompra(el.getAttribute('data-id')); const pId = el.getAttribute('data-id'); const pedId = el.getAttribute('data-pedid'); if(!pedId) { const p = db.produtos.find(x => x.id === pId); if(!p) return; let qtd = (p.qtdPadrao !== null && p.qtdPadrao !== '') ? p.qtdPadrao : ''; let un = p.unidades[0] || ''; let obsPad = p.obsPadrao || ''; let novoPedId = 'pa_' + Date.now() + '_' + Math.random().toString(36).slice(2,7); db.pedidosAtivos.push({ idUnico: novoPedId, produtoId: pId, qtd: qtd, unidade: un, obs: obsPad, status: 'rascunho', dataStatus: Date.now(), excluido: false, historico: [], colaboradorId: db.configs.colabAtivoId }); salvarBanco(); renderizarLista(); } else { mostrarToast('Este item já está no fluxo de compra.', 'info'); } }
    function acaoDuploToque(el) { if(db.configs.modo === 'pedido') { const pId = el.getAttribute('data-id'); const pedidosDeste = db.pedidosAtivos.filter(pa => pa.produtoId === pId && !pa.excluido && (pa.status === 'rascunho' || pa.status === 'pendente' || pa.status === 'pedido_forn')); const pedidoEditavel = pedidosDeste[pedidosDeste.length-1]; if(pedidoEditavel && pedidoEditavel.status !== 'rascunho') { let colabLogado = db.colaboradores.find(c => c.id === db.configs.colabAtivoId); let isAdmin = temAcessoAdmin(); if(!isAdmin && pedidoEditavel.colaboradorId !== db.configs.colabAtivoId) { return alert("🔒 Acesso Negado: Você só pode visualizar e editar pedidos que foram enviados pelo seu próprio perfil."); } } abrirModalEditarPedido(pedidoEditavel ? pedidoEditavel.idUnico : null, pId); } else { if (getPermissaoColab()) return alert("Seu perfil não permite editar os detalhes das compras."); const paId = el.getAttribute('data-id'); const pa = db.pedidosAtivos.find(x => x.idUnico === paId); if(pa && !pa.excluido) { abrirHistoricoCompra(paId); } } }
    function acaoSegurar(el) { if(db.configs.modo === 'compras' && !modoSelecaoAtivo) abrirAcoesCompra(el.getAttribute('data-id')); }
    function acaoDeslizarDireita(el) { if(db.configs.modo === 'compras') abrirAcoesCompra(el.getAttribute('data-id')); }
    function abrirConfirmarCancelamento(paId) { const pa = db.pedidosAtivos.find(x => x.idUnico === paId); if(!pa) return; const p = db.produtos.find(prod => prod.id === pa.produtoId); document.getElementById('cancelamentoCompraId').value = paId; document.getElementById('textoConfirmarCancelamento').innerHTML = `Deseja cancelar <b>${escaparHtml(p ? p.nome : 'este item')}</b>?<br><span style="font-size:12px; color:#666;">Ele ficará marcado como cancelado e poderá ser restaurado pelo botão de desfazer.</span>`; document.getElementById('modalConfirmarCancelamento').style.display = 'flex'; }
    function confirmarCancelamentoCompra() { const paId = document.getElementById('cancelamentoCompraId').value; const pa = db.pedidosAtivos.find(x => x.idUnico === paId); if(!pa) return fecharModal('modalConfirmarCancelamento'); registrarDesfazer(pa); delete pa.transicaoProgresso; delete pa.statusAnterior; pa.status = 'cancelado'; pa.dataStatus = Date.now(); delete pa.dataConclusao; delete pa.dataPedidoFornecedor; db.configs.syncPendente = true; salvarBanco(); fecharModal('modalConfirmarCancelamento'); fecharModal('modalAcaoCompra'); renderizarLista(); sincronizarFundo(false, true); mostrarToast('Item cancelado. Você pode desfazer.', 'sucesso'); }
    function acaoDeslizarEsquerda(el) { if(db.configs.modo === 'compras') return abrirAcoesCompra(el.getAttribute('data-id')); const pedId = el.getAttribute('data-pedid'); if(!pedId) return; const pa = db.pedidosAtivos.find(x => x.idUnico === pedId); if(pa && pa.status === 'rascunho' && confirm('Remover este item do pedido em preparação?')) { db.pedidosAtivos = db.pedidosAtivos.filter(x => x.idUnico !== pedId); salvarBanco(); renderizarLista(); } }

    function rotuloStatusCompra(status) {
        return { pendente:'Pendente', pedido_forn:'Pedido ao fornecedor', comprado:'Comprado', entregue:'Recebido', cancelado:'Cancelado' }[status] || status;
    }

    function botaoAcaoCompra(acao, icone, titulo, descricao, classe = '') {
        return `<button class="acao-status ${classe}" onclick="executarAcaoCompra('${acao}', this)"><span class="acao-icone">${icone}</span><span class="acao-texto">${titulo}<small>${descricao}</small></span></button>`;
    }

    function limparConfirmacaoAcaoCompra() {
        acaoCompraPendente = null;
        clearTimeout(timerConfirmacaoCompra);
        document.querySelectorAll('#acoesDisponiveisCompra .acao-status').forEach(btn => {
            btn.classList.remove('confirmando');
            const descricao = btn.querySelector('small');
            if(descricao && descricao.dataset.original) descricao.textContent = descricao.dataset.original;
        });
    }

    function confirmarToqueAcaoCompra(acao, botao) {
        if(acaoCompraPendente === acao && botao.classList.contains('confirmando')) {
            limparConfirmacaoAcaoCompra();
            return true;
        }
        limparConfirmacaoAcaoCompra();
        acaoCompraPendente = acao;
        botao.classList.add('confirmando');
        const descricao = botao.querySelector('small');
        if(descricao) {
            descricao.dataset.original = descricao.textContent;
            descricao.textContent = 'Toque novamente para confirmar.';
        }
        timerConfirmacaoCompra = setTimeout(limparConfirmacaoAcaoCompra, 3500);
        return false;
    }

    function abrirAcoesCompra(paId) {
        limparConfirmacaoAcaoCompra();
        const pa = db.pedidosAtivos.find(x => x.idUnico === paId);
        if(!pa || pa.excluido) return;
        const p = db.produtos.find(prod => prod.id === pa.produtoId);
        if(!p) return;
        modalAcaoCompraId = paId;
        document.getElementById('tituloAcaoCompra').textContent = p.nome;
        document.getElementById('statusAtualAcaoCompra').textContent = rotuloStatusCompra(pa.status);
        document.getElementById('descricaoAcaoCompra').textContent = pa.qtd !== '' ? `${pa.qtd} ${pa.unidade || ''}${pa.obs ? ' • ' + pa.obs : ''}` : (pa.obs || 'Escolha conscientemente a próxima situação deste item.');
        const apenasReceber = getPermissaoColab();
        let html = '';
        if(pa.status === 'pendente' && !apenasReceber) {
            html += botaoAcaoCompra('pedido_forn', '↗', 'Pedido ao fornecedor', 'Registra o momento exato desta indicação.', 'fornecedor');
            html += botaoAcaoCompra('comprado', '✓', 'Comprado agora', 'Para compras feitas diretamente, sem pedido prévio.', 'comprado');
            html += botaoAcaoCompra('cancelar', '×', 'Cancelar item', 'Pede confirmação antes de cancelar.', 'cancelar');
        } else if(pa.status === 'pedido_forn') {
            html += botaoAcaoCompra('entregue', '✓', 'Recebido agora', 'Conclui o item que estava com o fornecedor.', 'entregue');
            if(!apenasReceber) html += botaoAcaoCompra('voltar_pendente', '↶', 'Voltar para pendente', 'Corrige uma indicação feita por engano.');
        } else if(pa.status === 'comprado' && !apenasReceber) {
            html += botaoAcaoCompra('voltar_pendente', '↶', 'Voltar para pendente', 'Reabre este item para compra.');
        } else if(pa.status === 'entregue' && !apenasReceber) {
            html += botaoAcaoCompra('voltar_fornecedor', '↶', 'Voltar para pedido ao fornecedor', 'Reabre o recebimento sem alterar a data original do pedido.');
        } else if(pa.status === 'cancelado' && !apenasReceber) {
            html += botaoAcaoCompra('restaurar', '↶', 'Restaurar como pendente', 'Traz o item de volta para a lista de compras.');
        }
        if(!html) html = '<p class="sheet-description">Seu perfil não possui uma ação disponível para este status.</p>';
        document.getElementById('acoesDisponiveisCompra').innerHTML = html;
        document.querySelector('.btn-detalhes-compra').style.display = apenasReceber ? 'none' : 'block';
        document.getElementById('modalAcaoCompra').style.display = 'flex';
    }

    function abrirDetalhesDaAcaoCompra() {
        const paId = modalAcaoCompraId;
        fecharModal('modalAcaoCompra');
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

    function executarAcaoCompra(acao, botao) {
        const pa = db.pedidosAtivos.find(x => x.idUnico === modalAcaoCompraId);
        if(!pa) return fecharModal('modalAcaoCompra');
        if(acao === 'cancelar') {
            fecharModal('modalAcaoCompra');
            abrirConfirmarCancelamento(pa.idUnico);
            return;
        }
        if(!botao || !confirmarToqueAcaoCompra(acao, botao)) return;
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
        fecharModal('modalAcaoCompra');
        renderizarLista();
        sincronizarFundo(false, true);
        mostrarToast(`Item marcado como ${rotuloStatusCompra(pa.status).toLowerCase()}.`, 'sucesso');
    }

    function deletarPrecoDireto(pId, idx, paId) { if(confirm("Excluir este preço do histórico?")) { let p = db.produtos.find(x => x.id === pId); if(p && p.historicoPrecos) { p.historicoPrecos.splice(idx, 1); marcarMudancaEstrutural(p); sincronizarFundo(false, true); if (document.getElementById('modalHistoricoCompra').style.display === 'flex') { abrirHistoricoCompra(paId); } else if(document.getElementById('modalEditarPedido').style.display === 'flex') { abrirModalEditarPedido(paId, pId); } else { abrirFormProduto(pId); } } } }
    function deletarPedidoDireto(idUnico, pId, paId) { if(confirm("Excluir este pedido do histórico geral?")) { let pa = db.pedidosAtivos.find(x => x.idUnico === idUnico); if(pa) { pa.excluido = true; pa.excluidoCompras = true; pa.dataExclusao = Date.now(); pa.dataStatus = pa.dataExclusao; db.configs.syncPendente = true; salvarBanco(); sincronizarFundo(false, true); if(paId && paId !== idUnico) abrirModalEditarPedido(paId, pId); else abrirFormProduto(pId); } } }
