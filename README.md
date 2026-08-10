# Alô Feira

Aplicativo web instalável para preparar pedidos, acompanhar compras e gerar relatórios por fornecedor.

## Estrutura

- `index.html`: estrutura das telas e modais.
- `src/scripts/`: regras separadas por domínio, sincronização, segurança e interface.
- `src/styles/`: base, layout, componentes, recursos e responsividade.
- `backend/Code.gs`: backend do Google Apps Script.
- `tests/`: testes de domínio, integridade dos arquivos e servidor local de navegador.
- `service-worker.js`: instalação e funcionamento offline da PWA.

## Executar localmente

```powershell
python -m http.server 5173 --bind 127.0.0.1
```

Abra `http://127.0.0.1:5173/`.

## Testes

```powershell
npm test
```

## Backend

Copie `backend/Code.gs` para o projeto vinculado à planilha e publique uma nova versão da implantação como aplicativo da web. O acesso deve continuar configurado para os usuários que utilizam o Alô Feira.
