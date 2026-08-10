function atualizarEstadoSync(estado, mensagem) {
    const indicador = document.getElementById('syncIndicador');
    if(!indicador) return;
    indicador.className = `sync-indicador ${estado}`;
    indicador.title = mensagem || '';
    indicador.setAttribute('aria-label', mensagem || 'Estado da sincronização');
}

async function fetchComTimeout(url, options = {}, timeoutMs = 15000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, Object.assign({}, options, { signal: controller.signal }));
    } finally {
        clearTimeout(timer);
    }
}

async function lerRespostaJson(response) {
    if(!response.ok) throw new Error(`Servidor respondeu ${response.status}.`);
    const texto = await response.text();
    try { return JSON.parse(texto); }
    catch(e) { throw new Error('O servidor devolveu uma resposta inválida.'); }
}

function prepararBancoParaNuvem() {
    const copia = JSON.parse(JSON.stringify(db));
    copia.pedidosAtivos = copia.pedidosAtivos.filter(p => p.status !== 'rascunho');
    const configsLocais = ['url', 'colabAtivoId', 'modo', 'dadosBaixados', 'ultimoSyncConfirmado', 'syncPendente'];
    configsLocais.forEach(campo => delete copia.configs[campo]);
    delete copia.configs.senhaAdmin;
    return copia;
}

function mesclarColecao(locais, remotos) {
    const mapa = new Map();
    (remotos || []).forEach(item => { if(item && item.id) mapa.set(item.id, item); });
    (locais || []).forEach(item => {
        if(!item || !item.id) return;
        const remoto = mapa.get(item.id);
        const localTs = Number(item.atualizadoEm || 0);
        const remotoTs = Number(remoto && remoto.atualizadoEm || 0);
        if(!remoto || localTs > remotoTs) mapa.set(item.id, item);
    });
    return Array.from(mapa.values());
}

function mesclarBancos(local, remotoBruto) {
    const remoto = normalizarBanco(remotoBruto);
    const localNormalizado = normalizarBanco(local);
    const corteHistorico = Math.max(
        Number(localNormalizado.configs.historicoApagadoEm || 0),
        Number(remoto.configs.historicoApagadoEm || 0)
    );
    const pedidos = AloFeiraDomain.mesclarPedidos(
        localNormalizado.pedidosAtivos,
        remoto.pedidosAtivos,
        corteHistorico
    );
    const pedidosRemotos = AloFeiraDomain.mesclarPedidos([], remoto.pedidosAtivos, corteHistorico);
    const precisaEnviarPedidos = JSON.stringify(pedidos.filter(p => p.status !== 'rascunho')) !== JSON.stringify(pedidosRemotos);

    const banco = normalizarBanco(remoto);
    banco.pedidosAtivos = pedidos;
    banco.produtos = mesclarColecao(localNormalizado.produtos, remoto.produtos);
    banco.categorias = mesclarColecao(localNormalizado.categorias, remoto.categorias);
    banco.fornecedores = mesclarColecao(localNormalizado.fornecedores, remoto.fornecedores);
    banco.colaboradores = mesclarColecao(localNormalizado.colaboradores, remoto.colaboradores);

    const localRestTs = Number(localNormalizado.restaurante.atualizadoEm || 0);
    const remotoRestTs = Number(remoto.restaurante.atualizadoEm || 0);
    if(localRestTs > remotoRestTs) banco.restaurante = localNormalizado.restaurante;

    const locais = localNormalizado.configs;
    const remotos = remoto.configs;
    banco.configs = Object.assign({}, remotos, {
        url: locais.url,
        colabAtivoId: locais.colabAtivoId,
        modo: locais.modo,
        dadosBaixados: true,
        ultimoSyncConfirmado: locais.ultimoSyncConfirmado || 0,
        historicoApagadoEm: corteHistorico,
        syncPendente: Boolean(locais.syncPendente || precisaEnviarPedidos)
    });
    if(locais.senhaAdminHash && !banco.configs.senhaAdminHash) banco.configs.senhaAdminHash = locais.senhaAdminHash;
    if(locais.senhaAdmin && !banco.configs.senhaAdmin && !banco.configs.senhaAdminHash) banco.configs.senhaAdmin = locais.senhaAdmin;
    banco.syncRevision = Number(remoto.syncRevision || 0);

    const colecoesLocaisMaisNovas = ['produtos', 'categorias', 'fornecedores', 'colaboradores'].some(nome =>
        (localNormalizado[nome] || []).some(item => {
            const remotoItem = (remoto[nome] || []).find(outro => outro.id === item.id);
            return !remotoItem || Number(item.atualizadoEm || 0) > Number(remotoItem.atualizadoEm || 0);
        })
    );
    const precisaEnviar = banco.configs.syncPendente || colecoesLocaisMaisNovas || localRestTs > remotoRestTs;
    banco.configs.syncPendente = precisaEnviar;
    return { banco, precisaEnviar };
}

async function postarBanco({ forcar = false, permitirRetry = true } = {}) {
    const payload = {
        action: 'salvar_banco',
        dados: prepararBancoParaNuvem(),
        baseRevision: Number(db.syncRevision || 0),
        force: Boolean(forcar)
    };
    const response = await fetchComTimeout(db.configs.url, {
        method: 'POST',
        redirect: 'follow',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
    });
    const resposta = await lerRespostaJson(response);
    const validacao = AloFeiraDomain.validarRespostaServidor(resposta);

    if(validacao.conflito && permitirRetry && resposta.dados) {
        const resultado = mesclarBancos(db, resposta.dados);
        db = resultado.banco;
        db.syncRevision = Number(resposta.revision || db.syncRevision || 0);
        db.configs.syncPendente = true;
        salvarBanco();
        return postarBanco({ forcar: false, permitirRetry: false });
    }
    if(!validacao.ok) throw new Error(validacao.mensagem || 'O servidor não confirmou a gravação.');

    if(validacao.revision) db.syncRevision = validacao.revision;
    db.configs.syncPendente = false;
    db.configs.ultimoSyncConfirmado = Date.now();
    salvarBanco();
    return true;
}

function isUsuarioGerenciando() {
    return Array.from(document.querySelectorAll('.modal-overlay')).some(el => el.style.display === 'flex');
}

async function sincronizarFundo(forcado = false, apenasEmpurrar = false) {
    if(!db.configs.url) { atualizarEstadoSync('local', 'Dados somente neste aparelho'); return false; }
    if(isUsuarioGerenciando() && !forcado && !apenasEmpurrar) return false;
    if(isSyncingFundo) return false;
    if(document.hidden && !forcado && !apenasEmpurrar) return false;
    const temRascunho = db.pedidosAtivos.some(pa => pa.status === 'rascunho' && !pa.excluido);
    if(temRascunho && db.configs.modo === 'pedido' && !forcado && !apenasEmpurrar) return false;

    isSyncingFundo = true;
    atualizarEstadoSync('sincronizando', 'Sincronizando com a nuvem');
    try {
        let precisaEnviar = Boolean(apenasEmpurrar || db.configs.syncPendente);
        if(!apenasEmpurrar) {
            const fetchUrl = db.configs.url + (db.configs.url.includes('?') ? '&' : '?') + 'nocache=' + Date.now();
            const response = await fetchComTimeout(fetchUrl, { redirect: 'follow', cache: 'no-store' });
            const nuvem = await lerRespostaJson(response);
            if(!nuvem || nuvem.app_id !== 'alofeira') throw new Error('Banco da nuvem inválido.');
            const resultado = mesclarBancos(db, nuvem);
            db = resultado.banco;
            precisaEnviar = precisaEnviar || resultado.precisaEnviar;
            salvarBanco();
            if(!isUsuarioGerenciando()) {
                renderizarFiltros();
                renderizarLista();
            }
        }
        if(precisaEnviar) await postarBanco();
        db.configs.ultimoSyncConfirmado = Date.now();
        salvarBanco();
        atualizarEstadoSync('sincronizado', 'Dados confirmados na nuvem');
        setTimeout(() => atualizarEstadoSync('oculto', 'Dados confirmados na nuvem'), 1800);
        return true;
    } catch(e) {
        db.configs.syncPendente = true;
        salvarBanco();
        atualizarEstadoSync(navigator.onLine ? 'erro' : 'offline', navigator.onLine ? 'Falha ao sincronizar' : 'Sem internet; alterações guardadas no aparelho');
        console.error('Erro na sincronização de fundo', e);
        if(forcado) mostrarToast(e.message || 'Não foi possível sincronizar agora.', 'erro', 5000);
        return false;
    } finally {
        isSyncingFundo = false;
    }
}

async function salvarURL() {
    const inputUrl = document.getElementById('configUrlApp').value.trim();
    if(!inputUrl) return alert('Digite a URL primeiro.');
    document.getElementById('loadingOverlay').style.display = 'flex';
    document.getElementById('loadingText').textContent = 'Conectando e conferindo os dados...';
    try {
        const fetchUrl = inputUrl + (inputUrl.includes('?') ? '&' : '?') + 'nocache=' + Date.now();
        const response = await fetchComTimeout(fetchUrl, { redirect: 'follow', cache: 'no-store' });
        const nuvem = await lerRespostaJson(response);
        if(!nuvem || nuvem.app_id !== 'alofeira') throw new Error('Não encontrei um banco válido nesse endereço.');
        db.configs.url = inputUrl;
        const resultado = mesclarBancos(db, nuvem);
        db = resultado.banco;
        db.configs.url = inputUrl;
        db.configs.dadosBaixados = true;
        salvarBanco();
        alert('Conexão estabelecida. Os dados deste aparelho e da nuvem foram conferidos.');
        location.reload();
    } catch(e) {
        alert(`Não foi possível conectar. ${e.message}`);
    } finally {
        document.getElementById('loadingOverlay').style.display = 'none';
    }
}

function exportarDados() {
    const copia = JSON.parse(JSON.stringify(db));
    delete copia.configs.url;
    delete copia.configs.colabAtivoId;
    delete copia.configs.senhaAdmin;
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(copia, null, 2));
    const link = document.createElement('a');
    link.href = dataStr;
    link.download = 'alofeira_bkp_' + getHojeSTR() + '.json';
    document.body.appendChild(link);
    link.click();
    link.remove();
    mostrarToast('Backup exportado.', 'sucesso');
}

function importarDados(event) {
    const file = event.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importado = JSON.parse(e.target.result);
            if(!importado || importado.app_id !== 'alofeira') throw new Error('Arquivo de backup inválido.');
            if(!confirm('Importar este backup e substituir os dados deste aparelho? A cópia atual continuará na nuvem até você sincronizar.')) return;
            const urlSalva = db.configs.url;
            db = normalizarBanco(importado);
            db.configs.url = urlSalva || '';
            db.configs.ultimaMudancaLocal = Date.now();
            db.configs.syncPendente = true;
            salvarBanco();
            alert('Backup importado neste aparelho. Confira os dados e use “Forçar envio” para substituir a nuvem.');
            location.reload();
        } catch(err) {
            alert(err.message || 'Erro ao ler o arquivo.');
        }
    };
    reader.readAsText(file);
    event.target.value = '';
}

async function forcarEnvioNuvemCompleto() {
    if(!db.configs.url) return alert('Configure primeiro a URL do Google Script.');
    if(!confirm('Forçar o envio substitui a versão atual da nuvem por este aparelho. Deseja continuar?')) return;
    document.getElementById('loadingOverlay').style.display = 'flex';
    document.getElementById('loadingText').textContent = 'Gravando a cópia completa na nuvem...';
    try {
        isSyncingFundo = true;
        await postarBanco({ forcar: true, permitirRetry: false });
        alert('Dados confirmados e gravados na nuvem.');
    } catch(e) {
        alert(`A nuvem não confirmou a gravação. Nada foi dado como concluído. ${e.message}`);
    } finally {
        isSyncingFundo = false;
        document.getElementById('loadingOverlay').style.display = 'none';
    }
}

async function excluirTodoHistorico() {
    const frase = document.getElementById('inputExcluirTudo').value.trim().toLowerCase();
    if(frase !== 'quero excluir todo o histórico') return alert('Frase incorreta.');
    if(!confirm('Apagar todos os pedidos em todos os aparelhos? Produtos, categorias, fornecedores e perfis serão mantidos.')) return;
    const backup = JSON.parse(JSON.stringify(db));
    db.configs.historicoApagadoEm = Date.now();
    db.pedidosAtivos = [];
    db.produtos = db.produtos.filter(p => !p.avulso);
    marcarMudancaEstrutural();
    document.getElementById('loadingOverlay').style.display = 'flex';
    document.getElementById('loadingText').textContent = 'Apagando o histórico com segurança...';
    try {
        if(db.configs.url) {
            isSyncingFundo = true;
            await postarBanco();
        }
        alert('Histórico apagado. Aparelhos antigos respeitarão esta exclusão quando voltarem a sincronizar.');
        document.getElementById('inputExcluirTudo').value = '';
        fecharModal('modalConfigAvancadas');
        renderizarLista();
    } catch(e) {
        db = backup;
        salvarBanco();
        alert(`Não foi possível confirmar a exclusão na nuvem. O histórico foi restaurado neste aparelho. ${e.message}`);
    } finally {
        isSyncingFundo = false;
        document.getElementById('loadingOverlay').style.display = 'none';
    }
}

async function forcarAtualizacao() {
    if(!confirm('Buscar a versão mais recente do aplicativo sem apagar seus dados?')) return;
    if('serviceWorker' in navigator) {
        const registros = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registros.map(registro => registro.update()));
    }
    window.location.href = window.location.pathname + '?nocache=' + Date.now();
}

setInterval(() => sincronizarFundo(false, false), 20000);
window.addEventListener('online', () => sincronizarFundo(false, false));
window.addEventListener('offline', () => atualizarEstadoSync('offline', 'Sem internet; alterações guardadas no aparelho'));
