function criarBancoBase() {
        return {
            app_id: "alofeira",
            schemaVersion: 2,
            syncRevision: 0,
            restaurante: { nome: "", cnpj: "", rua: "", numero: "", bairro: "", cidade: "", uf: "PB", ponto: "" },
            categorias: [],
            fornecedores: [],
            colaboradores: [],
            produtos: [],
            pedidosAtivos: [],
            configs: {
                modo: "pedido",
                senhaAdminHash: "",
                exigirColaborador: true,
                colabAtivoId: null,
                url: "",
                dadosBaixados: false,
                ultimaMudancaLocal: 0,
                historicoApagadoEm: 0,
                ultimoSyncConfirmado: 0,
                syncPendente: false
            }
        };
    }

    function normalizarBanco(dados) {
        const base = criarBancoBase();
        const entrada = dados && typeof dados === 'object' ? dados : {};
        const banco = Object.assign({}, base, entrada);
        banco.app_id = "alofeira";
        banco.schemaVersion = 2;
        banco.syncRevision = AloFeiraDomain.numeroSeguro(entrada.syncRevision);
        banco.restaurante = Object.assign({}, base.restaurante, entrada.restaurante || {});
        banco.configs = Object.assign({}, base.configs, entrada.configs || {});
        banco.categorias = Array.isArray(entrada.categorias) ? entrada.categorias : [];
        banco.fornecedores = Array.isArray(entrada.fornecedores) ? entrada.fornecedores : [];
        banco.colaboradores = Array.isArray(entrada.colaboradores) ? entrada.colaboradores : [];
        banco.produtos = Array.isArray(entrada.produtos) ? entrada.produtos : [];
        banco.pedidosAtivos = Array.isArray(entrada.pedidosAtivos) ? entrada.pedidosAtivos : [];
        banco.pedidosAtivos.forEach(pa => {
            if(!pa.dataEnvio && pa.status !== 'rascunho') pa.dataEnvio = pa.dataStatus || parseInt((pa.idUnico || '').split('_')[1]);
            if(!pa.dataStatus) pa.dataStatus = pa.dataEnvio || parseInt((pa.idUnico || '').split('_')[1]) || 0;
        });
        banco.categorias.forEach(c => { if(!c.subcategorias) c.subcategorias = []; if(c.ativo === undefined) c.ativo = true; });
        banco.produtos.forEach(p => { if(!p.unidades) p.unidades = ['']; if(!p.fornecedores) p.fornecedores = []; if(!p.historicoPrecos) p.historicoPrecos = []; if(p.ativo === undefined) p.ativo = true; });
        banco.fornecedores.forEach(f => { if(f.ativo === undefined) f.ativo = true; });
        banco.colaboradores.forEach(c => { if(c.ativo === undefined) c.ativo = true; });
        if(banco.configs.ultimaMudancaLocal === undefined) banco.configs.ultimaMudancaLocal = 0;
        if(banco.configs.historicoApagadoEm === undefined) banco.configs.historicoApagadoEm = 0;
        if(banco.configs.syncPendente === undefined) banco.configs.syncPendente = false;
        return banco;
    }

    function carregarBanco() {
        let salvo = localStorage.getItem('alofeira_v1');
        if(salvo) {
            try { return normalizarBanco(JSON.parse(salvo)); }
            catch(e) { console.error("Erro ao carregar banco local", e); }
        }
        return criarBancoBase();
    }

    function salvarBanco() { localStorage.setItem('alofeira_v1', JSON.stringify(db)); }
    function getHojeSTR() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
    function marcarMudancaEstrutural(registro = null) { const agora = Date.now(); db.configs.ultimaMudancaLocal = agora; db.configs.syncPendente = true; if(registro) registro.atualizadoEm = agora; salvarBanco(); }
    function marcarMudancaPedido(pedido) { if(!pedido) return; pedido.dataStatus = Date.now(); db.configs.syncPendente = true; salvarBanco(); }
    function getCatsPermitidas(colabLogado) { if(!colabLogado) return null; if(colabLogado.isAdmin) return null; let cats = db.configs.modo === 'pedido' ? colabLogado.catsPermitidasPedido : colabLogado.catsPermitidasCompras; return cats !== undefined ? cats : colabLogado.catsPermitidas; }
    function temAcessoAdmin() { const ativos = db.colaboradores.filter(c => c.ativo !== false); if(ativos.length === 0) return true; const atual = ativos.find(c => c.id === db.configs.colabAtivoId); return Boolean(atual && atual.isAdmin); }
    function formatarDataHora(ts) { if(!ts) return ""; let d = new Date(ts); return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()} às ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; }
    function formatarDataBr(dataStr) { if(!dataStr) return ""; if(dataStr.includes('-')) { const partes = dataStr.split('-'); if(partes.length === 3) return `${partes[2]}/${partes[1]}/${partes[0]}`; } return dataStr; }
    function getNomeFornHTML(id) { if(!id) return ""; let f = db.fornecedores.find(x => x.id === id); return f ? ` - ${AloFeiraDomain.escaparHtml(f.nome)}` : ""; }
    function tempoRelativo(ts) { if(!ts) return ""; let hoje = new Date(); hoje.setHours(0,0,0,0); let d = new Date(ts); d.setHours(0,0,0,0); let diff = Math.floor((hoje - d) / (1000 * 60 * 60 * 24)); if(diff === 0) return "hoje"; if(diff === 1) return "ontem"; if(diff < 0) return "hoje"; return `há ${diff} dias`; }
    function toggleDiv(id) { let el = document.getElementById(id); el.style.display = (el.style.display === 'none') ? 'block' : 'none'; }
    function fecharModal(id) { document.getElementById(id).style.display = 'none'; isModalFechando = true; setTimeout(() => { isModalFechando = false; }, 400); }
    function maskCNPJ(el) { let v = el.value.replace(/\D/g,""); v = v.replace(/^(\d{2})(\d)/,"$1.$2"); v = v.replace(/^(\d{2})\.(\d{3})(\d)/,"$1.$2.$3"); v = v.replace(/\.(\d{3})(\d)/,".$1/$2"); v = v.replace(/(\d{4})(\d)/,"$1-$2"); el.value = v; }
    function maskTelefone(el) { let v = el.value.replace(/\D/g,""); v = v.replace(/^(\d{2})(\d)/g,"($1) $2"); v = v.replace(/(\d)(\d{4})$/,"$1-$2"); el.value = v; }
    function maskMoeda(el) { let v = el.value.replace(/\D/g, ""); if(!v) { el.value = ""; return; } v = (parseFloat(v) / 100).toLocaleString('pt-BR', {minimumFractionDigits: 2}); el.value = v; }
    function parseMoeda(str) { if(!str) return 0; return parseFloat(str.replace(/\./g, "").replace(",", ".")); }
    function parseFloatBr(str) { if(str === '' || str === null || str === undefined) return ''; const valor = Number(String(str).replace(',','.')); return Number.isFinite(valor) ? valor : ''; }
    function removerAcentos(str) { return str.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); }
    function atualizarVisibilidadeAdmin() { const btnAdmin = document.getElementById('btnAdmin'); if(!btnAdmin) return; let colab = db.colaboradores.find(c => c.id === db.configs.colabAtivoId && c.ativo !== false); let ativos = db.colaboradores.filter(c => c.ativo !== false); btnAdmin.style.display = (ativos.length === 0 || (colab && colab.isAdmin)) ? 'inline-flex' : 'none'; }

    function escaparHtml(valor) { return AloFeiraDomain.escaparHtml(valor); }
    function idDomSeguro(valor) { return AloFeiraDomain.idDomSeguro(valor); }

    function mostrarToast(mensagem, tipo = 'info', duracao = 3200) {
        const toast = document.getElementById('appToast');
        if(!toast) return;
        toast.textContent = mensagem;
        toast.className = `app-toast ${tipo} visivel`;
        clearTimeout(mostrarToast.timer);
        mostrarToast.timer = setTimeout(() => toast.classList.remove('visivel'), duracao);
    }

let db = carregarBanco(); let categoriaAtual = null; let modoSelecaoAtivo = false; let itensSelecionadosRelatorio = new Set(); let agrupamentoCompradoAtivo = false; let pilhaDesfazer = []; let tempPrecosProduto = []; let tempFornecedoresProduto = []; let tempSubcats = []; let tempRenames = []; let isSyncingFundo = false; let isModalFechando = false; let filtroFornecedorComprasId = null; let buscaPedidoTexto = ""; let envioPedidoEmAndamento = false; let currentGerenciarFiltro = 'todos'; let currentGerenciarBusca = ''; let origemFormProduto = null; let ultimoTouchEm = 0; let modalAcaoCompraId = null; let acaoCompraPendente = null; let timerConfirmacaoCompra = null;
