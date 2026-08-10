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

function doGet() {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    return respostaJson_(lerBanco_(obterAba_()));
  } catch (error) {
    return respostaJson_({ status: 'erro', msg: error.toString() });
  } finally {
    if (lock.hasLock()) lock.releaseLock();
  }
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    if (!e || !e.postData || !e.postData.contents) {
      return respostaJson_({ status: 'erro', msg: 'Conteúdo ausente.' });
    }
    var payload = JSON.parse(e.postData.contents);
    if (payload.action !== 'salvar_banco' || !payload.dados || payload.dados.app_id !== 'alofeira') {
      return respostaJson_({ status: 'erro', msg: 'Ação ou banco inválido.' });
    }

    var aba = obterAba_();
    var atual = lerBanco_(aba);
    var revisaoAtual = Number(atual.syncRevision || 0);
    var clienteUsaRevisao = payload.baseRevision !== undefined && payload.baseRevision !== null;
    var revisaoCliente = Number(payload.baseRevision || 0);

    if (!payload.force && clienteUsaRevisao && revisaoCliente !== revisaoAtual) {
      return respostaJson_({
        status: 'conflito',
        msg: 'A nuvem possui uma versão mais recente.',
        revision: revisaoAtual,
        dados: atual
      });
    }

    var novoBanco = payload.dados;
    novoBanco.schemaVersion = 2;
    novoBanco.syncRevision = revisaoAtual + 1;
    gravarBanco_(aba, novoBanco);
    return respostaJson_({ status: 'sucesso', revision: novoBanco.syncRevision });
  } catch (error) {
    return respostaJson_({ status: 'erro', msg: error.toString() });
  } finally {
    if (lock.hasLock()) lock.releaseLock();
  }
}

function doOptions() {
  return ContentService.createTextOutput('OK').setMimeType(ContentService.MimeType.TEXT);
}
