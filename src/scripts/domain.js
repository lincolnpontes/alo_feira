(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    root.AloFeiraDomain = api;
})(typeof globalThis !== 'undefined' ? globalThis : window, function () {
    function numeroSeguro(valor, fallback = 0) {
        const numero = Number(valor);
        return Number.isFinite(numero) ? numero : fallback;
    }

    function timestampPedido(pedido) {
        if (!pedido) return 0;
        return Math.max(
            numeroSeguro(pedido.dataStatus),
            numeroSeguro(pedido.dataExclusao),
            numeroSeguro(pedido.dataConclusao),
            numeroSeguro(pedido.dataPedidoFornecedor),
            numeroSeguro(pedido.dataEnvio)
        );
    }

    function mesclarPedidos(locais = [], remotos = [], apagadoEm = 0) {
        const mesclados = new Map();
        const considerar = (pedido, origemLocal) => {
            if (!pedido || !pedido.idUnico) return;
            const timestamp = timestampPedido(pedido);
            if (timestamp && timestamp <= apagadoEm) return;
            if (!origemLocal && pedido.status === 'rascunho') return;
            const atual = mesclados.get(pedido.idUnico);
            if (!atual || timestamp >= timestampPedido(atual)) {
                mesclados.set(pedido.idUnico, pedido);
            }
        };
        remotos.forEach(pedido => considerar(pedido, false));
        locais.forEach(pedido => considerar(pedido, true));
        return Array.from(mesclados.values());
    }

    function aplicarTransicao(pedido, acao, agora = Date.now(), apenasReceber = false) {
        if (!pedido || pedido.excluido || pedido.status === 'cancelado') {
            return { ok: false, motivo: 'Item indisponível para alteração.' };
        }

        const anterior = pedido.status;
        let novoStatus = null;

        if (acao === 'pedido_forn' && anterior === 'pendente' && !apenasReceber) novoStatus = 'pedido_forn';
        if (acao === 'comprado' && anterior === 'pendente' && !apenasReceber) novoStatus = 'comprado';
        if (acao === 'entregue' && anterior === 'pedido_forn') novoStatus = 'entregue';

        if (!novoStatus) return { ok: false, motivo: 'Esta mudança não é permitida para o status atual.' };

        pedido.statusAnterior = anterior;
        pedido.status = novoStatus;
        pedido.dataStatus = agora;
        pedido.transicaoProgresso = agora;

        if (novoStatus === 'pedido_forn') {
            pedido.dataPedidoFornecedor = agora;
            delete pedido.dataConclusao;
        } else if (novoStatus === 'comprado' || novoStatus === 'entregue') {
            pedido.dataConclusao = agora;
            if (novoStatus === 'comprado') delete pedido.dataPedidoFornecedor;
        }

        return { ok: true, status: novoStatus };
    }

    function validarRespostaServidor(payload) {
        if (!payload || payload.status !== 'sucesso') {
            return { ok: false, conflito: payload && payload.status === 'conflito', mensagem: payload && (payload.msg || payload.mensagem) };
        }
        return { ok: true, revision: numeroSeguro(payload.revision) };
    }

    function escaparHtml(valor) {
        return String(valor == null ? '' : valor)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function idDomSeguro(valor) {
        return String(valor == null ? '' : valor).replace(/[^a-zA-Z0-9_-]/g, '_');
    }

    return {
        aplicarTransicao,
        escaparHtml,
        idDomSeguro,
        mesclarPedidos,
        numeroSeguro,
        timestampPedido,
        validarRespostaServidor
    };
});
