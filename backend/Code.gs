var NOME_ABA = 'Banco';
var LIMITE_CELULA = 45000;

function respostaJson_(dados) {
  return ContentService
    .createTextOutput(JSON.stringify(dados))
    .setMimeType(ContentService.MimeType.JSON);
}

function bancoVazio_() {
  return {
    app_id: 'alofeira',
    schemaVersion: 2,
    syncRevision: 0,
    pedidosAtivos: [],
    produtos: [],
    categorias: [],
    fornecedores: [],
    colaboradores: [],
    configs: {}
  };
}

function obterAba_() {
  var planilha = SpreadsheetApp.getActiveSpreadsheet();
  return planilha.getSheetByName(NOME_ABA) || planilha.insertSheet(NOME_ABA);
}

function lerBanco_(aba) {
  var ultimaLinha = aba.getLastRow();
  if (ultimaLinha < 1) return bancoVazio_();
  var valores = aba.getRange(1, 1, ultimaLinha, 1).getDisplayValues();
  var texto = valores.map(function(linha) { return linha[0] || ''; }).join('');
  if (!texto) return bancoVazio_();
  var banco = JSON.parse(texto);
  if (!banco || banco.app_id !== 'alofeira') throw new Error('Banco armazenado inválido.');
  banco.syncRevision = Number(banco.syncRevision || 0);
  return banco;
}

function gravarBanco_(aba, banco) {
  var texto = JSON.stringify(banco);
  var partes = [];
  for (var i = 0; i < texto.length; i += LIMITE_CELULA) {
    partes.push([texto.substring(i, i + LIMITE_CELULA)]);
  }
  aba.clearContents();
  aba.getRange(1, 1, partes.length, 1).setValues(partes);
  SpreadsheetApp.flush();
}

function copiarSemCampos_(objeto, campos) {
  var copia = JSON.parse(JSON.stringify(objeto || {}));
  campos.forEach(function(campo) { delete copia[campo]; });
  return copia;
}

function mudouSemCampos_(anterior, novo, campos) {
  return JSON.stringify(copiarSemCampos_(anterior, campos)) !== JSON.stringify(copiarSemCampos_(novo, campos));
}

function indexarPorId_(lista, campoId) {
  var mapa = {};
  (lista || []).forEach(function(item) {
    if (item && item[campoId]) mapa[item[campoId]] = item;
  });
  return mapa;
}

function resumoTempoPedido_(pedido) {
  var resumo = { idUnico: pedido.idUnico };
  ['dataStatus', 'dataEnvio', 'dataPedidoFornecedor', 'dataConclusao', 'dataExclusao'].forEach(function(campo) {
    resumo[campo] = pedido[campo] === undefined ? null : pedido[campo];
  });
  return resumo;
}

function aplicarTemposServidor_(atual, novoBanco, agora, forcar) {
  var resultado = {
    pedidosAtualizados: [],
    temposEstruturais: { produtos: [], categorias: [], fornecedores: [], colaboradores: [] },
    restauranteAtualizadoEm: null
  };
  if (forcar) return resultado;

  var pedidosAtuais = indexarPorId_(atual.pedidosAtivos, 'idUnico');
  var camposTempoPedido = ['dataStatus', 'dataEnvio', 'dataPedidoFornecedor', 'dataConclusao', 'dataExclusao', 'transicaoProgresso', 'statusAnterior'];
  (novoBanco.pedidosAtivos || []).forEach(function(pedido) {
    var anterior = pedidosAtuais[pedido.idUnico];
    if (!anterior || !mudouSemCampos_(anterior, pedido, camposTempoPedido)) return;
    pedido.dataStatus = agora;
    if (anterior.status !== pedido.status) {
      if (pedido.status === 'pendente' && anterior.status === 'rascunho') pedido.dataEnvio = agora;
      if (pedido.status === 'pedido_forn') pedido.dataPedidoFornecedor = agora;
      if (pedido.status === 'comprado' || pedido.status === 'entregue') pedido.dataConclusao = agora;
    }
    if (!anterior.excluido && pedido.excluido) pedido.dataExclusao = agora;
    resultado.pedidosAtualizados.push(resumoTempoPedido_(pedido));
  });

  ['produtos', 'categorias', 'fornecedores', 'colaboradores'].forEach(function(nome) {
    var mapaAtual = indexarPorId_(atual[nome], 'id');
    (novoBanco[nome] || []).forEach(function(registro) {
      var anterior = mapaAtual[registro.id];
      if (!anterior || !mudouSemCampos_(anterior, registro, ['atualizadoEm'])) return;
      registro.atualizadoEm = agora;
      resultado.temposEstruturais[nome].push({ id: registro.id, atualizadoEm: agora });
    });
  });

  if (atual.restaurante && novoBanco.restaurante && mudouSemCampos_(atual.restaurante, novoBanco.restaurante, ['atualizadoEm'])) {
    novoBanco.restaurante.atualizadoEm = agora;
    resultado.restauranteAtualizadoEm = agora;
  }
  return resultado;
}

function enviarPedidos_(aba, atual, payload, revisaoAtual, agora) {
  if (!Array.isArray(payload.pedidos) || payload.pedidos.length < 1) {
    return respostaJson_({ status: 'erro', msg: 'Nenhum pedido recebido.', serverNow: agora });
  }
  var existentes = indexarPorId_(atual.pedidosAtivos, 'idUnico');
  var produtosExistentes = indexarPorId_(atual.produtos, 'id');
  var atualizados = [];
  var produtosAtualizados = [];
  var mudou = false;
  atual.pedidosAtivos = atual.pedidosAtivos || [];
  atual.produtos = atual.produtos || [];
  (payload.produtos || []).forEach(function(origem) {
    if (!origem || !origem.id || produtosExistentes[origem.id]) return;
    var produto = JSON.parse(JSON.stringify(origem));
    produto.atualizadoEm = agora;
    atual.produtos.push(produto);
    produtosExistentes[produto.id] = produto;
    produtosAtualizados.push({ id: produto.id, atualizadoEm: agora });
    mudou = true;
  });
  payload.pedidos.forEach(function(origem) {
    if (!origem || !origem.idUnico || !origem.produtoId) return;
    if (existentes[origem.idUnico]) {
      atualizados.push(resumoTempoPedido_(existentes[origem.idUnico]));
      return;
    }
    var pedido = JSON.parse(JSON.stringify(origem));
    pedido.status = 'pendente';
    pedido.dataEnvio = agora;
    pedido.dataStatus = agora;
    delete pedido.dataPedidoFornecedor;
    delete pedido.dataConclusao;
    delete pedido.dataExclusao;
    atual.pedidosAtivos.push(pedido);
    existentes[pedido.idUnico] = pedido;
    atualizados.push(resumoTempoPedido_(pedido));
    mudou = true;
  });
  if (mudou) {
    atual.schemaVersion = 2;
    atual.syncRevision = revisaoAtual + 1;
    gravarBanco_(aba, atual);
  }
  return respostaJson_({
    status: 'sucesso',
    revision: mudou ? atual.syncRevision : revisaoAtual,
    serverNow: agora,
    pedidosAtualizados: atualizados,
    temposEstruturais: { produtos: produtosAtualizados, categorias: [], fornecedores: [], colaboradores: [] }
  });
}

function doGet(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    var banco = lerBanco_(obterAba_());
    var agora = Date.now();
    if (e && e.parameter && e.parameter.meta === '1') {
      return respostaJson_({ status: 'sucesso', app_id: 'alofeira', revision: Number(banco.syncRevision || 0), serverNow: agora });
    }
    banco.serverNow = agora;
    return respostaJson_(banco);
  } catch (error) {
    return respostaJson_({ status: 'erro', msg: error.toString(), serverNow: Date.now() });
  } finally {
    if (lock.hasLock()) lock.releaseLock();
  }
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    if (!e || !e.postData || !e.postData.contents) {
      return respostaJson_({ status: 'erro', msg: 'Conteúdo ausente.', serverNow: Date.now() });
    }
    var payload = JSON.parse(e.postData.contents);
    var aba = obterAba_();
    var atual = lerBanco_(aba);
    var agora = Date.now();
    var revisaoAtual = Number(atual.syncRevision || 0);
    var clienteUsaRevisao = payload.baseRevision !== undefined && payload.baseRevision !== null;
    var revisaoCliente = Number(payload.baseRevision || 0);

    if (!payload.force && clienteUsaRevisao && revisaoCliente !== revisaoAtual) {
      return respostaJson_({
        status: 'conflito',
        msg: 'A nuvem possui uma versão mais recente.',
        revision: revisaoAtual,
        dados: atual,
        serverNow: agora
      });
    }

    if (payload.action === 'enviar_pedidos') {
      return enviarPedidos_(aba, atual, payload, revisaoAtual, agora);
    }
    if (payload.action !== 'salvar_banco' || !payload.dados || payload.dados.app_id !== 'alofeira') {
      return respostaJson_({ status: 'erro', msg: 'Ação ou banco inválido.', serverNow: agora });
    }

    var novoBanco = payload.dados;
    var tempos = aplicarTemposServidor_(atual, novoBanco, agora, Boolean(payload.force));
    novoBanco.schemaVersion = 2;
    novoBanco.syncRevision = revisaoAtual + 1;
    gravarBanco_(aba, novoBanco);
    return respostaJson_({
      status: 'sucesso',
      revision: novoBanco.syncRevision,
      serverNow: agora,
      pedidosAtualizados: tempos.pedidosAtualizados,
      temposEstruturais: tempos.temposEstruturais,
      restauranteAtualizadoEm: tempos.restauranteAtualizadoEm
    });
  } catch (error) {
    return respostaJson_({ status: 'erro', msg: error.toString(), serverNow: Date.now() });
  } finally {
    if (lock.hasLock()) lock.releaseLock();
  }
}

function doOptions() {
  return ContentService.createTextOutput('OK').setMimeType(ContentService.MimeType.TEXT);
}
